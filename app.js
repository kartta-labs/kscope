import {Axes} from "./axes.js";
import {Rect} from "./rect.js";
import {Coords} from "./coords.js";
import {EventTracker} from "./event_tracker.js";
import {GeoPoint, GeoConverter} from "./geospatial_utils.js";
import {MovingCenterFrame} from "./moving_center_frame.js";
import {Settings} from "./settings.js";
import {SkyBox} from "./skybox.js";
import {Util} from "./util.js";

class App {
  BRIGHTNESS_OF_EXTRUDED_MODELS = 0.6;
  COLOR_VARIATION_OF_EXTRUDED_MODELS = 0.1;
  AVERAGE_STOREY_HEIGHT_METERS = 4.3;

  /**
   */
  constructor(container, options) {
    this.fetchradius = ('fetchradius' in options) ? options['fetchradius'] : 2;
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
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize( this.container.offsetWidth, this.container.offsetHeight );
    this.renderer.setClearColor( 0x6666ff, 1 );
    this.container.appendChild( this.renderer.domElement );
    this.eventTracker = new EventTracker(this.container);

    this.center = new THREE.Object3D();
    this.center.position.set(0,0,0);
    this.scene.add(this.center);

    //this.raycaster = new THREE.Raycaster();

    this.idToFeatureProperties = {};

    this.movingCenterFrame = new MovingCenterFrame();

    this.eventMode = 'look';

this.frustum = new THREE.Frustum();
this.cameraViewProjectionMatrix = new THREE.Matrix4();
// baseTiles are used for 2 purposes:
//   1. display for debugging, so we can see the tile positioins on the ground (that's why they're added to the scene below)
//   2. querying to find the tile that the camera is currently in (over).  Since we don't have an implementation of inverse
//      mercator projection, we just loop over each tile to check whether the current camera position is in it.
const BASE_TILE_RADIUS = 25;
this.baseTiles = Util.tilesAt(this.sceneOriginDegrees, 2*BASE_TILE_RADIUS+1, this.tilesize);
this.baseTiles.forEach(row => {
  row.forEach(tile => {
    const a = this.coords.lonLatDegreesToSceneCoords({x: tile[0][0], y: tile[0][1]});
    const b = this.coords.lonLatDegreesToSceneCoords({x: tile[1][0], y: tile[1][1]});
    const rect = Rect.rect(a, b, {
      color: 0xffffff,
      linewidth: 3,
      y: 0.5
    });
    tile.a = a;
    tile.b = b;
    this.scene.add(rect);
    const redRect = Rect.solidRect(a, b, {
      color: 0xff0000,
      y: 0.25
    });
    const greyRect = Rect.solidRect(a, b, {
      color: 0x444444,
      y: 0.25
    });
    tile.redRect = redRect;
    tile.greyRect = greyRect;
  });
});
// keeps track of which tiles data has been requested for
this.requestedTiles = {};



    this.eventTracker.setMouseDownListener(e => {
      if (e.button == 2) {

//const cp = new THREE.Vector3();
//this.camera.getWorldPosition(cp);
////console.log(cp);
//this.axes2.position.set(cp.x, 0, cp.z);
//this.requestRender();
//
//this.cameraViewProjectionMatrix.multiplyMatrices( this.camera.projectionMatrix, this.camera.matrixWorldInverse );
//this.frustum.setFromMatrix( this.cameraViewProjectionMatrix );
//const origin = new THREE.Vector3(0,0,0);
////console.log(this.axes);
////console.log(this.frustum.intersectsObject( this.axes ));
//console.log(this.frustum.containsPoint(origin));

//xx        const screenMouse = new THREE.Vector2(e.x, e.y);
//xx        this.raycaster.setFromCamera(screenMouse, this.camera);
//xx        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
//xxconsole.log('got ' + intersects.length + ' intersections');
//xx        for (let i = 0; i < intersects.length; ++i) {
//xxconsole.log('  intersected object name: ' + intersects[i].object.name);
//xx          if (intersects[i].object.name == 'ground') {
//xx            const groundMouse = new THREE.Vector3(
//xx                intersects[i].point.x,
//xx                intersects[i].point.y,
//xx                intersects[i].point.z);
//xx            console.log(groundMouse);
//xx            break;
//xx          }
//xx        }

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
      } else if (this.eventMode == 'look') {
        const v = new THREE.Vector3(dp.y, dp.x, 0).normalize();
        const d = Math.sqrt(dp.x*dp.x + dp.y*dp.y);
        const angle = (d / this.container.offsetWidth) * Math.PI;
        const L = new THREE.Matrix4().makeRotationAxis(v, angle);
        M = this.movingCenterFrame.computeTransform(
            /* moving= */ this.camera,
            /* center= */ this.camera,
            /* frame= */ this.camera,
            L);
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
        // NYI
      } else if (e.key == 'd') {
        // NYI
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

  walkCamera(amount) {
    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);
    const lookLen = Math.sqrt(lookDir.x*lookDir.x + lookDir.z*lookDir.z);
    const step = new THREE.Vector3(amount * lookDir.x / lookLen, 0, amount * lookDir.z / lookLen);
    const L = new THREE.Matrix4().makeTranslation(step.x, step.y, step.z);
    const M = this.movingCenterFrame.computeTransform(
        /* moving= */ this.camera,
        /* center= */ this.camera,
        /* frame= */ this.scene,
        L);
    this.camera.matrix.multiplyMatrices(this.camera.matrix, M);
    this.camera.matrixWorldNeedsUpdate = true;
    this.refreshDataForNewCameraPosition();
    this.requestRender();
  }

  tileIndexUnderCamera() {
    const cameraPos = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPos);
    const cameraGroundPos = new THREE.Vector2(cameraPos.x, cameraPos.z);
    // this is really sloppy and inefficient; TODO: make it cleaner and faster
    for (let i = 0; i < this.baseTiles.length; ++i) {
      for (let j = 0; j < this.baseTiles[0].length; ++j) {
        const xmin = Math.min(this.baseTiles[i][j].a.x, this.baseTiles[i][j].b.x);
        const xmax = Math.max(this.baseTiles[i][j].a.x, this.baseTiles[i][j].b.x);
        const ymin = Math.min(this.baseTiles[i][j].a.y, this.baseTiles[i][j].b.y);
        const ymax = Math.max(this.baseTiles[i][j].a.y, this.baseTiles[i][j].b.y);
        if (xmin <= cameraGroundPos.x
            &&
            ymin <= cameraGroundPos.y
            &&
            xmax > cameraGroundPos.x
            &&
            ymax > cameraGroundPos.y) {
          return [i,j];
        }
      }
    }
    return [-1,-1];
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

  bboxQueryStringForTile(tile) {
    return tile[0][0] + ',' + tile[0][1] + ',' + tile[1][0] + ',' + tile[1][1];
  }

  refreshDataForNewCameraPosition() {
    this.cameraViewProjectionMatrix.multiplyMatrices( this.camera.projectionMatrix, this.camera.matrixWorldInverse );
    this.frustum.setFromMatrix( this.cameraViewProjectionMatrix );
    const origin = new THREE.Vector3(0,0,0);
    //console.log(this.frustum.containsPoint(origin));

    const tileIndices = this.tileIndicesNear(this.tileIndexUnderCamera(), 2*this.fetchradius+1).filter(tileIndex => {
      return (
          tileIndex[0] >= 0
          &&
          tileIndex[0] < this.baseTiles.length
          &&
          tileIndex[1] >= 0
          &&
          tileIndex[1] < this.baseTiles.length
        );
    });

    tileIndices.forEach(tileIndex => {
      const tile = this.baseTiles[tileIndex[0]][tileIndex[1]];
      const bbox = this.bboxQueryStringForTile(tile);
      // skip this tile if already requested
      if (this.requestedTiles[bbox]) { return; }
      //xxconst tileCenter = new THREE.Vector3((tile[0][0] + tile[1][0])/2, 0, (tile[1][0] + tile[1][0])/2);
      //xx// skip this tile if center not in view
      //xxif (!this.frustum.containsPoint(tileCenter)) { return; }
      this.requestedTiles[bbox] = {
        tile: tile
      };
      this.scene.add(tile.redRect);
      this.requestRender();
      //console.log('requesting data for bbox=' + bbox);
      this.requestRenderAfterEach(this.initializeBuildings(bbox, () => {
        this.scene.remove(tile.redRect);
        this.scene.add(tile.greyRect);
        this.requestRender();
      }));
    });

  }

  reportCanSeeOrigin() {
// Experiment for checking whether a location is in the viewing frustum.  This experiment checks (0,0,0) but same
// technique will work for any coords.  Can use this to decide which map tiles are visible (approximate by just
// checking visibility of tile centers?).
    this.cameraViewProjectionMatrix.multiplyMatrices( this.camera.projectionMatrix, this.camera.matrixWorldInverse );
    this.frustum.setFromMatrix( this.cameraViewProjectionMatrix );
    const origin = new THREE.Vector3(0,0,0);
    //console.log(this.frustum.containsPoint(origin));
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

  initializeCamera(initial_gaze_point) {
    this.camera = new THREE.PerspectiveCamera(
        Settings.fieldOfView,
        /* aspectRatio= */ this.container.offsetWidth/this.container.offsetHeight,
        Settings.nearPlane, Settings.farPlane);

    // Sets the camera height to human height (2m) looking to the center of the
    // scene from 10m away.
    this.camera.position.set(0,  this.eyeheight /*Settings.eyeHeightInMeters*/, 200);
    this.camera.up.set(0, 1, 0);
    // IMPORTANT: camera.lookAt only works if camera.matrixAutoUpdate is true so it must
    //    be called BEFORE setting camera.matrixAutoUpdate to false below!!!
    this.camera.lookAt(0, 0, 0);

    this.camera.matrixAutoUpdate = false;
    this.camera.updateMatrix();
    this.camera.matrixWorldNeedsUpdate = true;

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
            this.scene.add(plane);
          });
  }

  initializeSky() {
    const sb = new SkyBox();
    return sb.getObject().then(skyboxObject => {
      this.scene.add(skyboxObject);
    });
  }

  initializeBuildings(bbox, doneFunc) {
      const url = Settings.endpoint + '?bbox=' + bbox;
      return fetch(url)
          .then(response => {
             return response.json();
          })
          .then(data => {
             this.processFeatures(data);
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
  loadFeature(feature, numberOfLevels, options) {
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
      this.scene.add(mesh);
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

  processFeatures(response) {
    const features = response.data;

    //console.log('got ' + features.length + ' features');
    for (let i = 0; i < features.length; i++) {
      this.idToFeatureProperties[features[i].id] = features[i].properties;
      let numberOfLevels = 0;
      if (features[i].properties['building:levels']) {
        numberOfLevels = features[i].properties['building:levels'];
      }

      if(features[i].properties['building']){
        this.loadFeature(features[i], numberOfLevels, {
          //map: numberOfLevels > 0 ? checkedTexture : undefined
          map: undefined
        });
      } else if (features[i].properties['building:part']) {
        this.loadFeature(features[i], numberOfLevels, {
          //map: numberOfLevels > 0 ? checkedTexture : undefined
          map: undefined
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
this.reportCanSeeOrigin();
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
//        this.initializeBuildings('-74.0025,40.740981639193706,-73.9989,40.743709187058556'),
        this.initializeGround(),
        this.initializeSky());
    this.refreshDataForNewCameraPosition();

//    this.requestRenderAfterEach(
//      ...this.baseTiles.map(tile => {
//        return this.initializeBuildings(tile[0][0] + ',' + tile[0][1] + ',' + tile[1][0] + ',' + tile[1][1]);
//      })
//    );



    //this.requestRenderAfter(this.initializeBuildings());
    //this.requestRenderAfter(this.initializeGround());
    //this.requestRenderAfter(this.initializeSky());
  }
}

export {App};
