import {Util} from "./util.js";

class Extruder {

  constructor(coords) {
    this.coords = coords;
  }

  /**
   * Returns a THREE.Mesh (subclass of THREE.Object3D) instance which represents an extrusion
   * of a polygonal geographic feature.
   * @param {Object} feature A polygon geographic feature of a footprint.
   * @param {number} numberOfLevels
   * @param {Object} options
   * @returns {Object} a new THREE.Mesh instance, or null if any errors are encountered
   *
   * The depth of the extrusion can be determined, confusingly, in several ways:
   *   1. if options['extrudeDepth'] is present, extrude depth is set to it;
   *      note that options['extrudeDepth'] should be < 0.
   *   2. otherwise, if the feature has a property named 'height', extrude depth
   *      is set to -feature.properties['height'] (note this property value can
   *      be a string and will be parsed into a floating point number)
   *   3. otherwise, if numberOfLevels > 0, extrude depth is set to
   *      -numberOfLevels * options['averageStoreyHeightMeters'],
   *   4. otherwise, extrude depth is set to -options['minimumExtrusionMeters']
   */
  extrudeFeature(feature, numberOfLevels, options) {
    try{
      options = options || {};
      const shape = this.featureToSceneCoordsShape(feature);

      if (!('averageStoreyHeightMeters' in options)) {
        throw new Error("Extruder.extrudeFeature: options['averageStoreyHeightMeters'] is required");
      }
      if (!('minimumExtrusionMeters' in options)) {
        throw new Error("Extruder.extrudeFeature: options['minimumExtrusionMeters'] is required");
      }
      if (!('brightnessOfExtrudedModels' in options)) {
        throw new Error("Extruder.extrudeFeature: options['brightnessOfExtrudedModels'] is required");
      }
      if (!('colorVariationOfExtrudedModels' in options)) {
        throw new Error("Extruder.extrudeFeature: options['colorVariationOfExtrudedModels'] is required");
      }

      const MINIMUM_EXTRUSION_METERS = 0.01;

      const extrudeSettings = {
        depth: numberOfLevels > 0 ? -numberOfLevels * options['averageStoreyHeightMeters'] :
                                    -options['minimumExtrusionMeters'],
        bevelEnabled: false
      };
      if (feature.properties['height']) {
        extrudeSettings.depth = -parseFloat(feature.properties['height']);
      }
      if (options.extrudeDepth) {
        extrudeSettings.depth = options.extrudeDepth;
      }
      const mesh = this.shapeToMesh(shape, extrudeSettings, options);
      // NOTE: id of this feature  is feature.properties.id; use that later to track this object
      mesh.name = feature.properties.id;
      // TODO: set visibility based on current year and the values of
      //   feature.properties.start_date and feature.properties.end_date
      mesh.visible = true;
      return mesh;
    } catch (e) {
      console.log('Error while loading feature '+ feature.id + ': ' +e);
    }
    return null;
  }

  /**
   * Converts a geojson feature to a THREE.Shape instance in scene coords.
   * @param feature {Objet} a geojson object
   * @return {THREE.Shape} a new THREE.Shape instance
   */
  featureToSceneCoordsShape(feature) {
    // Convert the coordinate array in the feature to an array of THREE.Vector2 containing lon,lat in degrees.
    // Note this only uses the first array (outer ring? first polygon?) in the coordinates array.
    // TODO: generalize this to incorporate all coordinates.
    const lonLatDegreesArray = feature.geometry.coordinates[0].map(lonLatDegrees => new THREE.Vector2(lonLatDegrees[0], lonLatDegrees[1]));
    // Convert to scene coords
    const sceneCoordsArray = lonLatDegreesArray.map(lonLatDegrees => this.coords.lonLatDegreesToSceneCoords(lonLatDegrees));
    // Create the shape
    return new THREE.Shape(sceneCoordsArray);
  }

  /**
   * Extrudes a shape to create a Mesh.
   * @param {!THREE.Shape} shape
   * @param {!Object} extrudeSettings
   * @param {?Object} options
   * @return {!THREE.Mesh}
   */
  shapeToMesh(shape, extrudeSettings, options) {
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Nudge extruded objects up off the ground plane just a tad; this prevents objects
    // with height 0 from flickering due to being exactly coplanar with the ground.
    geometry.vertices.forEach(v => {
      v.z -= 0.02;
    });
    options = options || {};
    const mat = new THREE.MeshPhongMaterial({
      color: options.color ? options.color : Util.generateRandomGreyColor(options['brightnessOfExtrudedModels'],
                                                                          options['colorVariationOfExtrudedModels']),
      side: options.side == null ? THREE.DoubleSide : options.side
    });
    const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, [mat]);
    mesh.rotation.x = 90 * (Math.PI / 180);
    return mesh;
  }
}

export {Extruder};
