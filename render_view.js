import {GeoPoint, GeoConverter} from "./geospatial_utils.js";

class RenderView {
  // Assumes 14 feet (4.3 meters) for each level,according to
  // https://en.wikipedia.org/wiki/Storey#Overview.

  BRIGHTNESS_OF_EXTRUDED_MODELS = 0.6;
  COLOR_VARIATION_OF_EXTRUDED_MODELS = 0.1;
  AVERAGE_STOREY_HEIGHT_METERS = 4.3;
  processedFeatures = false;
  constructor(settings) {
    this.skyboxImages = [
      "images/py.png", // up
      "images/ny.png", // dn
      "images/px.png", // fr
      "images/nx.png", // bk
      "images/nz.png", // lf
      "images/pz.png", // rt
    ];
    this.settings = settings
    this.scene = new THREE.Scene();
    this.idToMesh = {};
    this.idToModel = {};
    this.idToFeatureProperties = {};
    this.idToBaseName = {};
    this.materialsWithTextureToToggle = [];
    this.materialsWithColorToToggle = [];
    this.ground = {object3d:null, vertices:null, holes:[{geometry:null,start_date:null,end_date:null}]};
    this.constructCallbacks();
    this.initializeScene(settings);
  }

  constructCallbacks() {
    /**
    * A callback function to process the geographic features returned from the
    * Kartta Labs API. This function adds each feature to a map (dictionary) with
    * their IDs as the key and then loads them into the scene.
    * @param {!Object} response The response from Kartta Labs API.
    */
    this.processFeatures = (response) => {
      const features = response.data;

      const checkedTexture = new THREE.TextureLoader().load('images/checked.png');
      checkedTexture.repeat.set(1/10, 1/10);
      checkedTexture.offset.set(0.1, 0.5);
      checkedTexture.wrapS = THREE.RepeatWrapping;
      checkedTexture.wrapT = THREE.RepeatWrapping;

      // const isExcluded = {};
      // excluded_models.forEach(m => {
      //  isExcluded[m.id] = true;
      // });

      for (let i = 0; i < features.length; i++) {
        // if (isExcluded[features[i].id]) {
        //  continue;
        // }
        this.idToFeatureProperties[features[i].id] = features[i].properties;
        let numberOfLevels = 0;
        if (features[i].properties['building:levels']) {
          numberOfLevels = features[i].properties['building:levels'];
        }

        if(features[i].properties['building']){
          this.loadFeature(features[i], numberOfLevels, {
            map: numberOfLevels > 0 ? checkedTexture : undefined
          });
        } else if (features[i].properties['sidewalk']) {
          // We currently use the same function to load and minimally extrude
          // sidewalks, that we use for buildings. This works by assuming sidewalks
          // as flat (i.e., with zero stories) buildings. Ideally we should have a
          // separate function to construct each map feature in 3D.
          this.loadFeature(features[i], numberOfLevels, {
            color: new THREE.Color(0.8, 0.8, 0.8),
            extrudeDepth: -0.15,  // ~ 6 inches, in meters
            receiveShadows: true,
          });
        } else {
          console.log('feature is not supported for rendering.');
        }
      }
      this.processedFeatures = true;
    };

  }

