/**
 * @fileoverview This file contains a demo 3D visualizer for buildings in their
 * real locations. It statically loads the 3D models and then puts them in their
 * Mercator coordinates, according to their latitude and longitude values.
 */

import {RenderView} from "./render_view.js";
import {GeoPoint} from "./geospatial_utils.js";

// Global variables to setup the scene.
let camera, container, controls, currentScene, renderView;

// Global variables for rendering.
let renderer, raycaster;

// Global variables for the pointer lock controler.
let moveForward = false;
let moveBackward = false;
let moveForwardInTime = false;
let moveBackwardInTime = false;
let moveLeft = false;
let moveRight = false;

let birdsEyeView = false;
const eyeHeightInMeters = 1.7;
const birdsHeightInMeters = 200;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const mouse = { x: 0, y: 0 };
const groundMouse = { x: 0, y: 0, z: 0};
let intersected;
let decreaseFocus = false;
let increaseFocus = false;
// Brightness of models is a number between 0 and 1, which sets the average
// brightness of 3D models color. Brightness is defined as the average of rgb
// value of a color.
//const BRIGHTNESS_OF_MODELS = 0.9;


let debugMode = false;

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
  renderView.setSceneYear();
}
yearRangeSlider.oninput = updateYearSlider;

function initialize() {
  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (settings.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  renderer.gammaInput = true;
  renderer.gammaOutput = true;
  const farPlane = settings.farPlane;
  const aspectRatio = window.innerWidth / window.innerHeight;

  camera = new THREE.PerspectiveCamera(
      settings.fieldOfView, aspectRatio, settings.nearPlane, farPlane);
  camera.position.set(0, eyeHeightInMeters, -10);
  // camera.lookAt(currentScene.position);

  controls = new THREE.PointerLockControls(camera, document.body);
  currentScene.add(controls.getObject());

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

  raycaster = new THREE.Raycaster();
  container = document.createElement('div');
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
      case 48:  // 0
        debugMode = !debugMode;
        renderView.toggleTextures();
        renderView.toggleColors();
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

  // TODO: Figure out why container.appendChild doesn't work.
  // container.appendChild(renderer.domElement);
  document.body.appendChild( renderer.domElement );

  window.addEventListener('resize', onWindowResize, false);
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

  renderer.render(currentScene, camera);

  camera.position.y = birdsEyeView ? birdsHeightInMeters : eyeHeightInMeters;

  // Find intersections.
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(currentScene.children, true);

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
        highlightedObjectName.innerText = 'id: ' + intersected.parent.name;
        intersected.originalColor = intersected.material.color;
        intersected.material.color = new THREE.Color('aqua');
      }
    } else {
      if (intersected) intersected.material.color = intersected.originalColor;
      highlightedObjectName.innerText = 'id:';
      intersected = null;
    }
  }
  slippy.watch(controls.getObject().position,
  () => {
    renderView = slippy.currentRenderView;
    renderView.setSceneYear();
    currentScene.remove(controls.getObject());
    currentScene = renderView.scene;
    currentScene.add(controls.getObject());
  });
}

class Slippy {
  constructor(settings) {
    this.widthMercatorX = 0.00002;
    this.heightMercatorY = this.widthMercatorX;
    this.overlap = 0.25;

    this.settings = settings;
    this.currentTileCenter = Slippy.toGeoPoint(settings.origin);
    this.currentBbox = this.createTileBbox(this.currentTileCenter);
    this.currentRenderView = new RenderView(this.settings);
    Slippy.fetchFeatures(this.currentRenderView, this.currentBbox);
    this.renderViews = {};
    this.renderViews[this.currentBbox] = this.currentRenderView;
  }

  static toGeoPoint(point) {
    return new GeoPoint(
      point.latitudeInMicroDegrees,
      point.longitudeInMicroDegrees);
  }

