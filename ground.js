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

import {LandManager} from "./land_manager.js";
import {Settings} from "./settings.js";
import {TextureCanvas} from "./texture_canvas.js";
import {Util} from "./util.js";

class Ground {

  constructor(app) {
    this.app = app;

    var geom = new THREE.Geometry();
    this.F = Settings.farPlane;
    geom.vertices.push(new THREE.Vector3(this.F, this.F, 0));
    geom.vertices.push(new THREE.Vector3(this.F, -this.F, 0));
    geom.vertices.push(new THREE.Vector3(-this.F, -this.F, 0));
    geom.vertices.push(new THREE.Vector3(-this.F, this.F, 0));
    var uvs = [
        new THREE.Vector2(1, 0),
        new THREE.Vector2(1, 1),
        new THREE.Vector2(0, 1),
        new THREE.Vector2(0, 0)
    ];

    geom.faces.push(new THREE.Face3(0, 1, 2));
    geom.faceVertexUvs[0].push([uvs[0], uvs[1], uvs[2]]);

    geom.faces.push(new THREE.Face3(3, 0, 2));
    geom.faceVertexUvs[0].push([uvs[3], uvs[0], uvs[2]]);

    this.textureCanvas = new TextureCanvas(Settings.groundTextureSize,
                                           Settings.groundTextureSize,
                                           -1, -1, 1, 1);
    this.textureCanvas.clear(Settings.waterColor);

    const mat = new THREE.MeshBasicMaterial({
      map: this.textureCanvas.getTexture(),
      side: THREE.DoubleSide
    });

    this.object3D = new THREE.Mesh(geom, mat);
    this.object3D.rotation.x = -Math.PI / 2;
    this.object3D.name = 'ground';
    this.object3D.position.y = -0.05;
    this.updateCoordsForCameraPosition();
    this.app.scene.add(this.object3D);
    this.landManager = new LandManager(this.app,
                                       this.textureCanvas,
                                       /*z=*/15, /*landFetchRadius=*/5, /*landDropRadius=*/7);
    this.landManager.updateLandForCameraPosition();
  }

  maybeRecenterForCameraPosition() {
    if (this.object3D) {
      if (Math.abs(this.object3D.position.x - this.app.cameraX) > 500
          || Math.abs(this.object3D.position.z - this.app.cameraZ) > 500) {
        this.updateCoordsForCameraPosition();
        this.landManager.rerender();
        //this.render();
      }
    }
  }

  updateCoordsForCameraPosition() {
    this.object3D.position.x = this.app.cameraX;
    this.object3D.position.z = this.app.cameraZ;
    this.textureCanvas.setCoords(
        this.object3D.position.x - this.F, // xMin,
        this.object3D.position.z + this.F, // yMin,
        this.object3D.position.x + this.F, // xMax,
        this.object3D.position.z - this.F // yMax
    );
  }

}

export {Ground};
