import {Axes} from "./axes.js";
import {Rect} from "./rect.js";
import {Coords} from "./coords.js";
import {EventTracker} from "./event_tracker.js";
import {GeoPoint, GeoConverter} from "./geospatial_utils.js";
import {MovingCenterFrame} from "./moving_center_frame.js";
import {Settings} from "./settings.js";
import {SkyBox} from "./skybox.js";
import {Util} from "./util.js";
import {Tile, Tiler} from "./tiles.js";

class App {
  BRIGHTNESS_OF_EXTRUDED_MODELS = 0.6;
  COLOR_VARIATION_OF_EXTRUDED_MODELS = 0.1;
  AVERAGE_STOREY_HEIGHT_METERS = 4.3;

  /**
   */
  constructor(container, options) {
    this.fetchradius = ('fetchradius' in options) ? options['fetchradius'] : 2;
    this.dropradius = ('dropradius' in options) ? options['dropradius'] : 5;
    this.tilesize = ('tilesize' in options) ? options['tilesize'] : 1000;
    this.eyeheight = ('eyeheight' in options) ? options['eyeheight'] : 1.7;
    this.speed = ('speed' in options) ? options['speed'] : 1.0;
    this.debug = ('debug' in options) ? options['debug'] : false;



    this.renderRequested = false;
    this.container = container;
    this.camera = null;
    this.scene = new THREE.Scene();
    this.sceneOrigin = new GeoPoint(
      Settings.origin.latitudeInMicroDegrees,
      Settings.origin.longitudeInMicroDegrees);
    this.sceneOriginDegrees = new THREE.Vector2(Settings.origin.longitudeInMicroDegrees / 1.0e6,
                                                Settings.origin.latitudeInMicroDegrees / 1.0e6);
    this.coords = new Coords(this.sceneOriginDegrees);


    const defaultCameraSceneCoords = new THREE.Vector2(0, 200);
    const defaultCameraLonLatDegrees = this.coords.sceneCoordsToLatLonDegrees(defaultCameraSceneCoords);

    this.initialCameraXAngle = ('pitch' in options) ? options['pitch'] : 0;
    this.initialCameraYAngle = ('yaw' in options) ? options['yaw'] : 0;

    const initialCameraLonDegrees = ('lon' in options) ? options['lon'] : defaultCameraLonLatDegrees.x;
    const initialCameraLatDegrees = ('lat' in options) ? options['lat'] : defaultCameraLonLatDegrees.y;
    const initialCameraLonLatDegrees = new THREE.Vector2(initialCameraLonDegrees, initialCameraLatDegrees);
    const initialCameraSceneCoords = this.coords.lonLatDegreesToSceneCoords(initialCameraLonLatDegrees);

    this.initialCameraX = initialCameraSceneCoords.x;
    this.initialCameraY = this.eyeheight;
    this.initialCameraZ = initialCameraSceneCoords.y;

    this.tiler = new Tiler(this.tilesize, this.coords);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize( this.container.offsetWidth, this.container.offsetHeight );
    this.renderer.setClearColor( 0x6666ff, 1 );
    this.container.appendChild( this.renderer.domElement );
    this.eventTracker = new EventTracker(this.container);


    // map whose keys are bbox strings, value is an object with the following structure:
    // {
    //    tile: the Tile instance for the tile
    //    object3D: the THREE.Object3D instance containing the data for the tile
    // }
    this.bBoxStringToSceneTileDetails = {};

    // map whose keys are feature ids, values are the bbox string (key into bBoxStringToSceneTileDetails) for
    // the tile containing that feature
    this.featureIdToBBoxString = {};

    this.center = new THREE.Object3D();
    this.center.position.set(0,0,0);
    this.scene.add(this.center);

    //this.raycaster = new THREE.Raycaster();

    this.movingCenterFrame = new MovingCenterFrame();

    this.eventMode = 'look';

    this.eventTracker.setMouseDownListener(e => {
      if (e.button == 2) {
        // noop
      }
    }).setMouseUpListener(e => {
      //console.log('mouseUp: e = ', e);
    }).setMouseDragListener((p, dp, button) => {
      //console.log('mouseDrag: dp = ', dp);

      let M;

      if (this.eventMode == 'orbit') {
        const v = new THREE.Vector3(dp.y, dp.x, 0).normalize();
        const d = Math.sqrt(dp.x*dp.x + dp.y*dp.y);
        const angle = (d / this.container.offsetWidth) * Math.PI;
        const L = new THREE.Matrix4().makeRotationAxis(v, angle);
        M = this.movingCenterFrame.computeTransform(
            /* moving= */ this.camera,
            /* center= */ this.center,
            /* frame= */ this.camera,
            L);
      } else if (this.eventMode == 'freelook') {
        const v = new THREE.Vector3(dp.y, dp.x, 0).normalize();
        const d = Math.sqrt(dp.x*dp.x + dp.y*dp.y);
        const angle = (d / this.container.offsetWidth) * Math.PI;
        const L = new THREE.Matrix4().makeRotationAxis(v, angle);
        M = this.movingCenterFrame.computeTransform(
            /* moving= */ this.camera,
            /* center= */ this.camera,
            /* frame= */ this.camera,
            L);
      } else if (this.eventMode == 'look') {

        const xangle = (dp.y / this.container.offsetWidth) * Math.PI;
        const yangle = (dp.x / this.container.offsetWidth) * Math.PI;

        this.cameraXAngle += xangle;
        this.cameraYAngle += yangle;
        this.updateCamera();
        return;
      }

      this.camera.matrix.multiplyMatrices(this.camera.matrix, M);
      this.camera.matrixWorldNeedsUpdate = true;
      this.refreshDataForNewCameraPosition();
      this.requestRender();
    }).setMouseWheelListener(e => {
      //console.log('mouseWheel: e = ', e);
    }).setKeyPressListener(e => {
      if (e.key == 'w') {
        this.walkCamera(this.speedForEyeHeight());
      } else if (e.key == 's') {
        this.walkCamera(-this.speedForEyeHeight());
      } else if (e.key == 'a') {
        this.walkCamera(this.speedForEyeHeight(), /* sideways= */true);
      } else if (e.key == 'd') {
        this.walkCamera(-this.speedForEyeHeight(), /* sideways= */true);
      }
    }).setKeyUpListener(e => {
      if (e.key == 'l') {
        this.eventMode = 'look';
      } else if (e.key == 'o') {
        this.eventMode = 'orbit';
      } else if (e.key == 'g') {
        if (this.controls) {
          this.camera.matrixWorld.decompose(this.camera.position,
                                            this.camera.quaternion,
                                            this.camera.scale);
          this.camera.matrixAutoUpdate = true;
          this.controls.lock();
        }
      }
    });
    this.eventTracker.start();
  }

