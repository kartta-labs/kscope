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
import {Coords} from "./coords.js";

/**
 * @param lonLatDegrees (THREE.Vector2) lon [x] and lat [y] in degrees
 * @param z (int) tile zoom level
 */
function lonLatDegreesToTileCoord(lonLatDegrees, z) {
  const d = lonLatDegrees.x + 180.0;  // degrees east of international date line:
  const f = d / 360.0;  // d scaled to a fraction between 0.0 and 1.0
  const x = f * 2**z;

  const rLat = lonLatDegrees.y * Math.PI / 180.0; // lat in radians
  const y = 2**z * (1 - (Math.log(Math.tan(rLat) + (1.0/Math.cos(rLat))) / Math.PI)) / 2;

  return [Math.floor(x), Math.floor(y), z];
}

function wrap(v, n) {
  if (v >= 0) {
    return v % n;
  }
  return (n - (-v % n)) % n;
}

function clamp(v, n) {
  if (v <= 0) { return 0; }
  if (v >= n-1) { return n-1; }
  return v;
}

function tileCoordsInRadius(tileCoord, radius) {
  const z = tileCoord[2];
  const tiles = [];
  for (let dx = -radius; dx <= radius; ++dx) {
    const x = wrap(tileCoord[0] + dx, 2**z);
    for (let dy = -radius; dy <= radius; ++dy) {
      const y = clamp(tileCoord[1] + dy, 2**z);
      tiles.push([x,y,z]);
    }
  }
  return tiles;
}

function tileCoordKey(tileCoord) {
  // z/x/y
  return tileCoord[2] + "/" + tileCoord[0] + "/" + tileCoord[1];
}

function tileDistance(tileCoord1, tileCoord2) {
  return Math.max(Math.abs(tileCoord1[0] - tileCoord2[0]),
                  Math.abs(tileCoord1[1] - tileCoord2[1]));
}


class Ground {

  constructor(app) {
    this.app = app;

    var geom = new THREE.Geometry();
    //this.F = Settings.farPlane;
    this.F = 800;  //debugdebug
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

    const textureSize = 2048; // should be a power of 2
    this.textureCanvas = new TextureCanvas(textureSize, textureSize, -1, -1, 1, 1);

    const mat = new THREE.MeshPhongMaterial({
      map: this.textureCanvas.getTexture(),
      side: THREE.DoubleSide
    });

    this.object3D = new THREE.Mesh(geom, mat);
    this.object3D.rotation.x = -Math.PI / 2;
    this.object3D.name = 'ground';
    this.object3D.position.y = -0.05;
    this.updateCoordsForCameraPosition();
    this.app.scene.add(this.object3D);
//this.debugdebugdemo();
this.debugdebugdemo3();
  }

  debugdebugdemo3() {
    this.textureCanvas.fillStyle("#00ff00");
    this.textureCanvas.fillRect(-this.F, -this.F, 2*this.F, 2*this.F);

    this.textureCanvas.strokeStyle("#ff0000");
    this.textureCanvas.lineWidth(2);

    this.textureCanvas.beginPath();
    this.textureCanvas.moveTo(-0.95*this.F, -0.95*this.F);
    this.textureCanvas.lineTo(0.95*this.F, 0.95*this.F);
    this.textureCanvas.stroke();

    this.textureCanvas.beginPath();
    this.textureCanvas.moveTo(-0.95*this.F, 0.95*this.F);
    this.textureCanvas.lineTo(0.95*this.F, -0.95*this.F);
    this.textureCanvas.stroke();

    this.textureCanvas.beginPath();
    this.textureCanvas.moveTo(-0.95*this.F, -0.95*this.F);
    this.textureCanvas.lineTo(0.95*this.F, -0.95*this.F);
    this.textureCanvas.lineTo(0.95*this.F, 0.95*this.F);
    this.textureCanvas.lineTo(-0.95*this.F, 0.95*this.F);
    this.textureCanvas.lineTo(-0.95*this.F, -0.95*this.F);
    this.textureCanvas.stroke();
  }

  maybeRecenterForCameraPosition() {
    if (this.object3D) {
      if (Math.abs(this.object3D.position.x - this.cameraX) > 500
          || Math.abs(this.object3D.position.z - this.cameraZ) > 500) {
        this.updateCoordsForCameraPosition();
      }
    }
  }

  updateCoordsForCameraPosition() {
    this.object3D.position.x = this.app.cameraX;
    this.object3D.position.z = this.app.cameraZ;
    this.textureCanvas.setCoords(
        this.object3D.position.x - this.F, // xMin,
        this.object3D.position.y - this.F, // yMin,
        this.object3D.position.x + this.F, // xMax,
        this.object3D.position.y + this.F // yMax
    );
  }

}

export {Ground};
