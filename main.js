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

  createKarttaSlider({
    minValue: 1800,
    maxValue: 2000,
    stepSize: 1,
    value: year,
    change: (year) => {
      app.setYear(year);
      Util.updatePageUrl({year: year});
    },
    domElementToReplace: document.getElementById('year-slider-placeholder')
  });

  const /** !Element */ eyeLevelButton = document.getElementById('eyelevel-button');
  const /** !Element */ streetLevelImg = document.getElementById('street-level-img');
  const /** !Element */ birdLevelImg = document.getElementById('bird-level-img');

  function updateEyeLevelButtonState(level) {
    if (level == 'street') {
      birdLevelImg.classList.add('eyelevel-img-hidden');
      streetLevelImg.classList.remove('eyelevel-img-hidden');
    } else {
      birdLevelImg.classList.remove('eyelevel-img-hidden');
      streetLevelImg.classList.add('eyelevel-img-hidden');
    }
  }

  let currentLevel = level;
  updateEyeLevelButtonState(level);

  function handleEyeLevelButtonClick(e) {
    if (currentLevel == 'street') {
      currentLevel = 'bird';
    } else {
      currentLevel = 'street';
    }
    updateEyeLevelButtonState(currentLevel);
    app.setLevel(currentLevel);
  }
  streetLevelImg.onclick = handleEyeLevelButtonClick;
  birdLevelImg.onclick = handleEyeLevelButtonClick;
  streetLevelImg.ontouchstart = handleEyeLevelButtonClick;
  birdLevelImg.ontouchstart = handleEyeLevelButtonClick;


  const /** !Element */ infoImg = document.getElementById('info-img');
  function setInfoButtonState(infoMode) {
    if (infoMode) {
      infoImg.classList.add("pressed");
    } else {
      infoImg.classList.remove("pressed");
    }
  }
  app.infoButtonStateSetter(setInfoButtonState);
  function handleInfoButtonClick(e) {
    app.setInfoMode(!app.getInfoMode());
  }
  infoImg.onclick = handleInfoButtonClick;

  window.onresize = () => {
    app.resize();
  }

  app.initialize();
});