  speedForEyeHeight() {
     // linearly interpolate between speed at height 1.7, and 5*speed at height 85.
     return this.speed * (1.0 + 5.0 * (this.eyeheight - 1.7) / (85.0 - 1.7));
  }

  walkCamera(amount, sideways) {
    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);
    const lookLen = Math.sqrt(lookDir.x*lookDir.x + lookDir.z*lookDir.z);
    if (sideways) {
      this.cameraX += amount * lookDir.z;
      this.cameraZ += -amount * lookDir.x;
    } else {
      this.cameraX += amount * lookDir.x;
      this.cameraZ += amount * lookDir.z;
    }
    this.updateCamera();
  }

  tileIndexUnderCamera() {
    const cameraPos = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPos);
    const cameraGroundPosScene = new THREE.Vector2(cameraPos.x, cameraPos.z);
    const cameraGroundPosLonLatDegrees = this.coords.sceneCoordsToLatLonDegrees(cameraGroundPosScene);
    return this.tiler.tileIndexAtLonLatDegrees(cameraGroundPosLonLatDegrees);
  }

  refreshDataForNewCameraPosition() {
    const cameraTileIndex = this.tileIndexUnderCamera();

    const tilesNearCamera = Tiler.tileIndicesNear(cameraTileIndex, this.fetchradius)
      .map(tileIndex => this.tiler.tileAtIndex(tileIndex));
    tilesNearCamera.forEach(tile => {
      if (tile.getBBoxString() in this.bBoxStringToSceneTileDetails) { return; }

      const tileObject = new THREE.Object3D();
      const tileDetails = {
        object3D: tileObject,
        tile: tile,
        featureIds: []
      };
      this.bBoxStringToSceneTileDetails[tile.getBBoxString()] = tileDetails;
      this.scene.add(tileObject);

      if (this.debug) {
        tileDetails.redRect = Rect.solidRect(tile.getSceneMin(), tile.getSceneMax(), {
          color: 0xff0000,
          outlinecolor: 0x000000,
          y: 0.25
        });
        this.scene.add(tileDetails.redRect);
        this.requestRender();
      }

      this.requestRenderAfterEach(this.initializeBuildings(tile, tileDetails, () => {
        if (!this.debug) { return; }
        this.scene.remove(tileDetails.redRect);
        tileDetails.greenRect = Rect.rect(tile.getSceneMin(), tile.getSceneMax(), {
          color: 0x00ff00,
          linewidth: 3,
          y: 0.5
        });
        this.scene.add(tileDetails.greenRect);
        this.requestRender();
      }));
    });

    Object.keys(this.bBoxStringToSceneTileDetails).forEach(bBoxString => {
      const tileDetails = this.bBoxStringToSceneTileDetails[bBoxString];
      const tileIndex = tileDetails.tile.getTileIndex();
      if (Tiler.tileIndexDistance(tileIndex, cameraTileIndex) >= this.dropradius) {
        this.scene.remove(tileDetails.object3D);
        if (this.debug) {
          if (tileDetails.redRect) { this.scene.remove(tileDetails.redRect); }
          if (tileDetails.greenRect) { this.scene.remove(tileDetails.greenRect); }
        }
        tileDetails.featureIds.forEach(featureId => {
          delete(this.featureIdToBBoxString[featureId]);
        });
        delete(this.bBoxStringToSceneTileDetails[bBoxString]);
      }
    });
    this.requestRender();
  }

  initializeLights() {
    // Add ambient lights.
    Settings.lights.Ambient.forEach((item) => {
      this.scene.add(new THREE.AmbientLight(item.color, item.intensity));
    });
    // Add directional lights (no shadows).
    Settings.lights.directional.forEach((item) => {
      const light = new THREE.DirectionalLight(item.color, item.intensity);
      light.position.set(item.position.x, item.position.y, item.position.z);
      this.scene.add(light);
    });
  }

  /**
   * Sets the camera position (& rotation) from this.camera{X,Y,Z} and this.camera{X,Y}Angle,
   * and requests a render.
   */
  updateCamera() {

    this.camera.matrix.identity();

    this.camera.matrix.multiply(new THREE.Matrix4().makeTranslation(this.cameraX, this.cameraY, this.cameraZ));
    this.camera.matrix.multiply(new THREE.Matrix4().makeRotationY(this.cameraYAngle));
    this.camera.matrix.multiply(new THREE.Matrix4().makeRotationX(this.cameraXAngle));

    const url = new URL(document.location);
    const params = url.searchParams;
    const cameraSceneCoords = new THREE.Vector2(this.cameraX, this.cameraZ);
    const cameraLonLatDegrees = this.coords.sceneCoordsToLatLonDegrees(cameraSceneCoords);
    params.set("lon", cameraLonLatDegrees.x);
    params.set("lat", cameraLonLatDegrees.y);
    params.set("pitch", this.cameraXAngle);
    params.set("yaw", this.cameraYAngle);

    window.history.replaceState(null, '',
                                location.origin + location.pathname + '?' + params.toString());

    this.camera.matrixAutoUpdate = false;
    this.camera.matrixWorldNeedsUpdate = true;
    this.refreshDataForNewCameraPosition();
    if (this.skybox) {
      this.skybox.position.x = this.cameraX;
      this.skybox.position.z = this.cameraZ;
    }
    if (this.ground) {
      this.ground.position.x = this.cameraX;
      this.ground.position.z = this.cameraZ;
    }
    this.requestRender();
  }

  initializeCamera(initial_gaze_point) {
    this.camera = new THREE.PerspectiveCamera(
        Settings.fieldOfView,
        /* aspectRatio= */ this.container.offsetWidth/this.container.offsetHeight,
        Settings.nearPlane, Settings.farPlane);

    // Sets the camera height to human height (2m) looking to the center of the
    // scene from 10m away.

    this.cameraXAngle = this.initialCameraXAngle;
    this.cameraYAngle = this.initialCameraYAngle;
    this.cameraX = this.initialCameraX;
    this.cameraY = this.initialCameraY;
    this.cameraZ = this.initialCameraZ;
    this.updateCamera();


//    this.camera.position.set(0,  this.eyeheight /*Settings.eyeHeightInMeters*/, 200);
//    this.camera.position.set(0,  50, 200);

//    this.camera.up.set(0, 1, 0);
//    this.camera.rotateY(0.1);
    // IMPORTANT: camera.lookAt only works if camera.matrixAutoUpdate is true so it must
    //    be called BEFORE setting camera.matrixAutoUpdate to false below!!!
//    this.camera.lookAt(0, 0, 0);

//    this.camera.matrixAutoUpdate = false;
//    this.camera.updateMatrix();
//    this.camera.matrixWorldNeedsUpdate = true;

    this.scene.add(this.camera);

    this.axes = Axes.axes3D({
      length: 50,
      tipRadius: 1.0,
      tipHeight: 6.0
    });
    this.axes.position.set(0,0.2,0);
    this.scene.add(this.axes);
  }

  initializeGround() {
    return Util.LoadTexture('images/asphalt.jpg')
          .then((asphalt) => {
            asphalt.repeat.set(2000, 2000);
            asphalt.wrapS = THREE.RepeatWrapping;
            asphalt.wrapT = THREE.RepeatWrapping;
            const planeMaterial = new THREE.MeshStandardMaterial({
              map: asphalt,
              side: THREE.DoubleSide
            });
            const planeGeometry = new THREE.PlaneGeometry(Settings.farPlane, Settings.farPlane);
            const plane = new THREE.Mesh(planeGeometry, planeMaterial);
            plane.rotation.x = -Math.PI / 2;
            plane.name = 'ground';
            if (Settings.shadows) {
              plane.receiveShadow = true;
            }
            plane.position.x = this.cameraX;
            plane.position.z = this.cameraZ;
            this.ground = plane;
            this.scene.add(plane);
          });
  }

  initializeSky() {
    const sb = new SkyBox();
    return sb.getObject().then(skyboxObject => {
      skyboxObject.position.x = this.cameraX;
      skyboxObject.position.z = this.cameraZ;
      this.skybox = skyboxObject;
      this.scene.add(skyboxObject);
    });
  }

  initializeBuildings(tile, tileDetails, doneFunc) {
      const url = Settings.endpoint + '?bbox=' + tile.getBBoxString();
      return fetch(url)
          .then(response => {
             return response.json();
          })
          .then(data => {
             this.processFeatures(data, tileDetails);
          })
          .then(() => {
            if (doneFunc) { doneFunc(); }
          })
          .catch(e => console.log(e));
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
   *      -numberOfLevels * AVERAGE_STOREY_HEIGHT_METERS,
   *   4. otherwise, extrude depth is set to -MINIMUM_EXTRUSION_METERS
   */
  extrudeFeature(feature, numberOfLevels, options) {
    try{
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

//  /**
//   * Puts a feature (building) on the scene.
//   * @param {string} feature A polygon geographic feature of a footprint.
//   * @param {number} numberOfLevels
//   */
//  loadFeature(feature, numberOfLevels, tileObject, options) {
//    try{
//      options = options || {};
//      const shape =
//        GeoConverter.geoPointArrayToShape(GeoConverter.wayToGeoPointArray(feature.geometry.coordinates[0]), this.sceneOrigin);
//
//      const MINIMUM_EXTRUSION_METERS = 0.01;
//
//      const extrudeSettings = {
//        depth: numberOfLevels > 0 ? -numberOfLevels * this.AVERAGE_STOREY_HEIGHT_METERS :
//                                    -MINIMUM_EXTRUSION_METERS,
//        bevelEnabled: false
//      };
//      if (feature.properties['height']) {
//        extrudeSettings.depth = -parseFloat(feature.properties['height']);
//      }
//      if (options.extrudeDepth) {
//        extrudeSettings.depth = options.extrudeDepth;
//      }
//      const mesh = this.shapeToMesh(shape, extrudeSettings, options);
//      // NOTE: id of this feature  is feature.properties.id; use that later to track this object
//      mesh.name = feature.properties.id;
//      // TODO: set visibility based on current year and the values of
//      //   feature.properties.start_date and feature.properties.end_date
//      mesh.visible = true;
//      tileObject.add(mesh);
//      //this.scene.add(mesh);
//      //xx if (!this.idToMesh[feature.properties.id]) {
//      //xx   mesh.name = feature.properties.id;
//      //xx   this.idToMesh[mesh.name] = mesh;
//      //xx   RenderView.setVisibility(
//      //xx     RenderView.extractYearFromDate(feature.properties.start_date),
//      //xx     RenderView.extractYearFromDate(feature.properties.end_date), mesh
//      //xx   );
//      //xx   this.scene.add(mesh);
//      //xx }
//    } catch (e) {
//      console.log('Error while loading feature '+ feature.id + ': ' +e);
//    }
//  }

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
      color: options.color ? options.color : Util.generateRandomGreyColor(this.BRIGHTNESS_OF_EXTRUDED_MODELS,
                                                                    this.COLOR_VARIATION_OF_EXTRUDED_MODELS),
      side: options.side == null ? THREE.DoubleSide : options.side
    });
    const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, [mat]);
    mesh.rotation.x = 90 * (Math.PI / 180);
    return mesh;
  }

  processFeatures(response, tileDetails) {
    const features = response.data;

    //console.log('got ' + features.length + ' features');
    for (let i = 0; i < features.length; i++) {

      if (features[i].properties.id in this.featureIdToBBoxString) {
        // object has already been loaded from another tile, so skip it
        continue;
      }

      let numberOfLevels = 0;
      if (features[i].properties['building:levels']) {
        numberOfLevels = features[i].properties['building:levels'];
      }

      let extrusion = null;
      if(features[i].properties['building']){
        extrusion = this.extrudeFeature(features[i], numberOfLevels, {
          //map: numberOfLevels > 0 ? checkedTexture : undefined
          map: undefined
        });
      } else if (features[i].properties['building:part']) {
        extrusion = this.extrudeFeature(features[i], numberOfLevels, {
          //map: numberOfLevels > 0 ? checkedTexture : undefined
          map: undefined
        });
      } else if (features[i].properties['sidewalk']) {
        // We currently use the same function to load and minimally extrude
        // sidewalks, that we use for buildings. This works by assuming sidewalks
        // as flat (i.e., with zero stories) buildings. Ideally we should have a
        // separate function to construct each map feature in 3D.
        extrusion = this.extrudeFeature(features[i], numberOfLevels, {
          color: new THREE.Color(0.8, 0.8, 0.8),
          extrudeDepth: -0.15,  // ~ 6 inches, in meters
          receiveShadows: true,
        });
      } else {
        console.log('feature is not supported for rendering.');
      }
      if (extrusion != null) {
        this.featureIdToBBoxString[features[i].properties.id] = tileDetails.tile.getBBoxString();
        tileDetails.object3D.add(extrusion);
        tileDetails.featureIds.push(features[i].properties.id);
      }
    }
  }

  // Request a single render pass in the next animation frame, unless one has already
  // been requested (no point in rendering twice for the same frame).
  requestRender() {
    if (this.renderRequested) {
      return;
    }
    this.renderRequested = true;
    requestAnimationFrame(() => {
      this.renderRequested = false;
      this.renderer.render( this.scene, this.camera );
      //console.log([window.performance.memory.totalJSHeapSize, window.performance.memory.usedJSHeapSize]);
    });
  }

  // Request render passes after the given promise(s) resolve.  Takes any number of arguments,
  // each of which is a promise.  A render pass will be requested after each promise resolves.
  requestRenderAfterEach(...promises) {
    promises.forEach(promise => {
      promise.then(() => {
        this.requestRender();
      });
    });
  }

  initialize() {
    // lights
    this.initializeLights();

    // camera
    this.initializeCamera(/* initial_gaze_point= */ this.scene.position);

    // action!
    this.requestRenderAfterEach(
        this.initializeGround(),
        this.initializeSky());
    this.refreshDataForNewCameraPosition();

  }
}

export {App};
