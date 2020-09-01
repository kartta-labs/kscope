/**
 * @fileoverview This file contains a demo 3D visualizer for buildings in their
 * real locations. It statically loads the 3D models and then puts them in their
 * Mercator coordinates, according to their latitude and longitude values.
 */

// Hack to insure that the same random colors are used on each run.
// This uses the 'randoms' array which must be previously loaded from
// the file 'randoms.js'.
const MyMath = {
  'index': -1,
  'random': function() {
    // Returns the next random number from the 'randoms' array, cylcing around
    // when we reach the end.
    ++this.index;
    if (this.index >= randoms.length) {
      this.index = 0;
    }
    return randoms[this.index];
  }
};

import {GeoPoint} from './geospatial_utils.js';

// Global variables to setup the scene.
let camera, container, controls, scene, sceneOrigin;

// Global variables for rendering.
let renderer, effect, stereoEffect, raycaster;

// Global variables for the pointer lock controler.
let moveForward = false;
let moveBackward = false;
let moveForwardInTime = false;
let moveBackwardInTime = false;
let moveLeft = false;
let moveRight = false;
let birdsEyeView = false;
let debugMode = false;
const eyeHeightInMeters = 1.7;
const birdsHeightInMeters = 200;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const mouse = { x: 0, y: 0 };
const groundMouse = { x: 0, y: 0, z: 0};
let intersected;
let anaglyph = false;
let sideBySide = false;
let decreaseFocus = false;
let increaseFocus = false;
// Brightness of models is a number between 0 and 1, which sets the average
// brightness of 3D models color. Brightness is defined as the average of rgb
// value of a color.
//const BRIGHTNESS_OF_MODELS = 0.9;
const BRIGHTNESS_OF_MODELS = 0.4;
const ground = {object3d:null, vertices:null, holes:[{geometry:null,start_date:null,end_date:null}]};

const BRIGHTNESS_OF_EXTRUDED_MODELS = 0.6;
const COLOR_VARIATION_OF_EXTRUDED_MODELS = 0.1;

// Assumes 14 feet (4.3 meters) for each level,according to
// https://en.wikipedia.org/wiki/Storey#Overview.
const AVERAGE_STOREY_HEIGHT_METERS = 4.3;

const skyboxImages = [
    "images/py.png", // up
    "images/ny.png", // dn
    "images/px.png", // fr
    "images/nx.png", // bk
    "images/nz.png", // lf
    "images/pz.png", // rt
];

let modelIdsToIgnore = {};
external_models.forEach(e => {
  modelIdsToIgnore[e.id] = true;
});

const /** !Object<string, !Object> */ idToMesh = {};
const /** !Object<string, !Object> */ idToModel = {};
const /** !Object<string, !Object> */ idToFeatureProperties = {};
const /** !Object<string, !Object> */ idToBaseName = {};

const materialsWithTextureToToggle = [];
const materialsWithColorToToggle = [];

function toggleTextures() {
  materialsWithTextureToToggle.forEach(m => {
    const tmp = m.map;
    m.map = m.savedMap;
    m.savedMap = tmp;
    m.needsUpdate = true;
  });
}

function toggleColors() {
  materialsWithColorToToggle.forEach(m => {
    let tmp = m.color;
    m.color = m.savedColor;
    m.savedColor = tmp;
    m.needsUpdate = true;
  });
}

const /** !Element */ yearRangeSlider =
    document.getElementById('year-range-slider');
const /** !Element */ yearRangeValue =
    document.getElementById('year-range-value');
const /** !Element */ highlightedObjectName =
    document.getElementById('highlighted-object-name');

yearRangeSlider.value = settings.year;
yearRangeValue.innerText = yearRangeSlider.value;

/** Updates the scene when the year slider moves. */
function updateYearSlider() {
  yearRangeValue.innerText = yearRangeSlider.value;
  settings.year = yearRangeSlider.value;
  setSceneYear();
}
yearRangeSlider.oninput = updateYearSlider;

/**
 * A callback function to process the geographic features returned from the
 * Kartta Labs API. This function adds each feature to a map (dictionary) with
 * their IDs as the key and then loads them into the scene.
 * @param {!Object} response The response from Kartta Labs API.
 */