  initializeScene() {
    settings = this.settings;
    this.sceneOrigin = new GeoPoint(
      settings.origin.latitudeInMicroDegrees,
      settings.origin.longitudeInMicroDegrees);
    const farPlane = settings.farPlane;

    // Add ambient lights.
    settings.lights.Ambient.forEach((item) => {
      this.scene.add(new THREE.AmbientLight(item.color, item.intensity));
    });

    if (settings.shadows) {
      // Add directional lights that cast shadow.
      settings.lights.directionalWithShadow.forEach((item) => {
        const numberOfLights = item.numberOfExtraLightstoSoftenShadow + 1;
        const offset = item.totalSoftenningOffsetInMeters / numberOfLights;
        const intensity = item.intensity / numberOfLights;
        for (let i = 0; i < numberOfLights; i++) {
          const light = new THREE.DirectionalLight(item.color, intensity);

          light.position.set(
              item.position.x + i * offset, item.position.y,
              item.position.z - i * offset);

          light.castShadow = true;

          light.shadow.camera.near = item.shadowCameraNear;
          light.shadow.camera.far = item.shadowCameraFar;

          light.shadow.camera.left = item.shadowCameraLeft;
          light.shadow.camera.right = item.shadowCameraRight;
          light.shadow.camera.top = item.shadowCameraTop;

          light.shadow.camera.bottom = item.shadowCameraBottom;
          light.shadow.mapSize.width = item.shadowMapSizeWidth;
          light.shadow.mapSize.height = item.shadowMapSizeHeight;
          light.shadow.bias = item.shadowBias;
          this.scene.add(light);
        }
        if (item.addOppositeLight) {
          const dimmingFactor = 0.1;
          const oppositeLight = new THREE.DirectionalLight(
              item.color, item.intensity * dimmingFactor);
          oppositeLight.position.set(
                  -item.position.x, item.position.y, -item.position.z);
          this.scene.add(oppositeLight);
        }
      });
    } else {
      settings.lights.directional.forEach((item) => {
        const light = new THREE.DirectionalLight(item.color, item.intensity);
        light.position.set(item.position.x, item.position.y, item.position.z);
        this.scene.add(light);
      });
    }
    // skybox
    this.loadSkyboxTextures(() => {
      // Skybox cube size is, conservatively, set to the half of the Camera
      // frustrum far plane, such that the skybox is always visible.
      const geometry =
          new THREE.BoxGeometry(farPlane / 2.0, farPlane / 2.0, farPlane / 2.0);
      const cube = new THREE.Mesh(geometry, [
        this.skyboxImages[2],
        this.skyboxImages[3],
        this.skyboxImages[0],
        this.skyboxImages[1],
        this.skyboxImages[5],
        this.skyboxImages[4],
      ]);
      cube.position.x = 0;
      cube.position.y = 0;
      cube.position.z = 0;
      cube.name = 'skybox';
      this.scene.add(cube);
    });

    this.ground.vertices = [];
    this.ground.vertices.push(new THREE.Vector2(-farPlane, -farPlane));
    this.ground.vertices.push(new THREE.Vector2(-farPlane, +farPlane));
    this.ground.vertices.push(new THREE.Vector2(+farPlane, +farPlane));
    this.ground.vertices.push(new THREE.Vector2(+farPlane, -farPlane));
    const planeShape = new THREE.Shape(this.ground.vertices);
    const planeGeometry = new THREE.ShapeGeometry(planeShape);

    const asphalt = new THREE.TextureLoader().load('images/asphalt.jpg');
    asphalt.repeat.set(0.5, 0.5);
    asphalt.wrapS = THREE.RepeatWrapping;
    asphalt.wrapT = THREE.RepeatWrapping;
    const planeMaterial = new THREE.MeshStandardMaterial({map: asphalt});
    this.ground.object3d = new THREE.Mesh(planeGeometry, planeMaterial);
    this.ground.object3d.rotation.x = -Math.PI / 2;
    this.ground.object3d.name = 'ground';
    if (settings.shadows) {
      this.ground.object3d.receiveShadow = true;
    }
    this.ground.holes = [];
    this.updateGround(this.ground);
    this.scene.add(this.ground.object3d);
  }
  
  /**
   * Goes through all the models and sets a model visible if the current year is
   * within the start and end year of the model.
   */
  setSceneYear() {
    for (const [key, value] of Object.entries(this.idToMesh)) {
      const startYear = this.idToModel[key] ?
        this.idToModel[key].start_year :
        RenderView.extractYearFromDate(this.idToFeatureProperties[key].start_date);
      const endYear = this.idToModel[key] ?
        this.idToModel[key].end_year :
        RenderView.extractYearFromDate(this.idToFeatureProperties[key].end_date);
      RenderView.setVisibility(startYear, endYear, this.idToMesh[key]);
    }
    this.updateGround();
  };
  /**
   * Creates the ground of the scene.
   */
  updateGround() {
    const shape = new THREE.Shape(this.ground.vertices);
    let holes = [];
    for (const hole of this.ground.holes) {
      const startYear = extractYearFromDate(hole.start_date) || 0;
      const endYear = extractYearFromDate(hole.end_date) || 10000;
      if (startYear <= settings.year && endYear >= settings.year) {
        holes.push(hole.geometry);
      }
    }
    shape.holes = holes;

    this.ground.object3d.geometry = new THREE.ShapeGeometry(shape);
  }

  toggleTextures() {
    this.materialsWithTextureToToggle.forEach(m => {
      const tmp = m.map;
      m.map = m.savedMap;
      m.savedMap = tmp;
      m.needsUpdate = true;
    });
  }
  
  toggleColors() {
    this.materialsWithColorToToggle.forEach(m => {
      let tmp = m.color;
      m.color = m.savedColor;
      m.savedColor = tmp;
      m.needsUpdate = true;
    });
  }
  /**
   * Extracts the year out of the OSM date tag. This function is not fully
   * implemented and currently assumes the date is equivalent to the year. which is
   * not always correct. The implementation is quite complicated and not required
   * for the demo, however it needs to be implemented for future uses. This
   * function acts as a placeholder for the correct implementation. More
   * information on OSM date fromat can be found here:
   * https://wiki.openstreetmap.org/wiki/Key:start_date
   * @param {?string} date
   * @return {?number}
   */
  static extractYearFromDate(date) {
    return date ? Number(date) : null;
  }

