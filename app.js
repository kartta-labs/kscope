// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Axes} from "./axes.js";
import {Rect} from "./rect.js";
import {Colors} from "./colors.js";
import {Coords} from "./coords.js";
import {EventTracker} from "./event_tracker.js";
import {Extruder} from "./extruder.js";
import {FetchQueue} from "./fetch_queue.js";
import {Ground} from "./ground.js";
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
    this.level = ('level' in options) ? options['level'] : Settings.level;
    this.speed = ('speed' in options) ? options['speed'] : Settings.speed;
    this.debug = ('debug' in options) ? options['debug'] : Settings.debug;
    this.year = ('year' in options) ? options['year'] : Settings.year;
    const defaultCameraSceneX = ('eyex' in options) ? options['eyex'] : Settings.eyex;
    const defaultCameraSceneZ = ('eyez' in options) ? options['eyez'] : Settings.eyez;

    this.fetchQueue = new FetchQueue(400);

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

    this.initialCameraXAngle = ('pitch' in options) ? options['pitch'] : Settings.initialPitch[this.level];
    this.initialCameraYAngle = ('yaw' in options) ? options['yaw'] : 0;

    const initialCameraLonDegrees = ('lon' in options) ? options['lon'] : defaultCameraLonLatDegrees.x;
    const initialCameraLatDegrees = ('lat' in options) ? options['lat'] : defaultCameraLonLatDegrees.y;
    const initialCameraLonLatDegrees = new THREE.Vector2(initialCameraLonDegrees, initialCameraLatDegrees);
    const initialCameraSceneCoords = this.coords.lonLatDegreesToSceneCoords(initialCameraLonLatDegrees);

    this.initialCameraX = initialCameraSceneCoords.x;
    this.initialCameraY = Settings.eyeHeight[this.level];
    this.initialCameraZ = initialCameraSceneCoords.y;

    this.raycaster = new THREE.Raycaster();

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

    this.eventTracker.setMouseDownListener(e => {
      if (e.button == 2) {
        this.highlightFeatureUnderMouse(e);
      }
    }).setTouchStartListener(p => {
    }).setTouchMoveListener((p,dp) => {
      if (p.length >= 2) {
        // >= 2 touch points: rotate camera

        // t = displacement of the midpoint of the 1st two touch points, between this
        // event and the last one
        const t = new THREE.Vector2(
            (dp[0].x + dp[1].x) / 2,
            (dp[0].y + dp[1].y) / 2
        );

        const xangle = 0.25 * (t.y / this.container.offsetWidth) * Math.PI;
        const yangle = 0.25 * (t.x / this.container.offsetWidth) * Math.PI;

        this.cameraXAngle += xangle;
        this.cameraXAngle = Util.clamp(this.cameraXAngle,
                                       Settings.pitchRange[this.level].min,
                                       Settings.pitchRange[this.level].max);
        this.cameraYAngle += yangle;
        this.updateCamera();
      } else {
        // 1 touch point: translate camera

        // t = touch point displacement, between this event and the last
        const t = new THREE.Vector2(dp[0].x / this.container.offsetWidth,
                                    dp[0].y / this.container.offsetWidth);
        this.moveCamera(t);
      }
    }).setMouseUpListener(e => {
      //console.log('mouseUp: e = ', e);
    }).setMouseDragListener((p, dp, button) => {
        const xangle = (dp.y / this.container.offsetWidth) * Math.PI;
        const yangle = (dp.x / this.container.offsetWidth) * Math.PI;

        this.cameraXAngle += xangle;
        this.cameraXAngle = Util.clamp(this.cameraXAngle,
                                       Settings.pitchRange[this.level].min,
                                       Settings.pitchRange[this.level].max);
        this.cameraYAngle += yangle;
        this.updateCamera();
    }).setMouseWheelListener(e => {
      //console.log('mouseWheel: e = ', e);
    }).setKeyPressListener(e => {
      if (e.key == 'w') {
        this.walkCamera(this.speedForCameraHeight());
      } else if (e.key == 's') {
        this.walkCamera(-this.speedForCameraHeight());
      } else if (e.key == 'a') {
        this.walkCamera(this.speedForCameraHeight(), /* sideways= */true);
      } else if (e.key == 'd') {
        this.walkCamera(-this.speedForCameraHeight(), /* sideways= */true);
      }
    }).setKeyUpListener(e => {
      // noop
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

  highlightFeatureUnderMouse(e) {
    const viewportMouse = this.mouseToViewportCoords(e);
    this.raycaster.setFromCamera(viewportMouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    console.log('found ' + intersects.length + ' intersections');
    if (intersects.length > 0 && intersects[0].object.feature) {
      console.log('first one:', intersects[0].object.feature);
      const properties = intersects[0].object.feature.properties;
      Object.keys(properties).forEach(key => {
        console.log(key + ': ' + properties[key]);
      });

      this.outlinePass.selectedObjects = [ intersects[0].object ];
      this.requestRender();
    }
  }

  mouseToViewportCoords(mouse) {
    return new THREE.Vector2(
        (mouse.x / this.container.offsetWidth) * 2 - 1,
        1 - ((mouse.y-this.container.offsetTop) / this.container.offsetHeight) * 2);
  }

  //screenToGroundSceneCoords(pScreen) {
  //  const pViewport = this.screenToViewportCoords(pScreen);
  //      const pWorld = new THREE.Vector3( pViewport.x, pViewport.y, -1 ).unproject( this.camera );
  //      const cWorld = new THREE.Vector3(this.cameraX, this.cameraY, this.cameraZ);
  //      const s = cWorld.y / (cWorld.y - pWorld.y);
  //      const g = new THREE.Vector3(cWorld.x + s * (pWorld.x - cWorld.x), 0, cWorld.z + s * (pWorld.z - cWorld.z));
  //  return g;
  //}
  //
  //screenToViewportCoords(screenPoint) {
  //  return new THREE.Vector2(
  //    (2 * screenPoint.x)/this.container.offsetWidth - 1,
  //    1 - (2 * screenPoint.y)/this.container.offsetHeight
  //  );
  //}

  /*
   * Adjust to a new container size.  Call this e.g. when the browser window size changes.
   */
  resize() {
    this.renderer.setSize( this.container.offsetWidth, this.container.offsetHeight );
    this.composer.setSize( this.container.offsetWidth, this.container.offsetHeight );
    this.camera.aspect = this.container.offsetWidth / this.container.offsetHeight;
    this.camera.updateProjectionMatrix();
    this.requestRender();
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

  /*
   * Set the eye (camera) height and request a render.
   * @param {String} level 'bird' or 'street'
   */
  setLevel(level) {
    this.level = level;
    this.cameraY = Settings.eyeHeight[this.level];
    this.cameraXAngle = Settings.initialPitch[level];
    this.updateCamera();
    Util.updatePageUrl({level: level});
    this.requestRender();
  }

  speedForCameraHeight() {
     // linearly interpolate between speed at height 1.7, and 5*speed at height 85.
     return this.speed * (1.0 + 5.0 * (this.cameraY - 1.7) / (85.0 - 1.7));
  }

  moveCamera(t) {
    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);
    const lookLen = Math.sqrt(lookDir.x*lookDir.x + lookDir.z*lookDir.z);
    const speed = 50; // chosen by experimentation on a phone
    const f = speed / lookLen;
    const forwardDisplacement = new THREE.Vector2(lookDir.x, lookDir.z).multiplyScalar(f * t.y);
    const rightDisplacement = new THREE.Vector2(lookDir.z, -lookDir.x).multiplyScalar(f * t.x);
    this.cameraX += (forwardDisplacement.x + rightDisplacement.x);
    this.cameraZ += (forwardDisplacement.y + rightDisplacement.y);
    this.updateCamera();
  }

  walkCamera(amount, sideways) {
    //TODO: combine walkCamera and moveCamera functions.  They are essentially doing the same thing, except
    //walkCamera moves only along the forward/right axes, and the speeds are different.
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

  // Reset the colors in a MaterialCreator according to palette of brick/stone/concrete colors
  recolorMaterials(mtlCreator, featureId) {
    const blackColor = [0,0,0];
    const brickColor = Colors.chooseRandom("brick", featureId);
    const concreteColor = Colors.chooseRandom("concrete", featureId);

    const stoneColor = Colors.chooseRandom("stone", featureId);

    const buildingColor = Colors.chooseRandom("brickcrete", featureId);
    const windowTreatmentColor = Colors.chooseRandom("concrete", featureId + "windowTreatment");
    const roofCorniceColor = Colors.chooseRandom("concrete", featureId + "roofCornice");
    const stairColor = Colors.chooseRandom("stone", featureId);
    const doorColor = blackColor;
    const storeFrontColor = Colors.chooseRandom("concrete", featureId + "storeFront");
    const roofColor = Colors.chooseRandom("roof", featureId + "roof");

    Object.keys(mtlCreator.materialsInfo).forEach(mtlName => {
      if (mtlName.startsWith("front") || mtlName.startsWith("default")) {
        mtlCreator.materialsInfo[mtlName].ka = buildingColor;
        mtlCreator.materialsInfo[mtlName].kd = buildingColor;
        mtlCreator.materialsInfo[mtlName].ks = buildingColor;
      } else if (mtlName.startsWith("cornice")) {
        mtlCreator.materialsInfo[mtlName].ka = windowTreatmentColor;
        mtlCreator.materialsInfo[mtlName].kd = windowTreatmentColor;
        mtlCreator.materialsInfo[mtlName].ks = blackColor;
        mtlCreator.materialsInfo[mtlName].ns = 0;
      } else if (mtlName.startsWith("sill")) {
        mtlCreator.materialsInfo[mtlName].ka = windowTreatmentColor;
        mtlCreator.materialsInfo[mtlName].kd = windowTreatmentColor;
        mtlCreator.materialsInfo[mtlName].ks = blackColor;
        mtlCreator.materialsInfo[mtlName].ns = 0;
      } else if (mtlName.startsWith("roofcornice")) {
        mtlCreator.materialsInfo[mtlName].ka = roofCorniceColor;
        mtlCreator.materialsInfo[mtlName].kd = roofCorniceColor;
        mtlCreator.materialsInfo[mtlName].ks = roofCorniceColor;
        mtlCreator.materialsInfo[mtlName].ns = 0;
      } else if (mtlName.startsWith("stair")) {
        mtlCreator.materialsInfo[mtlName].ka = stairColor;
        mtlCreator.materialsInfo[mtlName].kd = stairColor;
        mtlCreator.materialsInfo[mtlName].ks = [0.2, 0.2, 0.2];
        mtlCreator.materialsInfo[mtlName].ns = 0;
      } else if (mtlName.startsWith("doorcasing")) {
        mtlCreator.materialsInfo[mtlName].ka = buildingColor;
        mtlCreator.materialsInfo[mtlName].kd = buildingColor;
      } else if (mtlName.startsWith("door")) {
        mtlCreator.materialsInfo[mtlName].ka = doorColor;
        mtlCreator.materialsInfo[mtlName].kd = doorColor;
      } else if (mtlName.startsWith("roof")) {
        mtlCreator.materialsInfo[mtlName].ka = roofColor;
        mtlCreator.materialsInfo[mtlName].kd = roofColor;
        mtlCreator.materialsInfo[mtlName].ks = roofColor;
        mtlCreator.materialsInfo[mtlName].ns = 5;
      } else if (mtlName.startsWith("storefront")) {
        mtlCreator.materialsInfo[mtlName].ka = storeFrontColor;
        mtlCreator.materialsInfo[mtlName].kd = storeFrontColor;
      } else if (mtlName.match(/^window\d+$/)) {
        mtlCreator.materialsInfo[mtlName].ka = [0.1, 0.1, 0.1];
        mtlCreator.materialsInfo[mtlName].kd = [0.1, 0.1, 0.1];
        mtlCreator.materialsInfo[mtlName].ks = [0.3, 0.3, 0.3];
        mtlCreator.materialsInfo[mtlName].ns = 10;
        mtlCreator.materialsInfo[mtlName].d = 0.85;
      }
    });
  }


  loadObjFromZipUrl(url, featureId) {
    return new Promise((resolve,reject) => {
      this.fetchQueue.fetch(url)
      .then(function (response) {
        if (response.status === 200 || response.status === 0) {
          return Promise.resolve(response.blob());
        } else {
          return Promise.reject(new Error(response.statusText));
        }
      })
      .then(JSZip.loadAsync)
      .then(zip => {
        let mtl, obj;
        zip.forEach( (path,file) => {
          if (path.endsWith(".mtl")) {
            mtl = {
              promise: file.async("text"),
              path: path
            };
          } else if (path.endsWith(".obj")) {
            obj = {
              promise: file.async("text"),
              path: path
            };
          }
        });
        if (!mtl) {
          throw new Error("No mtl file found in zip file received from url="+url);
        }
        if (!obj) {
          throw new Error("No obj file found in zip file received from url="+url);
        }
        mtl.promise.then(content => {
          const mtlLoader = new THREE.MTLLoader();
          mtlLoader.setMaterialOptions({side: THREE.DoubleSide});
          const mtlCreator = mtlLoader.parse(content, mtl.path);
          this.recolorMaterials(mtlCreator, featureId);
          obj.promise.then(content => {
            const objLoader = new THREE.OBJLoader();
            objLoader.setMaterials(mtlCreator);
            const object3D = objLoader.parse(content);
            resolve(object3D);
          }, (error) => {
            reject(new Error("Error reading obj file in zip file received from url="+url));
          });
        }, (error) => {
          reject(new Error("Error reading mtl file in zip file received from url="+url));
        });
      })
      .then(function success(text) {
        //console.log('success! text=', text);
      }, function error(e) {
        //reject(new Error('got error; e=', e));
      });
    });
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
      this.ground.maybeRecenterForCameraPosition();
    }
//xxx    if (this.ground) {
//xxx      if (Math.abs(this.ground.position.x - this.cameraX) > 500
//xxx          || Math.abs(this.ground.position.z - this.cameraZ) > 500) {
//xxx        this.ground.position.x = this.cameraX;
//xxx        this.ground.position.z = this.cameraZ;
//xxx      }
//xxx    }
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

    this.composer = new THREE.EffectComposer(this.renderer);
    this.renderPass = new THREE.RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.outlinePass = new THREE.OutlinePass(new THREE.Vector2(this.container.offsetWidth, this.container.offsetHeight), this.scene, this.camera);
    this.outlinePass.edgeStrength = 5.0;
    this.outlinePass.edgeGlow = 0.5;
    this.outlinePass.edgeThickness = 2.0;
    this.composer.addPass(this.outlinePass);

    if (this.debug) {
      this.axes = Axes.axes3D({
        length: 50,
        tipRadius: 1.0,
        tipHeight: 6.0
      });
      this.axes.position.set(0,0.2,0);
      this.scene.add(this.axes);
    }
  }

  initializeGround() {
    this.ground = new Ground(this);
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
      return this.fetchQueue.fetch(url)
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

  recursiveSetProperty(object, property, value) {
    object[property] = value;
    for (let i = 0; i < object.children.length; ++i) {
      this.recursiveSetProperty(object.children[i], property, value);
    }
  }


  processFeatures(response, tileDetails) {
    const features = response.data;

    const featuresToRequest3DModelsFor = [];

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
      } else if (features[i].properties['sidewalk'] || features[i].properties['footway'] == "sidewalk") {
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
      } else if (features[i].properties['highway']) {
        // we don't currently render highways
      } else if (features[i].properties['area:highway']) {
        // we don't currently render highways
      } else {
        console.log('feature is not supported for rendering.');
      }
      if (extrusion != null) {
        this.recursiveSetProperty(extrusion, 'feature', features[i]);
        this.featureIdToObjectDetails[features[i].properties.id] = {
          bBoxString: tileDetails.tile.getBBoxString(),
          properties: features[i].properties,
          object3D: extrusion
        };
        extrusion.visible = App.featureVisibleInYear(features[i], this.year);
        tileDetails.object3D.add(extrusion);
        tileDetails.featureIds.push(features[i].properties.id);
        featuresToRequest3DModelsFor.push(features[i]);
      }
    }
    this.fetch3DModelsAndReplaceExtrusionsIfFound(featuresToRequest3DModelsFor,tileDetails);
  }

  processTileZip(features, tileDetails, zip) {
    const buildingIdToFeature = {};
    features.forEach(feature => {
      buildingIdToFeature[feature.properties.id] = feature;
    });


    // buildingData keys will be building ids, values are objects with this structure:
    //   {
    //     mtl: {
    //       promise: <promise which resolves to contents of the contained mtl file>
    //       path: <name of the contained mtl file>
    //     }
    //     obj: {
    //       promise: <promise which resolves to contents of the contained obj file>
    //       path: <name of the contained obj file>
    //     }
    //   }
    const buildingData = {};

    // metadata will hold the contents of the "metadata.json" file in the outer zip file
    const metadata = {};

    // Create promises for reading all the objects in the outer zip file
    const promises = [];
    zip.forEach((path,file) => {
      if (path.endsWith(".json")) {
        promises.push(file.async("text").then(content => {
          const parsedMetadata = JSON.parse(content);
          Object.keys(parsedMetadata).forEach(buildingId => {
            metadata[buildingId] = parsedMetadata[buildingId];
          });
        }));
      } else if (path.endsWith(".zip")) {
        // translate inner zip file name to building id
        const buildingId = path.replace(/.zip$/, '').replace('_','/');
        // read the inner zip file contents
        promises.push(file.async("blob").then(JSZip.loadAsync).then(izip => {
          buildingData[buildingId] = {};
          izip.forEach((ipath,ifile) => {
            if (ipath.endsWith(".mtl")) {
              buildingData[buildingId].mtl = {
                promise: ifile.async("text"),
                path: path
              };
            } else if (ipath.endsWith(".obj")) {
              buildingData[buildingId].obj = {
                promise: ifile.async("text"),
                path: path
              };
            }
          });
        }));
      }
    });

    // One all the promises from the outer zip file have resolved, read the inner zip files
    // to create the actual Object3Ds.
    Promise.all(promises).then(() => {
      Object.keys(buildingData).forEach(buildingId => {
        const mtl = buildingData[buildingId].mtl;
        const obj = buildingData[buildingId].obj;
        mtl.promise.then(content => {
          const mtlLoader = new THREE.MTLLoader();
          mtlLoader.setMaterialOptions({side: THREE.DoubleSide});
          const mtlCreator = mtlLoader.parse(content, mtl.path);
          this.recolorMaterials(mtlCreator, buildingId);
          obj.promise.then(content => {
            const objLoader = new THREE.OBJLoader();
            objLoader.setMaterials(mtlCreator);
            const object3D = objLoader.parse(content);
            this.replaceExtrusionWithObject3D(buildingIdToFeature[buildingId],
                                              object3D, metadata[buildingId], tileDetails);
          }, error => {
            reject(new Error("Error reading obj file in " + obj.path));
          });
        }, error => {
          reject(new Error("Error reading mtl file in " + mtl.path));

        });
      });
    });

  }

  fetch3DModelsAndReplaceExtrusionsIfFound(features, tileDetails) {
    const buildingIds = features.map(feature => feature.properties.id);
    const url = Settings.reservoir_url + '/api/v1/download/batch/building_id/';
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        building_ids: buildingIds
      })
    })
    .then(function (response) {
      if (response.status === 200 || response.status === 0) {
        return Promise.resolve(response.blob());
      } else {
        return Promise.reject(new Error(response.statusText));
      }
    })
    .then(JSZip.loadAsync)
    .then(zip => {
      this.processTileZip(features, tileDetails, zip);
    })
    .catch(error => {
    });
  }

  replaceExtrusionWithObject3D(feature, object3D, metadata, tileDetails) {
    // If tag use_location="true", position by lon/lat from metadata.
    // Otherwise position by first vertex in footprint.
    let baseArray =
            ("use_location" in metadata.tags && metadata.tags['use_location'].toLowerCase() == "true")
            ? [metadata.location.longitude, metadata.location.latitude]
            : feature.geometry.coordinates[0][0];
    const baseSceneCoords = this.coords.lonLatDegreesToSceneCoords(new THREE.Vector2(baseArray[0], baseArray[1]));
    object3D.scale.set(
          Settings.buildingXZScaleShrinkFactor * metadata.scale,
          metadata.scale,
          Settings.buildingXZScaleShrinkFactor * metadata.scale );
    object3D.position.x = baseSceneCoords.x;
    object3D.position.y = 0;
    object3D.position.z = baseSceneCoords.y;
    tileDetails.object3D.remove(this.featureIdToObjectDetails[feature.properties.id].object3D);
    object3D.visible = App.featureVisibleInYear(feature, this.year);
    this.recursiveSetProperty(object3D, 'feature', feature);
    tileDetails.object3D.add(object3D);
    this.featureIdToObjectDetails[feature.properties.id].object3D = object3D;
    this.requestRender();
  }

  // Request a single re-render in the next possible animation frame.  Note this function does not
  // actually perform a render -- it just requests that one be done at the next possible time.
  // Calling this multiple times before the next animation frame will result in only one re-render
  // on that frame, no matter how many times it was called.
  requestRender() {
    if (this.renderRequested) {
      return;
    }
    this.renderRequested = true;
    requestAnimationFrame(() => {
      this.renderRequested = false;
//      this.renderer.render( this.scene, this.camera );
this.composer.render();
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
    this.initializeGround();

    // action!
    this.requestRenderAfterEach(this.initializeSky());
    this.requestRender();
    this.refreshDataForNewCameraPosition();
  }
}

export {App};
