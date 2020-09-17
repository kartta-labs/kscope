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
import {Slippy} from "./slippy.js";

// Global variables to setup the scene.
let camera, mapControls, currentScene, renderView, slippy;

// Global variables for rendering.
let renderer, raycaster;

// Global variables for the pointer lock controler.
let moveForwardInTime = false;
let moveBackwardInTime = false;

let geoOrigin, geoPosition, positionInMeter;

const eyeHeightInMeters = 1.7;
const mouse = { x: 0, y: 0 };
const groundMouse = { x: 0, y: 0, z: 0};
let intersected;

let debugMode = false;

const /** !Element */ yearRangeSlider =
    document.getElementById('year-range-slider');
const /** !Element */ yearRangeValue =
    document.getElementById('year-range-value');
const /** !Element */ highlightedObjectName =
    document.getElementById('highlighted-object-name');

let params = (new URL(document.location)).searchParams;
if(params.has('center')){
  const [lat, lon] = params.get('center').split(',');
  if(!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon))) {
    const toMicro = 1e6;
    settings.origin = {
      'latitudeInMicroDegrees': parseFloat(lat) * toMicro,
      'longitudeInMicroDegrees': parseFloat(lon) * toMicro,
      'altitudeInMeters': 0
    }
  }
}

if(params.has('year')){
  const year = params.get('year');
  if(!isNaN(parseInt(year))) {
    settings.year = year;
  }
}

yearRangeSlider.value = settings.year;
yearRangeValue.innerText = yearRangeSlider.value;

/** Updates the scene when the year slider moves. */
function updateYearSlider() {
  yearRangeValue.innerText = yearRangeSlider.value;
  settings.year = yearRangeSlider.value;
  renderView.setSceneYear();
  updateUrl();
}
yearRangeSlider.oninput = updateYearSlider;

function updateUrl() {
  positionInMeter.copy(camera.position);
  geoPosition = Slippy.metersToGeoPoint(camera.position, {'x':0, 'y':0}, geoOrigin);
  const url = location.origin + location.pathname +
            '?year='+yearRangeSlider.value+'&center='+geoPosition.getLatitudeInDegrees().toFixed(8)+','+geoPosition.getLongitudeInDegrees().toFixed(8);
  window.history.replaceState(null, '', url);
}

/**
 * @param {Element} container The DOM element that the 3d canvas will be inserted into
 */
function initialize(container) {
  geoOrigin = Slippy.toGeoPoint(settings.origin);
  slippy = new Slippy(settings)
  renderView = slippy.currentRenderView;
  currentScene = renderView.scene;
  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(window.devicePixelRatio);
  //renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setSize(container.offsetWidth, container.offsetHeight);
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

  mapControls = new THREE.MapControls(camera, container);
  mapControls.screenSpacePanning = true;

  mapControls.minDistance = 100;
  mapControls.maxDistance = 500;
  mapControls.keyPanSpeed = 70;

  mapControls.maxPolarAngle = Math.PI / 2 - 0.01;
  currentScene.add(camera);

  geoPosition = Slippy.metersToGeoPoint(camera.position, {'x':0, 'y':0}, geoOrigin);
  positionInMeter = camera.position.clone();

  raycaster = new THREE.Raycaster();
  container.addEventListener('mousemove', (event) => {
    event.preventDefault();
    // Linearly transform the mouse position on screen to ±1 in x and y
    // directions. Note that the input mouse y-axis from the mousemove event is
    // downward but the output needs to be upward for the raycaster.
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }, false);

  document.addEventListener('keypress', (event) => {
    switch (event.keyCode) {
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

  container.appendChild( renderer.domElement );

  const onWindowResize = () => {
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.offsetWidth, container.offsetHeight);
  };

  window.addEventListener('resize', onWindowResize, false);
}

/** Runs every frame to animate the scene. */
function animate() {
  requestAnimationFrame(animate);

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

  renderer.render(currentScene, camera);
  mapControls.update();
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
  slippy.watch(camera.position,
  () => {
    renderView = slippy.currentRenderView;
    renderView.setSceneYear();
    currentScene.remove(camera);
    currentScene = renderView.scene;
    currentScene.add(camera);
  });

  const ONE_METER = 1;
  if(positionInMeter.distanceTo(camera.position) > ONE_METER){
    updateUrl();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  var viewport = document.getElementById('viewport');
  initialize(viewport);
  animate();
});