const processFeatures = (response) => {
  const features = response.data;

  const checkedTexture = new THREE.TextureLoader().load('images/checked.png');
  checkedTexture.repeat.set(1/10, 1/10);
  checkedTexture.offset.set(0.1, 0.5);
  checkedTexture.wrapS = THREE.RepeatWrapping;
  checkedTexture.wrapT = THREE.RepeatWrapping;

  const isExcluded = {};
  excluded_models.forEach(m => {
    isExcluded[m.id] = true;
  });

  for (let i = 0; i < features.length; i++) {
    if (isExcluded[features[i].id]) {
      continue;
    }
    idToFeatureProperties[features[i].id] = features[i].properties;
    let numberOfLevels = 0;
    if (features[i].properties['building:levels']) {
      numberOfLevels = features[i].properties['building:levels'];
    }

    if(features[i].properties['building']){
      loadFeature(features[i], numberOfLevels, {
        map: numberOfLevels > 0 ? checkedTexture : undefined
      });
    } else if (features[i].properties['sidewalk']) {
      // We currently use the same function to load and minimally extrude
      // sidewalks, that we use for buildings. This works by assuming sidewalks
      // as flat (i.e., with zero stories) buildings. Ideally we should have a
      // separate function to construct each map feature in 3D.
      loadFeature(features[i], numberOfLevels, {
        color: new THREE.Color(0.8, 0.8, 0.8),
        extrudeDepth: -0.15,  // ~ 6 inches, in meters
        receiveShadows: true,
      });
    } else if (features[i].properties['basement_walkout']) {
      loadBasementWalkout(features[i]);
    } else {
      console.log('feature is not supported for rendering.');
    }
  }
};

/**
 * Goes through all the models and sets a model visible if the current year is
 * within the start and end year of the model.
 */
const setSceneYear = () => {
  for (const [key, value] of Object.entries(idToMesh)) {
    const startYear = idToModel[key] ?
        idToModel[key].start_year :
        extractYearFromDate(idToFeatureProperties[key].start_date);
    const endYear = idToModel[key] ?
        idToModel[key].end_year :
        extractYearFromDate(idToFeatureProperties[key].end_date);
    setVisibility(startYear, endYear, idToMesh[key]);
  }
  updateGround();
};

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
function extractYearFromDate(date) {
  return date ? Number(date) : null;
}

/**
 * This functions calls the Kartta API to fetch the historical maps data.
 * @param {function(!Object)} callback Callback function to process the response returned
 *     from Kartta Labs API.
 */
function fetchFeatures(callback) {
  const url = settings.fullUrl
            ? settings.fullUrl
            : settings.endpoint + '?bbox=' + settings.bbox;
  fetch(url)
      .then(response => response.json())
      .then(data => callback(data))
      .catch(e => console.log(e));
}

/**
 * Puts a feature (building) on the scene.
 * @param {string} feature A polygon geographic feature of a footprint.
 * @param {number} numberOfLevels
 */
function loadFeature(feature, numberOfLevels, options) {
  options = options || {};
  const shape =
      geoPointArrayToShape(wayToGeoPointArray(feature.geometry.coordinates[0]));
  const MINIMUM_EXTRUSION_METERS = 0.01;

  const extrudeSettings = {
    depth: numberOfLevels > 0 ? -numberOfLevels * AVERAGE_STOREY_HEIGHT_METERS :
                                -MINIMUM_EXTRUSION_METERS,
    bevelEnabled: false
  };
  if (options.extrudeDepth) {
    extrudeSettings.depth = options.extrudeDepth;
  }
  const mesh = shapeToMesh(shape, extrudeSettings, options);
  if (!idToMesh[feature.properties.id]) {
    mesh.name = feature.properties.id;
    idToMesh[mesh.name] = mesh;
    setVisibility(
        extractYearFromDate(feature.properties.start_date),
        extractYearFromDate(feature.properties.end_date), mesh);
    scene.add(mesh);
  }
}


/**
 * Puts a basement walkout (ditch) on the scene.
 * @param {string} feature A polygon of the basement walkout.
 * @param {Object} options
 */
