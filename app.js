import {Axes} from "./axes.js";
import {Rect} from "./rect.js";
import {Coords} from "./coords.js";
import {EventTracker} from "./event_tracker.js";
import {Extruder} from "./extruder.js";
import {MovingCenterFrame} from "./moving_center_frame.js";
import {Settings} from "./settings.js";
import {SkyBox} from "./skybox.js";
import {Util} from "./util.js";
import {Tile, Tiler} from "./tiles.js";

class App {
  /**
   */
  constructor(container, options) {
    this.fetchradius = ('fetchradius' in options) ? options['fetchradius'] : Settings.fetchradius;
    this.dropradius = ('dropradius' in options) ? options['dropradius'] : Settings.dropradius;
    this.tilesize = ('tilesize' in options) ? options['tilesize'] : Settings.tilesize;
    this.eyeheight = ('eyeheight' in options) ? options['eyeheight'] : Settings.eyeheight;
    this.speed = ('speed' in options) ? options['speed'] : Settings.speed;
    this.debug = ('debug' in options) ? options['debug'] : Settings.debug;
    this.year = ('year' in options) ? options['year'] : Settings.year;
    const defaultCameraSceneX = ('eyex' in options) ? options['eyex'] : Settings.eyex;
    const defaultCameraSceneZ = ('eyez' in options) ? options['eyez'] : Settings.eyez;

    this.renderRequested = false;
    this.container = container;
    this.camera = null;
    this.scene = new THREE.Scene();
    this.sceneOriginDegrees = new THREE.Vector2(Settings.origin.longitudeInMicroDegrees / 1.0e6,
                                                Settings.origin.latitudeInMicroDegrees / 1.0e6);
    this.coords = new Coords(this.sceneOriginDegrees);
    this.extruder = new Extruder(this.coords);

    const defaultCameraSceneCoords = new THREE.Vector2(defaultCameraSceneX, defaultCameraSceneZ);
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


    // map whose keys are bbox strings, value is an object giving details about the corresponding data tile
    this.bBoxStringToSceneTileDetails = {
      // "-74.002,40.742,-74.001,40.743": {
      //    tile: the Tile instance for the tile
      //    object3D: the THREE.Object3D instance containing the scene objects for the tile
      //    featureIds: list of the ids of all features loaded for this tile
      // }
    };

    // map whose keys are feature ids, values is an object giving details about that feature
    this.featureIdToObjectDetails = {
      // "way/52343423": {
      //   bBoxString: the bbox string of the tile containing this feature
      //   properties: the properties object for the feature
      //   object3D: the THREE.Object3D instance in the scene for this feature
      // }
    };

    this.center = new THREE.Object3D();
    this.center.position.set(0,0,0);
    this.scene.add(this.center);

    this.movingCenterFrame = new MovingCenterFrame();

    this.eventMode = 'look';

    this.eventTracker.setMouseDownListener(e => {
      if (e.button == 2) {
        // noop
      }
    }).setMouseUpListener(e => {
      //console.log('mouseUp: e = ', e);
    }).setMouseDragListener((p, dp, button) => {
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

  static featureVisibleInYear(feature, year) {
    const start_date =
      ('start_date' in feature.properties)
      ? parseInt(feature.properties['start_date'])
      : 0;
    const end_date =
      ('end_date' in feature.properties)
      ? parseInt(feature.properties['end_date'])
      : 10000;
    return start_date <= year && year < end_date;
  }

  /*
   * Set the current year, update the visibility of all objects accordingly, and request a render.
   */
  setYear(year) {
    this.year = year;
    Object.keys(this.featureIdToObjectDetails).forEach(featureId => {
      const objectDetails = this.featureIdToObjectDetails[featureId];
      objectDetails.object3D.visible = App.featureVisibleInYear(objectDetails, year);
    });
    this.requestRender();
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
          delete(this.featureIdToObjectDetails[featureId]);
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

    const cameraSceneCoords = new THREE.Vector2(this.cameraX, this.cameraZ);
    const cameraLonLatDegrees = this.coords.sceneCoordsToLatLonDegrees(cameraSceneCoords);
    Util.updatePageUrl({
      lon: cameraLonLatDegrees.x,
      lat: cameraLonLatDegrees.y,
      pitch: this.cameraXAngle,
      yaw: this.cameraYAngle
    });

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

  initializeCamera() {
    this.camera = new THREE.PerspectiveCamera(
        Settings.fieldOfView,
        /* aspectRatio= */ this.container.offsetWidth/this.container.offsetHeight,
        Settings.nearPlane, Settings.farPlane);

    this.cameraXAngle = this.initialCameraXAngle;
    this.cameraYAngle = this.initialCameraYAngle;
    this.cameraX = this.initialCameraX;
    this.cameraY = this.initialCameraY;
    this.cameraZ = this.initialCameraZ;
    this.updateCamera();

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


  processFeatures(response, tileDetails) {
    const features = response.data;

    for (let i = 0; i < features.length; i++) {

      if (features[i].properties.id in this.featureIdToObjectDetails) {
        // object has already been loaded from another tile, so skip it
        continue;
      }

      let numberOfLevels = 0;
      if (features[i].properties['building:levels']) {
        numberOfLevels = features[i].properties['building:levels'];
      }

      let extrusion = null;
      if(features[i].properties['building']){
        extrusion = this.extruder.extrudeFeature(features[i], numberOfLevels, {
          //map: numberOfLevels > 0 ? checkedTexture : undefined
          map: undefined,
          averageStoreyHeightMeters: Settings.averageStoreyHeightMeters,
          minimumExtrusionMeters: Settings.minimumExtrusionMeters,
          brightnessOfExtrudedModels: Settings.brightnessOfExtrudedModels,
          colorVariationOfExtrudedModels: Settings.colorVariationOfExtrudedModels
        });
      } else if (features[i].properties['building:part']) {
        extrusion = this.extruder.extrudeFeature(features[i], numberOfLevels, {
          //map: numberOfLevels > 0 ? checkedTexture : undefined
          map: undefined,
          averageStoreyHeightMeters: Settings.averageStoreyHeightMeters,
          minimumExtrusionMeters: Settings.minimumExtrusionMeters,
          brightnessOfExtrudedModels: Settings.brightnessOfExtrudedModels,
          colorVariationOfExtrudedModels: Settings.colorVariationOfExtrudedModels
        });
      } else if (features[i].properties['sidewalk']) {
        // We currently use the same function to load and minimally extrude
        // sidewalks, that we use for buildings. This works by assuming sidewalks
        // as flat (i.e., with zero stories) buildings. Ideally we should have a
        // separate function to construct each map feature in 3D.
        extrusion = this.extruder.extrudeFeature(features[i], numberOfLevels, {
          color: new THREE.Color(0.8, 0.8, 0.8),
          extrudeDepth: -0.15,  // ~ 6 inches, in meters
          receiveShadows: true,
          averageStoreyHeightMeters: Settings.averageStoreyHeightMeters,
          minimumExtrusionMeters: Settings.minimumExtrusionMeters,
          brightnessOfExtrudedModels: Settings.brightnessOfExtrudedModels,
          colorVariationOfExtrudedModels: Settings.colorVariationOfExtrudedModels
        });
      } else {
        console.log('feature is not supported for rendering.');
      }
      if (extrusion != null) {
        this.featureIdToObjectDetails[features[i].properties.id] = {
          bBoxString: tileDetails.tile.getBBoxString(),
          properties: features[i].properties,
          object3D: extrusion
        };
        extrusion.visible = App.featureVisibleInYear(features[i], this.year);
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
    this.initializeCamera();

    // action!
    this.requestRenderAfterEach(
        this.initializeGround(),
        this.initializeSky());
    this.refreshDataForNewCameraPosition();

  }
}

export {App};
