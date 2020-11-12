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
import {TextureCanvas} from "./texture_canvas.js";
import {Util} from "./util.js";

class Ground {

  constructor(app) {
    this.app = app;

    var geom = new THREE.Geometry();
    //const F = Settings.farPlane;
    const F = 800;  //debugdebug
    geom.vertices.push(new THREE.Vector3(F, F, 0));
    geom.vertices.push(new THREE.Vector3(F, -F, 0));
    geom.vertices.push(new THREE.Vector3(-F, -F, 0));
    geom.vertices.push(new THREE.Vector3(-F, F, 0));
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

    const textureSize = 2048; // should be a power of 2
    this.textureCanvas = new TextureCanvas(textureSize, textureSize, -1, -1, 1, 1);
    const mat = new THREE.MeshPhongMaterial({
      map: this.textureCanvas.getTexture(),
      side: THREE.DoubleSide
    });


    this.object3D = new THREE.Mesh(geom, mat);
    this.object3D.rotation.x = -Math.PI / 2;
    this.object3D.name = 'ground';
    this.object3D.position.x = this.app.cameraX;
    this.object3D.position.z = this.app.cameraZ;
    this.object3D.position.y = -0.05;
    this.object3D = this.object3D;
    this.updateForCameraPosition();
    this.app.scene.add(this.object3D);
this.debugdebugdemo();
  }

  debugdebugdemo() {
    this.textureCanvas.fillStyle("#00ff00");
    this.textureCanvas.fillRect(-1, -1, 2, 2);

    this.textureCanvas.strokeStyle("#ff0000");
    this.textureCanvas.lineWidth(2);

    this.textureCanvas.beginPath();
    this.textureCanvas.moveTo(-.95, -.95);
    this.textureCanvas.lineTo(.95, .95);
    this.textureCanvas.stroke();

    this.textureCanvas.beginPath();
    this.textureCanvas.moveTo(-.95, .95);
    this.textureCanvas.lineTo(.95, -.95);
    this.textureCanvas.stroke();

    this.textureCanvas.beginPath();
    this.textureCanvas.moveTo(-.95, -.95);
    this.textureCanvas.lineTo(.95, -.95);
    this.textureCanvas.lineTo(.95, .95);
    this.textureCanvas.lineTo(-.95, .95);
    this.textureCanvas.lineTo(-.95, -.95);
    this.textureCanvas.stroke();
  }

  updateForCameraPosition() {
    if (this.object3D) {
      if (Math.abs(this.object3D.position.x - this.cameraX) > 500
          || Math.abs(this.object3D.position.z - this.cameraZ) > 500) {
        this.object3D.position.x = this.app.cameraX;
        this.object3D.position.z = this.app.cameraZ;
      }
    }
  }

}

export {Ground};