  createTileBbox(position) {
    const mercatorX = position.getMercatorXfromLongitude();
    const mercatorY = position.getMercatorYfromLatitude();

    const nonOverlappingTileWidthMercatorX = (1.0 - this.overlap) * this.widthMercatorX;
    const nonOverlappingTileHeightMercatorY = (1.0 - this.overlap) * this.heightMercatorY;

    const tileCenterMercatorX = (Math.floor(mercatorX / nonOverlappingTileWidthMercatorX) + 0.5) * nonOverlappingTileWidthMercatorX;
    const tileCenterMercatorY = (Math.floor(mercatorY / nonOverlappingTileHeightMercatorY) + 0.5) * nonOverlappingTileHeightMercatorY;

    const bottomLeftMercatorX = tileCenterMercatorX - this.widthMercatorX/2;
    const bottomLeftMercatorY = tileCenterMercatorY - this.heightMercatorY/2;
    const topRightMercatorX = tileCenterMercatorX + this.widthMercatorX/2;
    const topRightMercatorY = tileCenterMercatorY + this.heightMercatorY/2;
    const bottomLeft = new GeoPoint(0,0);
    bottomLeft.resetFromMecator(bottomLeftMercatorX, bottomLeftMercatorY);
    const topRight = new GeoPoint(0,0);
    topRight.resetFromMecator(topRightMercatorX, topRightMercatorY);

    const bbox = [bottomLeft.getLongitudeInDegrees(), bottomLeft.getLatitudeInDegrees(), topRight.getLongitudeInDegrees(), topRight.getLatitudeInDegrees()].join();
    return bbox;
  }

  createNewRenderView(center) {
    const renderView = new RenderView(this.settings);
    const bbox = this.createTileBbox(center);
    Slippy.fetchFeatures(renderView, bbox);
    this.renderViews[bbox] = renderView;
    return renderView;
  }

  deleteRenderView(center) {
    return;
    const bbox = this.createTileBbox(center);
    const renderView = this.renderViews[bbox];
    const scene = renderView.scene;
    // TODO: Traverse scene and dispose() all objects,
    // materials, textures, etc.
  }

  setRenderViewIfReady(geoPosition) {
    const bbox = this.createTileBbox(geoPosition)
    if (!(bbox in this.renderViews)) {
        this.createNewRenderView(geoPosition);
    }// else if (this.renderViews[bbox].processedFeatures){
      this.currentRenderView = this.renderViews[bbox];
      this.currentBbox = bbox;
    //}
  }

  static metersToGeoPoint(positionInMeters, originMeters, originGeoPoint) {
    const deltaXMeters = positionInMeters['x'] - originMeters['x'];
    // The z component of vector positionInMeters is horizontal.
    // The -y in world coordinates is northbound.
    const deltaYMeters = -positionInMeters['z'] - originMeters['y'];
    const deltaMercatorX = deltaXMeters * originGeoPoint.getOneMeterInMercatorUnit();
    const deltaMercatorY = deltaYMeters * originGeoPoint.getOneMeterInMercatorUnit();

    const mercatorX = originGeoPoint.getMercatorXfromLongitude() + deltaMercatorX;
    const mercatorY = originGeoPoint.getMercatorYfromLatitude() + deltaMercatorY;
    const geo = new GeoPoint(0,0);
    geo.resetFromMecator(mercatorX, mercatorY);
    return geo;
  }

  watch(positionInMeters, callback) {
    const geoPosition = Slippy.metersToGeoPoint(positionInMeters, {'x':0, 'y':0}, this.currentRenderView.sceneOrigin);
    const bbox = this.createTileBbox(geoPosition)
    if (bbox != this.currentBbox){
      this.setRenderViewIfReady(geoPosition);
      callback();
      this.currentBbox = bbox;
    }
  }

  /**
   * This functions calls the Kartta API to fetch the historical maps data.
   * @param {function(!Object)} callback Callback function to process the response returned
   *     from Kartta Labs API.
   */
  static fetchFeatures(renderView, bbox) {
    const settings = renderView.settings;
    const url = settings.fullUrl
              ? settings.fullUrl
              : settings.endpoint + '?bbox=' + bbox;
    fetch(url)
        .then(response => response.json())
        .then(data => renderView.processFeatures(data))
        .catch(e => console.log(e));
  }
}

const slippy = new Slippy(settings)
renderView = slippy.currentRenderView;
currentScene = renderView.scene;
initialize();

animate();