function loadBasementWalkout(feature) {
  const geoPoints = wayToGeoPointArray(feature.geometry.coordinates[0]);
  ground.holes.push({
    geometry:sceneCoordinatesArrayToPaths(geoPointArrayToSceneCoordinatesArray(geoPoints)),
    start_date:feature.properties.start_date,
    end_date:feature.properties.end_date});
  const shape = geoPointArrayToShape(geoPoints);
  const extrudeSettings = {
    depth: feature.properties['min_level'] * AVERAGE_STOREY_HEIGHT_METERS,
    bevelEnabled: false
  };
  const mesh = shapeToMesh(shape, extrudeSettings, {
        color: new THREE.Color(0.7, 0.7, 0.7),
        receiveShadows: true,
        side: THREE.FrontSide,  // TODO(sasantv): Why not BackSide?!
      });
  if (!idToMesh[feature.properties.id]) {
    mesh.name = feature.properties.id;
    idToMesh[mesh.name] = mesh;
    setVisibility(
        extractYearFromDate(feature.properties.start_date),
        extractYearFromDate(feature.properties.end_date), mesh);
    mesh.position.y += extrudeSettings.depth;
    scene.add(mesh);
  }
  updateGround();
}

/**
 * Converts a way (array of points) to an array of GeoPoints.
 * @param {!Array<!Array<number>>} way An array of geographic points.
 * @return {!Array<!GeoPoint>}
 */
function wayToGeoPointArray(way) {
  const toMicroDegree = 1e6;
  return way.map((point) => {
    return new GeoPoint(point[1] * toMicroDegree, point[0] * toMicroDegree);
  });
}

/**
 * Converts an array of geopoints to an array of scene coordinates.
 * @param {!Array<!Array<number>>} geoPointArray An array of geopoints.
 * @return {!Array<!GeoPoint>}
 */
function geoPointArrayToSceneCoordinatesArray(geoPointArray) {
  return geoPointArray.map((point) => {
    const x = (point.getMercatorXfromLongitude() -
               sceneOrigin.getMercatorXfromLongitude()) /
        point.getOneMeterInMercatorUnit();
    const z = -(point.getMercatorYfromLatitude() -
                sceneOrigin.getMercatorYfromLatitude()) /
        point.getOneMeterInMercatorUnit();
    return new THREE.Vector2(x, z);
  });
}

/**
 * Converts array scene coordinates to a path.
 * @param {Object} geoPointArray
 * @return {Object}
 */
function sceneCoordinatesArrayToPaths(coordinates) {
  var path = new THREE.Path();
  path.currentPoint.set(coordinates[0].x, -coordinates[0].y);
  for(let i=1; i<coordinates.length ; i++) {
    path.lineTo(coordinates[i].x, -coordinates[i].y);
  }
  return path;
}


/**
 * Converts an array of GeoPoints to a shape.
 * @param {!Array<!GeoPoint>} geoPointArray
 * @return {!THREE.Shape}
 */
function geoPointArrayToShape(geoPointArray) {
  return new THREE.Shape(geoPointArrayToSceneCoordinatesArray(geoPointArray));
}

/**
 * Extrudes a shape to create a Mesh.
 * @param {!THREE.Shape} shape
 * @param {!Object} extrudeSettings
 * @param {?Object} options
 * @return {!THREE.Mesh}
 */
