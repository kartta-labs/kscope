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

    //notyet // map whose keys are feature ids, values are the bbox string (key into bBoxStringToSceneTileDetails) for
    //notyet // the tile containing that feature
    //notyet this.featureIdToBBoxString = {};

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

  /**
   * Takes a single [i,j] tile index, and returns a list of N^2 tile indices with that one at its center.
   * Has no concept of whether the indices are valid -- will return negative indices, and arbitrarily large ones.
   * The caller should weed out any invalid ones.
   */
  tileIndicesNear(tileIndex, N) {
    const d = Math.floor(N/2);
    const ans = [];
    for (let i = 0; i < N; ++i) {
      for (let j = 0; j < N; ++j) {
        ans.push([tileIndex[0] + i - d, tileIndex[1] + j - d]);
      }
    }
    return ans;
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
        tile: tile
      };
      this.bBoxStringToSceneTileDetails[tile.getBBoxString()] = tileDetails;
      this.scene.add(tileObject);

      tileDetails.redRect = Rect.solidRect(tile.getSceneMin(), tile.getSceneMax(), {
        color: 0xff0000,
        outlinecolor: 0x000000,
        y: 0.25
      });
      this.scene.add(tileDetails.redRect);
      this.requestRender();

      this.requestRenderAfterEach(this.initializeBuildings(tile, tileObject, () => {
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
        if (tileDetails.redRect) { this.scene.remove(tileDetails.redRect); }
        if (tileDetails.greenRect) { this.scene.remove(tileDetails.greenRect); }
        delete(this.bBoxStringToSceneTileDetails[bBoxString]);
      }
    });
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
    this.camera.matrix.multiply(this.movingCenterFrame.computeTransform(
        /* moving= */ this.camera,
        /* center= */ this.camera,
        /* frame= */ this.camera,
        new THREE.Matrix4().makeRotationY(this.cameraYAngle)));
    this.camera.matrix.multiply(this.movingCenterFrame.computeTransform(
        /* moving= */ this.camera,
        /* center= */ this.camera,
        /* frame= */ this.camera,
        new THREE.Matrix4().makeRotationX(this.cameraXAngle)));
    this.camera.matrix.multiply(this.movingCenterFrame.computeTransform(
        /* moving= */ this.camera,
        /* center= */ this.camera,
        /* frame= */ this.scene,
        new THREE.Matrix4().makeTranslation(this.cameraX, this.cameraY, this.cameraZ)));

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


    this.cameraXAngle = 0;
    this.cameraYAngle = 0;
    this.cameraX = 0;
    this.cameraY = this.eyeheight;
    this.cameraZ = 200;
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
            this.ground = plane;
            this.scene.add(plane);
          });
  }

  initializeSky() {
    const sb = new SkyBox();
    return sb.getObject().then(skyboxObject => {
      this.skybox = skyboxObject;
      this.scene.add(skyboxObject);
    });
  }

  initializeBuildings(tile, root, doneFunc) {
      const url = Settings.endpoint + '?bbox=' + tile.getBBoxString();
      return fetch(url)
          .then(response => {
             return response.json();
          })
          .then(data => {
             this.processFeatures(data, root);
          })
          .then(() => {
            if (doneFunc) { doneFunc(); }
          })
          .catch(e => console.log(e));
  }


  /**
   * Puts a feature (building) on the scene.
   * @param {string} feature A polygon geographic feature of a footprint.
   * @param {number} numberOfLevels
   */
  loadFeature(feature, numberOfLevels, tileObject, options) {
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
      tileObject.add(mesh);
      //this.scene.add(mesh);
      //xx if (!this.idToMesh[feature.properties.id]) {
      //xx   mesh.name = feature.properties.id;
      //xx   this.idToMesh[mesh.name] = mesh;
      //xx   RenderView.setVisibility(
      //xx     RenderView.extractYearFromDate(feature.properties.start_date),
      //xx     RenderView.extractYearFromDate(feature.properties.end_date), mesh
      //xx   );
      //xx   this.scene.add(mesh);
      //xx }
    } catch (e) {
      console.log('Error while loading feature '+ feature.id + ': ' +e);
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
      color: options.color ? options.color : Util.generateRandomGreyColor(this.BRIGHTNESS_OF_EXTRUDED_MODELS,
                                                                    this.COLOR_VARIATION_OF_EXTRUDED_MODELS),
      side: options.side == null ? THREE.DoubleSide : options.side
    });
    const mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, [mat]);
    mesh.rotation.x = 90 * (Math.PI / 180);
    return mesh;
  }

  processFeatures(response, root) {
    const features = response.data;

    //console.log('got ' + features.length + ' features');
    for (let i = 0; i < features.length; i++) {
      let numberOfLevels = 0;
      if (features[i].properties['building:levels']) {
        numberOfLevels = features[i].properties['building:levels'];
      }

      if(features[i].properties['building']){
        this.loadFeature(features[i], numberOfLevels, root, {
          //map: numberOfLevels > 0 ? checkedTexture : undefined
          map: undefined
        });
      } else if (features[i].properties['building:part']) {
        this.loadFeature(features[i], numberOfLevels, root, {
          //map: numberOfLevels > 0 ? checkedTexture : undefined
          map: undefined
        });
      } else if (features[i].properties['sidewalk']) {
        // We currently use the same function to load and minimally extrude
        // sidewalks, that we use for buildings. This works by assuming sidewalks
        // as flat (i.e., with zero stories) buildings. Ideally we should have a
        // separate function to construct each map feature in 3D.
        this.loadFeature(features[i], numberOfLevels, root, {
          color: new THREE.Color(0.8, 0.8, 0.8),
          extrudeDepth: -0.15,  // ~ 6 inches, in meters
          receiveShadows: true,
        });
      } else {
        console.log('feature is not supported for rendering.');
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
