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

/**
 * @fileoverview This file contains a demo 3D visualizer for buildings in their
 * real locations. It statically loads the 3D models and then puts them in their
 * Mercator coordinates, according to their latitude and longitude values.
 */

import {RenderView} from "./render_view.js";
import {GeoPoint} from "./geospatial_utils.js";
import {Slippy} from "./slippy.js";

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

const slippy = new Slippy(settings)
renderView = slippy.currentRenderView;
currentScene = renderView.scene;
initialize();

animate();