function shapeToMesh(shape, extrudeSettings, options) {
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  // Nudge extruded objects up off the ground plane just a tad; this prevents objects
  // with height 0 from flickering due to being exactly coplanar with the ground.
  geometry.vertices.forEach(v => {
    v.z -= 0.02;
  });

  options = options || {};
  const mat = new THREE.MeshPhongMaterial({
    color: options.color ? options.color : generateRandomGreyColor(BRIGHTNESS_OF_EXTRUDED_MODELS,
                                                                   COLOR_VARIATION_OF_EXTRUDED_MODELS),
    side: options.side == null ? THREE.DoubleSide : options.side
,  });
  if (options.map) {
    mat['savedMap'] = options.map;
  }
  materialsWithTextureToToggle.push(mat);

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

/**
 * Generates a random color with a given brightness. It does not follow the most
 * accurate implementation.
 * @param {number} brightness a number between 0 and 1.
 * @return {!THREE.Color}
 */
function generateRandomColor(brightness) {
  brightness = Math.min(1, Math.max(0, brightness));
  return new THREE.Color().fromArray(Array(3).fill().map(
      () => (Math.min(
          1,
          Math.max(
              0, brightness + (1 - brightness) * (MyMath.random() - 0.5))))));
}

function generateRandomGreyColor(brightness, variation) {
  brightness = Math.min(1, Math.max(0, brightness));
  const v = Math.min(1, Math.max(0, brightness + 2 * (MyMath.random() - 0.5) * variation));
  return new THREE.Color(v,v,v);
}

/**
 * Sets a model visible if the current year is within the start and end date of
 * the model.
 * @param {?number} startYear
 * @param {?number} endYear
 * @param {!THREE.Object} object
 */
function setVisibility(startYear, endYear, object) {
  startYear = startYear || 0;
  endYear = endYear || 10000;
  if (startYear <= settings.year && endYear >= settings.year) {
    if (!object.visible) {
      appear(object);
    }
  } else {
    if (object.visible) {
      disappear(object);
    }
  }
}

/**
 * Hides the model.
 * @param {!Model} model
 */
function disappear(model) {
  model.visible = false;
}

/**
 * Makes the model visible.
 * @param {!Model} model
 */
function appear(model) {
  model.visible = true;
}

/**
 * Loads the skybox.
 * @param {function()} callback Function to construct a cube and put the
 *     textures on it.
 */
function loadSkyboxTextures(callback) {
  let remainingTexturesToLoad = 0;
  for (let i = 0; i < skyboxImages.length; i++) {
    const src = skyboxImages[i];
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
    skyboxImages[i] =
        new THREE.MeshBasicMaterial({
            map: texture,
            //color: 0x111199,
            side: THREE.BackSide
        });
  }
}

/** Initializes the scene. */
function initializeScene() {
  sceneOrigin = new GeoPoint(
      settings.origin.latitudeInMicroDegrees,
      settings.origin.longitudeInMicroDegrees);
  container = document.createElement('div');
  document.body.appendChild(container);

  scene = new THREE.Scene();

  const aspectRatio = window.innerWidth / window.innerHeight;
  const farPlane = settings.farPlane;

  camera = new THREE.PerspectiveCamera(
      settings.fieldOfView, aspectRatio, settings.nearPlane, farPlane);
  window.camera = camera;
  window.campos = function() {
    console.log(JSON.stringify({
      'position': camera.position,
      'quaternion': camera.quaternion
    }));
  };
  window.setcam = function(data) {
    camera.position.set(data.position.x, data.position.y, data.position.z);
    camera.quaternion.set(data.quaternion._x, data.quaternion._y, data.quaternion._z, data.quaternion._w);
    renderer.render(scene, camera);
  };
  window.pos1 = function() {
    window.setcam({"position":{"x":-62.74373752945555,"y":1.7,"z":-98.4283966378731},"quaternion":{"_x":0.07765527700597293,"_y":0.04265383303527223,"_z":-0.00332539103962019,"_w":0.9960618706962727}});
  };
  // Sets the camera height to human height (2m) looking to the center of the
  // scene from 10m away.
  camera.position.set(0, eyeHeightInMeters, -10);
  scene.add(camera);
  camera.lookAt(scene.position);

  // Add ambient lights.
  settings.lights.Ambient.forEach((item) => {
    scene.add(new THREE.AmbientLight(item.color, item.intensity));
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
        scene.add(light);
      }
      if (item.addOppositeLight) {
        const dimmingFactor = 0.1;
        const oppositeLight = new THREE.DirectionalLight(
            item.color, item.intensity * dimmingFactor);
        oppositeLight.position.set(
                -item.position.x, item.position.y, -item.position.z);
        scene.add(oppositeLight);
      }
    });
  } else {
    settings.lights.directional.forEach((item) => {
      const light = new THREE.DirectionalLight(item.color, item.intensity);
      light.position.set(item.position.x, item.position.y, item.position.z);
      scene.add(light);
    });
  }

  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (settings.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  renderer.gammaInput = true;
  renderer.gammaOutput = true;

  effect = new THREE.AnaglyphEffect(renderer);
  effect.setSize(window.innerWidth, window.innerHeight);

  stereoEffect = new THREE.StereoEffect(renderer);
  stereoEffect.setSize(window.innerWidth, window.innerHeight);

  controls = new THREE.PointerLockControls(camera, document.body);
  scene.add(controls.getObject());

  const blocker = document.getElementById('blocker');
  const instructions = document.getElementById('instructions');
  instructions.addEventListener('click', () => {
    controls.lock();
  }, false);
  controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
    blocker.style.display = 'none';
  });
  controls.addEventListener('unlock', () => {
    blocker.style.display = 'block';
    instructions.style.display = '';
  });

  // skybox
  loadSkyboxTextures(() => {
    // Skybox cube size is, conservatively, set to the half of the Camera
    // frustrum far plane, such that the skybox is always visible.
    const geometry =
        new THREE.BoxGeometry(farPlane / 2.0, farPlane / 2.0, farPlane / 2.0);
    const cube = new THREE.Mesh(geometry, [
      skyboxImages[2],
      skyboxImages[3],
      skyboxImages[0],
      skyboxImages[1],
      skyboxImages[5],
      skyboxImages[4],
    ]);
    cube.position.x = 0;
    cube.position.y = 0;
    cube.position.z = 0;
    cube.name = 'skybox';
    scene.add(cube);
  });

  //const planeGeometry = new THREE.PlaneGeometry(farPlane, farPlane);
  ground.vertices = [];
  ground.vertices.push(new THREE.Vector2(-farPlane, -farPlane));
  ground.vertices.push(new THREE.Vector2(-farPlane, +farPlane));
  ground.vertices.push(new THREE.Vector2(+farPlane, +farPlane));
  ground.vertices.push(new THREE.Vector2(+farPlane, -farPlane));
  const planeShape = new THREE.Shape(ground.vertices);
  const planeGeometry = new THREE.ShapeGeometry(planeShape);

  const asphalt = new THREE.TextureLoader().load('images/asphalt.jpg');
  asphalt.repeat.set(0.5, 0.5);
  asphalt.wrapS = THREE.RepeatWrapping;
  asphalt.wrapT = THREE.RepeatWrapping;
  const planeMaterial = new THREE.MeshStandardMaterial({map: asphalt});
  ground.object3d = new THREE.Mesh(planeGeometry, planeMaterial);
  ground.object3d.rotation.x = -Math.PI / 2;
  ground.object3d.name = 'ground';
  if (settings.shadows) {
    ground.object3d.receiveShadow = true;
  }
  ground.holes = [];
  updateGround();
  scene.add(ground.object3d);

  raycaster = new THREE.Raycaster();

  document.addEventListener('mousemove', (event) => {
    event.preventDefault();
    // Linearly transform the mouse position on screen to ±1 in x and y
    // directions. Note that the input mouse y-axis from the mousemove event is
    // downward but the output needs to be upward for the raycaster.
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -((event.clientY-container.offsetTop) / window.innerHeight) * 2 + 1;
  }, false);

  const keyEvent = (event, keyIsDown) => {
    switch (event.keyCode) {
      case 38:  // up
      case 87:  // w
        moveForward = keyIsDown;
        break;
      case 37:  // left
      case 65:  // a
        moveLeft = keyIsDown;
        break;
      case 40:  // down
      case 83:  // s
        moveBackward = keyIsDown;
        break;
      case 39:  // right
      case 68:  // d
        moveRight = keyIsDown;
        break;
      case 189:  // -
        decreaseFocus = keyIsDown;
        break;
      case 187:  // +
        increaseFocus = keyIsDown;
        break;
    }
  };

  document.addEventListener('keydown', (event) => {
    keyEvent(event, true);
  }, false);
  document.addEventListener('keyup', (event) => {
    keyEvent(event, false);
  }, false);

  document.addEventListener('keypress', (event) => {
    switch (event.keyCode) {
      case 33:  // !
        birdsEyeView = !birdsEyeView;
        if (!birdsEyeView) {
          camera.position.x = groundMouse.x;
          camera.position.y = groundMouse.y;
          camera.position.z = groundMouse.z;
        }
        onWindowResize();
        break;
      case 49:  // 1
        birdsEyeView = !birdsEyeView;
        onWindowResize();
        break;
      case 50:  // 2
        anaglyph = !anaglyph;
        onWindowResize();
        sideBySide = false;
        break;
      case 51:  // 3
        sideBySide = !sideBySide;
        onWindowResize();
        anaglyph = false;
        break;
      case 48:  // 0
        debugMode = !debugMode;
        toggleTextures();
        toggleColors();
        if(!debugMode) highlightedObjectName.innerText = '';
        break;
      case 113:  // q
        moveBackwardInTime = true;
        break;
      case 101:  // e
        moveForwardInTime = true;
        break;
    }
  }, false);

  container.appendChild(renderer.domElement);
  window.addEventListener('resize', onWindowResize, false);
}

