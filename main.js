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
let camera, container, mapControls, currentScene, renderView, slippy;

// Global variables for rendering.
let renderer, renderPass, raycaster, composers, currentComposer, composerIndex;

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
  geoOrigin = Slippy.toGeoPoint(settings.origin);
  slippy = new Slippy(settings)
  renderView = slippy.currentRenderView;
  currentScene = renderView.scene;
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

  mapControls = new THREE.MapControls(camera, document.body);
  mapControls.screenSpacePanning = true;

  mapControls.minDistance = 100;
  mapControls.maxDistance = 500;
  mapControls.keyPanSpeed = 70;

  mapControls.maxPolarAngle = Math.PI / 2 - 0.01;
  currentScene.add(camera);

  geoPosition = Slippy.metersToGeoPoint(camera.position, {'x':0, 'y':0}, geoOrigin);
  positionInMeter = camera.position.clone();

  const composerNoEffects = new THREE.EffectComposer(renderer);
  const composerBW = new THREE.EffectComposer(renderer);
  const composerSepiaFilm = new THREE.EffectComposer(renderer);
  const composerSepia = new THREE.EffectComposer(renderer);

  renderPass = new THREE.RenderPass(currentScene, camera);

  composerNoEffects.addPass(renderPass);
  composerBW.addPass(renderPass);
  composerSepiaFilm.addPass(renderPass);
  composerSepia.addPass(renderPass);

  const gammaCorrection = new THREE.ShaderPass(THREE.GammaCorrectionShader);
  composerBW.addPass(gammaCorrection);
  composerSepiaFilm.addPass(gammaCorrection);
  composerSepia.addPass(gammaCorrection);

  const effectFilmBW = new THREE.FilmPass( 0.35, 0.5, 2048, true );
  composerBW.addPass(effectFilmBW);

  const effectSepia = new THREE.ShaderPass(THREE.SepiaShader);
  effectSepia.uniforms[ "amount" ].value = 0.9;
  composerSepiaFilm.addPass(effectSepia);
  composerSepia.addPass(effectSepia);

  const effectFilm = new THREE.FilmPass( 0.35, 0.025, 648, false );
  composerSepiaFilm.addPass(effectFilm);

  const effectVignette = new THREE.ShaderPass(THREE.VignetteShader);
  effectVignette.uniforms["offset"].value = 0.95;
  effectVignette.uniforms["darkness"].value = 1.6;
  composerBW.addPass(effectVignette);
  composerSepiaFilm.addPass(effectVignette);
  composerSepia.addPass(effectVignette);

  composers = [];
  composers.push(composerNoEffects);
  composers.push(composerBW);
  composers.push(composerSepiaFilm);
  currentComposer = composerSepiaFilm; composerIndex = 2;
  composers.push(composerSepia);

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
      case 49:  // 1
        composerIndex += 1;
        composerIndex %= composers.length;
        currentComposer = composers[composerIndex];
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
  renderPass.scene = currentScene;

  currentComposer.render();
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
    positionInMeter.copy(camera.position);
    geoPosition = Slippy.metersToGeoPoint(camera.position, {'x':0, 'y':0}, geoOrigin);
    const url = '/?center='+geoPosition.getLatitudeInDegrees().toFixed(8)+','+geoPosition.getLongitudeInDegrees().toFixed(8);
    window.history.replaceState(null, '', url);
  }
}

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

initialize();
animate();