  /**
   * Puts a feature (building) on the scene.
   * @param {string} feature A polygon geographic feature of a footprint.
   * @param {number} numberOfLevels
   */
  loadFeature(feature, numberOfLevels, options) {
    options = options || {};
    const shape =
      GeoConverter.geoPointArrayToShape(GeoConverter.wayToGeoPointArray(feature.geometry.coordinates[0]), this.sceneOrigin);
    const MINIMUM_EXTRUSION_METERS = 0.01;

    const extrudeSettings = {
      depth: numberOfLevels > 0 ? -numberOfLevels * this.AVERAGE_STOREY_HEIGHT_METERS :
                                  -MINIMUM_EXTRUSION_METERS,
      bevelEnabled: false
    };
    if (feature.properties['height']) {
      extrudeSettings.depth = -parseFloat(feature.properties['height']);
    }
    if (options.extrudeDepth) {
      extrudeSettings.depth = options.extrudeDepth;
    }
    const mesh = this.shapeToMesh(shape, extrudeSettings, options);
    if (!this.idToMesh[feature.properties.id]) {
      mesh.name = feature.properties.id;
      this.idToMesh[mesh.name] = mesh;
      RenderView.setVisibility(
        RenderView.extractYearFromDate(feature.properties.start_date),
        RenderView.extractYearFromDate(feature.properties.end_date), mesh
      );
      this.scene.add(mesh);
    }
  }

  /**
   * Generates a random color with a given brightness. It does not follow the most
   * accurate implementation.
   * @param {number} brightness a number between 0 and 1.
   * @return {!THREE.Color}
   */
  static generateRandomColor(brightness) {
    brightness = Math.min(1, Math.max(0, brightness));
    return new THREE.Color().fromArray(Array(3).fill().map(
        () => (Math.min(
            1,
            // TODO: Use a solution to seed randomness.
            Math.max(
                0, brightness + (1 - brightness) * (Math.random() - 0.5))))));
  }

  /**
   * Sets a model visible if the current year is within the start and end date of
   * the model.
   * @param {?number} startYear
   * @param {?number} endYear
   * @param {!THREE.Object} object
   */
  static setVisibility(startYear, endYear, object) {
    startYear = startYear || 0;
    endYear = endYear || 10000;
    if (startYear <= settings.year && endYear >= settings.year) {
      if (!object.visible) {
        RenderView.appear(object);
      }
    } else {
      if (object.visible) {
        RenderView.disappear(object);
      }
    }
  }

  /**
   * Hides the model.
   * @param {!Model} model
   */
  static disappear(model) {
    model.visible = false;
  }

  /**
   * Makes the model visible.
   * @param {!Model} model
   */
  static appear(model) {
    model.visible = true;
  }

  /**
   * Loads the skybox.
   * @param {function()} callback Function to construct a cube and put the
   *     textures on it.
   */
  loadSkyboxTextures(callback) {
    let remainingTexturesToLoad = 0;
    for (let i = 0; i < this.skyboxImages.length; i++) {
      const src = this.skyboxImages[i];
      remainingTexturesToLoad++;
      const texture = new THREE.TextureLoader().load(src, () => {
        remainingTexturesToLoad--;
        if (remainingTexturesToLoad === 0) {
          callback();
        }
      });
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.format = THREE.RGBFormat;
      this.skyboxImages[i] =
          new THREE.MeshBasicMaterial({
              map: texture,
              //color: 0x111199,
              side: THREE.BackSide
          });
    }
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
      color: options.color ? options.color : RenderView.generateRandomGreyColor(this.BRIGHTNESS_OF_EXTRUDED_MODELS,
                                                                    this.COLOR_VARIATION_OF_EXTRUDED_MODELS),
      side: options.side == null ? THREE.DoubleSide : options.side
  ,  });
    if (options.map) {
      mat['savedMap'] = options.map;
    }
    this.materialsWithTextureToToggle.push(mat);

    const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, [mat]);
    if (settings.shadows) {
      mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = settings.buildingsReceiveShadows || options.receiveShadows;
        }
      });
    }
    mesh.rotation.x = 90 * (Math.PI / 180);
    return mesh;
  }

  static generateRandomGreyColor(brightness, variation) {
    brightness = Math.min(1, Math.max(0, brightness));
    const v = Math.min(1, Math.max(0, brightness + 2 * (Math.random() - 0.5) * variation));
    return new THREE.Color(v,v,v);
  }
}

export {RenderView};