/**
 * Creates the ground of the scene.
 */
function updateGround() {
  const shape = new THREE.Shape(ground.vertices);
  let holes = [];
  for (const hole of ground.holes) {
    const startYear = extractYearFromDate(hole.start_date) || 0;
    const endYear = extractYearFromDate(hole.end_date) || 10000;
    if (startYear <= settings.year && endYear >= settings.year) {
      holes.push(hole.geometry);
    }
  }
  shape.holes = holes;

  ground.object3d.geometry = new THREE.ShapeGeometry(shape);
}

/** Loads all the 3D models and puts them into the scene. */
function load3dModels(onComplete) {
  models.forEach(m => {
    const words = m['obj'].replace('.obj','').split('/');
    idToBaseName[m['id']] = words[words.length-1];
  });

  const all_models = external_models.concat(models.filter(m => { return !modelIdsToIgnore[m.id]; }));

  const loadingContext = {
    'onComplete': onComplete,
    'numModels': all_models.length
  };
  for (let i = 0; i < all_models.length; i++) {
    idToModel[getModelUniqueId(all_models[i])] = all_models[i];
    load3dModel(all_models[i], loadingContext);
  }
}

/** Loads a 3D model and puts it into the scene. */
function load3dModel(model, loadingContext) {
  let onProgress = (xhr) => {
    if (xhr.lengthComputable) {
      const percentComplete = xhr.loaded / xhr.total * 100;
      //console.log(Math.round(percentComplete, 2) + '% downloaded');
    }
  };

  let modelFinished = () => {
    --loadingContext.numModels;
    if (loadingContext.numModels == 0) {
      if (loadingContext.onComplete) {
        loadingContext.onComplete();
      }
      loadingContext.onComplete = null;
    }
  };

  let onError = (error) => {
    console.log('Failed to load the model');
    modelFinished();
  };

  let modelOrigin =
      new GeoPoint(model.latitudeInMicroDegrees, model.longitudeInMicroDegrees);
  //let manager = new THREE.LoadingManager();
  let mtlLoader = new THREE.MTLLoader(/*manager*/);
  mtlLoader.crossOrigin = '';
  mtlLoader.setMaterialOptions({side: THREE.DoubleSide});
  mtlLoader.load(model.mtl, (materials) => {
    let objLoader = new THREE.OBJLoader(/*manager*/);
    objLoader.crossOrigin = '';

    let facadeColor = generateRandomColor(BRIGHTNESS_OF_MODELS).toArray();

    if (materials.materialsInfo.facade) {
      materials.materialsInfo.facade.ka = facadeColor;
      materials.materialsInfo.facade.kd = facadeColor;
    }
    if (materials.materialsInfo.windowedFacade) {
      materials.materialsInfo.windowedFacade.ka = facadeColor;
      materials.materialsInfo.windowedFacade.kd = facadeColor;
    }

    objLoader.setMaterials(materials).load(model.obj, (object) => {
      object.scale.set(
          settings.buildingXZScaleShrinkFactor * model.scaleToMeters,
          model.scaleToMeters,
          settings.buildingXZScaleShrinkFactor * model.scaleToMeters);
      object.position.x = (modelOrigin.getMercatorXfromLongitude() -
                           sceneOrigin.getMercatorXfromLongitude()) /
          modelOrigin.getOneMeterInMercatorUnit();
      object.position.z = -(modelOrigin.getMercatorYfromLatitude() -
                            sceneOrigin.getMercatorYfromLatitude()) /
          modelOrigin.getOneMeterInMercatorUnit();
      object.position.y = model.altitudeInMeters;

      object.rotation.y = Math.PI / 180 * model.angleToNorthInDegrees;
      setVisibility(model.start_year, model.end_year, object);
      object.traverse(child => {
        if (child instanceof THREE.Mesh) {
          if (settings.shadows) {
            child.castShadow = true;
            child.receiveShadow = settings.buildingsReceiveShadows;
          }
//          child.material.color = generateRandomColor(BRIGHTNESS_OF_MODELS);
          // Activate the following line to investigate normals.
          // child.material = new THREE.MeshNormalMaterial();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => {
              if (m.map) {
                m.savedMap = m.map;
                m.map = undefined;
                materialsWithTextureToToggle.push(m);
                materialsWithColorToToggle.push(m);
              }
            });
          } else {
            if (child.material.map) {
              child.material.savedMap = child.material.map;
              child.material.map = undefined;
              materialsWithTextureToToggle.push(child.material);
              materialsWithColorToToggle.push(child.material);
            }
          }
        }
      });

      object.name = getModelUniqueId(model);
      idToMesh[object.name] = object;
      scene.add(object);
      modelFinished();
    }, onProgress, onError);
  });
}

