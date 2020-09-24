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

//xxx /**
//xxx  * @fileoverview This file contains a demo 3D visualizer for buildings in their
//xxx  * real locations. It statically loads the 3D models and then puts them in their
//xxx  * Mercator coordinates, according to their latitude and longitude values.
//xxx  */
//xxx import {Slippy} from "./slippy.js";
//xxx
//xxx // Global variables to setup the scene.
//xxx let camera, mapControls, currentScene, renderView, slippy;
//xxx
//xxx // Global variables for rendering.
//xxx let renderer, raycaster;
//xxx
//xxx // Global variables for the pointer lock controler.
//xxx let moveForwardInTime = false;
//xxx let moveBackwardInTime = false;
//xxx
//xxx const eyeHeightInMeters = 1.7;
//xxx const mouse = { x: 0, y: 0 };
//xxx const groundMouse = { x: 0, y: 0, z: 0};
//xxx let intersected;
//xxx
//xxx let debugMode = false;
//xxx
//xxx const /** !Element */ yearRangeSlider =
//xxx     document.getElementById('year-range-slider');
//xxx const /** !Element */ yearRangeValue =
//xxx     document.getElementById('year-range-value');
//xxx const /** !Element */ highlightedObjectName =
//xxx     document.getElementById('highlighted-object-name');
//xxx
//xxx let params = (new URL(document.location)).searchParams;
//xxx
//xxx if(params.has('year')){
//xxx   const year = params.get('year');
//xxx   if(!isNaN(parseInt(year))) {
//xxx     settings.year = year;
//xxx   }
//xxx }
//xxx
//xxx yearRangeSlider.value = settings.year;
//xxx yearRangeValue.innerText = yearRangeSlider.value;
//xxx
//xxx /** Updates the scene when the year slider moves. */
//xxx function updateYearSlider() {
//xxx   yearRangeValue.innerText = yearRangeSlider.value;
//xxx   settings.year = yearRangeSlider.value;
//xxx   renderView.setSceneYear();
//xxx   updateUrl();
//xxx }
//xxx yearRangeSlider.oninput = updateYearSlider;
//xxx
//xxx function updateUrl() {
//xxx   const url = location.origin + location.pathname + '?year='+yearRangeSlider.value;
//xxx   window.history.replaceState(null, '', url);
//xxx }
//xxx
//xxx /**
//xxx  * @param {Element} container The DOM element that the 3d canvas will be inserted into
//xxx  */
//xxx function initialize(container) {
//xxx   slippy = new Slippy(settings);
//xxx   renderView = slippy.currentRenderView;
//xxx   currentScene = renderView.scene;
//xxx   renderer = new THREE.WebGLRenderer({antialias:true});
//xxx   renderer.setPixelRatio(window.devicePixelRatio);
//xxx   //renderer.setSize(window.innerWidth, window.innerHeight);
//xxx   renderer.setSize(container.offsetWidth, container.offsetHeight);
//xxx   if (settings.shadows) {
//xxx     renderer.shadowMap.enabled = true;
//xxx     renderer.shadowMap.type = THREE.PCFSoftShadowMap;
//xxx   }
//xxx   renderer.gammaInput = true;
//xxx   renderer.gammaOutput = true;
//xxx   const farPlane = settings.farPlane;
//xxx   const aspectRatio = window.innerWidth / window.innerHeight;
//xxx
//xxx   camera = new THREE.PerspectiveCamera(
//xxx       settings.fieldOfView, aspectRatio, settings.nearPlane, farPlane);
//xxx   camera.position.set(0, eyeHeightInMeters, -10);
//xxx   // camera.lookAt(currentScene.position);
//xxx
//xxx   mapControls = new THREE.MapControls(camera, container);
//xxx   mapControls.screenSpacePanning = true;
//xxx
//xxx   mapControls.minDistance = 100;
//xxx   mapControls.maxDistance = 500;
//xxx   mapControls.keyPanSpeed = 70;
//xxx
//xxx   mapControls.maxPolarAngle = Math.PI / 2 - 0.01;
//xxx   currentScene.add(camera);
//xxx
//xxx   raycaster = new THREE.Raycaster();
//xxx   container.addEventListener('mousemove', (event) => {
//xxx     event.preventDefault();
//xxx     // Linearly transform the mouse position on screen to ±1 in x and y
//xxx     // directions. Note that the input mouse y-axis from the mousemove event is
//xxx     // downward but the output needs to be upward for the raycaster.
//xxx     mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//xxx     mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
//xxx   }, false);
//xxx
//xxx   document.addEventListener('keypress', (event) => {
//xxx     switch (event.keyCode) {
//xxx       case 48:  // 0
//xxx         debugMode = !debugMode;
//xxx         renderView.toggleTextures();
//xxx         renderView.toggleColors();
//xxx         if(!debugMode) highlightedObjectName.innerText = '';
//xxx         break;
//xxx       case 113:  // q
//xxx         moveBackwardInTime = true;
//xxx         break;
//xxx       case 101:  // e
//xxx         moveForwardInTime = true;
//xxx         break;
//xxx     }
//xxx   }, false);
//xxx
//xxx   container.appendChild( renderer.domElement );
//xxx
//xxx   const onWindowResize = () => {
//xxx     camera.aspect = container.offsetWidth / container.offsetHeight;
//xxx     camera.updateProjectionMatrix();
//xxx     renderer.setSize(container.offsetWidth, container.offsetHeight);
//xxx   };
//xxx
//xxx   window.addEventListener('resize', onWindowResize, false);
//xxx }
//xxx
//xxx /** Runs every frame to animate the scene. */
//xxx function animate() {
//xxx   requestAnimationFrame(animate);
//xxx
//xxx   if (moveForwardInTime) {
//xxx     yearRangeSlider.value++;
//xxx     updateYearSlider();
//xxx     moveForwardInTime = false;
//xxx   }
//xxx
//xxx   if (moveBackwardInTime) {
//xxx     yearRangeSlider.value--;
//xxx     updateYearSlider();
//xxx     moveBackwardInTime = false;
//xxx   }
//xxx
//xxx   renderer.render(currentScene, camera);
//xxx   mapControls.update();
//xxx   // Find intersections.
//xxx   raycaster.setFromCamera(mouse, camera);
//xxx   const intersects = raycaster.intersectObjects(currentScene.children, true);
//xxx
//xxx   for (let i = 0; i < intersects.length; ++i) {
//xxx     if (intersects[i].object.name == 'ground') {
      // //xxx mouse is over this ground plane position in world coords:
//xxx       groundMouse.x = intersects[i].point.x;
//xxx       groundMouse.y = intersects[i].point.y;
//xxx       groundMouse.z = intersects[i].point.z;
//xxx       break;
//xxx     }
//xxx   }
//xxx
//xxx   if (debugMode) {
//xxx     if (intersects.length > 0 && intersects[0].object.name != 'ground') {
//xxx       if (intersected != intersects[0].object) {
//xxx         if (intersected) intersected.material.color = intersected.originalColor;
//xxx         intersected = intersects[0].object;
//xxx         highlightedObjectName.innerText = 'id: ' + intersected.parent.name;
//xxx         intersected.originalColor = intersected.material.color;
//xxx         intersected.material.color = new THREE.Color('aqua');
//xxx       }
//xxx     } else {
//xxx       if (intersected) intersected.material.color = intersected.originalColor;
//xxx       highlightedObjectName.innerText = 'id:';
//xxx       intersected = null;
//xxx     }
//xxx   }
//xxx   slippy.watch(camera.position,
//xxx   () => {
//xxx     renderView = slippy.currentRenderView;
//xxx     renderView.setSceneYear();
//xxx     currentScene.remove(camera);
//xxx     currentScene = renderView.scene;
//xxx     currentScene.add(camera);
//xxx   });
//xxx
//xxx }
//xxx
//xxx document.addEventListener("DOMContentLoaded", () => {
//xxx   var viewport = document.getElementById('viewport');
//xxx   initialize(viewport);
//xxx   animate();
//xxx });

import {App} from "./app.js";
import {Util} from "./util.js";
import {Settings} from "./settings.js";

const params = (new URL(document.location)).searchParams;

const year = params.has("year") ? parseInt(params.get("year")) : Settings.year;
Util.updatePageUrl({year: year});
const level = params.has("level") ? params.get("level") : Settings.level;

const options = {};

Util.setOptionFromUrlParams(options, params, "year", parseInt);
Util.setOptionFromUrlParams(options, params, "tilesize", parseInt);
Util.setOptionFromUrlParams(options, params, "fetchradius", parseInt);
Util.setOptionFromUrlParams(options, params, "dropradius", parseInt);
Util.setOptionFromUrlParams(options, params, "level");
Util.setOptionFromUrlParams(options, params, "speed", parseFloat);
Util.setOptionFromUrlParams(options, params, "debug", Util.stringToBoolean);
Util.setOptionFromUrlParams(options, params, "lon", parseFloat);
Util.setOptionFromUrlParams(options, params, "lat", parseFloat);
Util.setOptionFromUrlParams(options, params, "pitch", parseFloat);
Util.setOptionFromUrlParams(options, params, "yaw", parseFloat);

const app = new App(document.getElementById('viewport'), options);

window.addEventListener('load', () => {
  const /** !Element */ yearRangeSlider = document.getElementById('year-range-slider');
  const /** !Element */ yearRangeValue = document.getElementById('year-range-value');
  yearRangeSlider.value = year;
  yearRangeValue.innerText = year;
  yearRangeSlider.oninput = () => {
    const year = parseInt(yearRangeSlider.value);
    yearRangeValue.innerText = year;
    app.setYear(year);
    Util.updatePageUrl({year: year});
  }

  const /** !Element */ streetLevelButton = document.getElementById('street-level-button');
  const /** !Element */ birdLevelButton = document.getElementById('bird-level-button');

  function updateEyeLevelButtonStates(level) {
    if (level == 'street') {
      birdLevelButton.classList.remove('eyelevel-active');
      streetLevelButton.classList.add('eyelevel-active');
    } else {
      streetLevelButton.classList.remove('eyelevel-active');
      birdLevelButton.classList.add('eyelevel-active');
    }
  }

  let currentLevel = level;
console.log('level initialized to ', level);
  updateEyeLevelButtonStates(level);

  function handleEyeLevelButtonClick(e) {
    const newLevel = this.id == 'street-level-button' ? 'street' : 'bird';
    if (newLevel == currentLevel) { return; }
    updateEyeLevelButtonStates(newLevel);
    app.setLevel(newLevel);
    currentLevel = newLevel;
  }
  birdLevelButton.onclick = handleEyeLevelButtonClick;
  streetLevelButton.onclick = handleEyeLevelButtonClick;

  app.initialize();
});
