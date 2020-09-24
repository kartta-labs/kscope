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

import {Config} from "./config.js";

let Settings = {
  'endpoint': Config.endpoint,
  'origin': {
    'latitudeInMicroDegrees': 40741057,
    'longitudeInMicroDegrees': -74001565,
    'altitudeInMeters': 0
  },

  'fieldOfView': 45.0,
  'nearPlane': 1.0,
  'farPlane': 5000,
  'shadows': false,
  'lights': {
    'Ambient': [
      {'color': 0xcccccc, 'intensity': 0.2}
    ],
    'directional': [
      {
        'position': {'x': -1, 'y': -0.5, 'z': -1},
        'color': 0xffffff,
        'intensity': 0.6
      },
      {
        'position': {'x': -1, 'y': -0.5, 'z': 1},
        'color': 0xffffff,
        'intensity': 0.6
      }
    ]
  },

  'buildingsReceiveShadows': false,
  'buildingXZScaleShrinkFactor': 0.9999,

  'averageStoreyHeightMeters': 4.3,
  'minimumExtrusionMeters': 0.01,
  'brightnessOfModels': 0.4,
  'brightnessOfExtrudedModels': 0.6,
  'colorVariationOfExtrudedModels': 0.1,

  'year': 1940,
  'tilesize' : 1000,
  'fetchradius' : 2,
  'dropradius' : 5,
  'speed' : 1.0,
  'debug' : false,
  'pitch': 0,
  'yaw': 0,

  // eyeheight,eyex,eyez give the initial default position of the eye
  // (camera) in scene coordinates, relative to the scene origin
  // above.  If no lon/lat option is passed to the app, the camera's
  // initial lon/lat will be initialized to be eyex meters east and
  // eyez meters south of the scene origin.  The camera height is
  // given by eyeheight, which can be overridden by an option.
  'eyeheight' : 1.7,
  'eyex': 0,
  'eyez': 200

};

export {Settings};