/**
 * Returns a unique id for the 3D model.
 * @param {!Model} model
 * @return {string}
 */
function getModelUniqueId(model) {
  return model.id;
}

/** Updates the camera if the window is resized. */
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/** Runs every frame to animate the scene. */
function animate() {
  requestAnimationFrame(animate);

  if (controls.isLocked === true) {
    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();
    if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;
    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    prevTime = time;
  }

  if (moveForwardInTime) {
    yearRangeSlider.value++;
    updateYearSlider();
    moveForwardInTime = false;
  }

  if (moveBackwardInTime) {
    yearRangeSlider.value--;
    updateYearSlider();
    moveBackwardInTime = false;
  }

  if (increaseFocus) {
    const FOCUS_INCREMENT = 0.005;
    camera.focus *= 1.0 + FOCUS_INCREMENT;
    console.log(Math.round(camera.focus * 100) / 100);
  }

  if (decreaseFocus) {
    camera.focus *= 1.0 - FOCUS_INCREMENT;
    console.log(Math.round(camera.focus * 100) / 100);
  }

  if (anaglyph) {
    effect.render(scene, camera);
  } else if (sideBySide) {
    stereoEffect.render(scene, camera);
  } else {
    renderer.render(scene, camera);
  }
  camera.position.y = birdsEyeView ? birdsHeightInMeters : eyeHeightInMeters;

  // Find intersections.
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  for (let i = 0; i < intersects.length; ++i) {
    if (intersects[i].object.name == 'ground') {
      // mouse is over this ground plane position in world coords:
      groundMouse.x = intersects[i].point.x;
      groundMouse.y = intersects[i].point.y;
      groundMouse.z = intersects[i].point.z;
      break;
    }
  }

  if (debugMode) {
    if (intersects.length > 0 && intersects[0].object.name != 'ground') {
      if (intersected != intersects[0].object) {
        if (intersected) intersected.material.color = intersected.originalColor;
        intersected = intersects[0].object;
        highlightedObjectName.innerText = 'id: ' + intersected.parent.name + ' ['
              + idToBaseName[intersected.parent.name] + ']';
        intersected.originalColor = intersected.material.color;
        intersected.material.color = new THREE.Color('aqua');
      }
    } else {
      if (intersected) intersected.material.color = intersected.originalColor;
      highlightedObjectName.innerText = 'id:';
      intersected = null;
    }
  }
}

initializeScene();

// Load the buildings in models.js.
load3dModels(() => {
  // Wait to fetch/load features until all models have been loaded.
  // TODO: redo this using promises.  For now this quick-and-dirty
  // callback trick will do.
  fetchFeatures(processFeatures);
});

animate();
