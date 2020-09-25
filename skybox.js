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

import {Settings} from "./settings.js";
import {Util} from "./util.js";

// Load a single texture image, returning a promise which resolves
// to a material for that image.
function ImageToTextureMaterial(image) {
  return Util.LoadTexture(image).then(texture => {
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBFormat;
    return new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide
    });
  });
}


class SkyBox {

  constructor() {

    // I used
    //   https://jaxry.github.io/panorama-to-cubemap
    // to create these images from a photosphere image.
    const skyImages = [
        "images/px.png", // fr
        "images/nx.png", // bk
        "images/py.png", // up
        "images/ny.png", // dn
        "images/pz.png", // rt
        "images/nz.png", // lf
    ];

    this.objectPromise = Promise.all(skyImages.map(ImageToTextureMaterial)).then(materials => {
      // materials is an array of the 6 materials created above.
      // Skybox cube size is, conservatively, set to the half of the Camera
      // frustrum far plane, such that the skybox is always visible.
      const f = Settings.farPlane;
      //const f = 4;
      const geometry =
          new THREE.BoxGeometry(f / 2.0,
                                f / 2.0,
                                f / 2.0);
      const cube = new THREE.Mesh(geometry, materials);
      cube.position.x = 0;
      cube.position.y = 0;
      cube.position.z = 0;
      cube.name = 'skybox';
      return cube;
    });

  }

  getObject() {
    return this.objectPromise;
  }
}

export {SkyBox};
