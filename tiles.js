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

import {Coords} from "./coords.js";

/**
 * A Tile represents an axis-aligned rectangle in lon,lat coordinates, specified
 * in terms of the min & max values of lon & lat.
 *
 * It also stores the scene coordinates of the min and max points, but note that
 * these are not actual mathematical minimum/maximum values in scene coordinates,
 * and the sides of the tile in scene coordinates are not actually straight lines,
 * although over small distances they will be very close to straight.n
 */
class Tile {
  constructor(lonLatMinDegrees, lonLatMaxDegrees, sceneMin, sceneMax, tileIndex) {
    this.lonLatMinDegrees = lonLatMinDegrees;
    this.lonLatMaxDegrees = lonLatMaxDegrees;
    this.bBoxString = lonLatMinDegrees.x + ',' + lonLatMinDegrees.y
          + ',' + lonLatMaxDegrees.x + ',' + lonLatMaxDegrees.y;
    this.sceneMin = sceneMin;
    this.sceneMax = sceneMax;
    this.tileIndex = tileIndex;
  }

  getLonLatMinDegrees() {
    return this.lonLatMinDegrees;
  }

  getLonLatMaxDegrees() {
    return this.lonLatMaxDegrees;
  }

  getBBoxString() {
    return this.bBoxString;
  }

  getSceneMin() {
    return this.sceneMin;
  }

  getSceneMax() {
    return this.sceneMax;
  }

  getTileIndex() {
    return this.tileIndex;
  }
}


/*
 * Defines a tiling of the planet based on a given tile size in micro-degrees.
 */
class Tiler {
  /**
   * @param tileSizeMicroDegrees width and height of tiles
   * @param coords a Coords instance for converting to scene coordinates
   */
  constructor(tileSizeMicroDegrees, coords) {
    this.tileSizeMicroDegrees = tileSizeMicroDegrees;
    this.coords = coords;
  }

  /**
   * Returns index of the tile containing the given location.
   * A tile index is an array of 2 integers which give the multiples of
   * the tile size corresponding to min point of the tile.
   * Example:
   *   For a tile size of 100 micro-degrees, the index of the tile
   *   containing (lon=-72.5435414, lat=39.4564325)
   *   is [ -725436, 394564 ].
   */
  tileIndexAtLonLatDegrees(lonLatDegrees) {
    const lonMicroDegrees = lonLatDegrees.x * 1e6;
    const latMicroDegrees = lonLatDegrees.y * 1e6;
    return [Math.floor(lonMicroDegrees / this.tileSizeMicroDegrees),
            Math.floor(latMicroDegrees / this.tileSizeMicroDegrees)];
  }

  /**
   * Returns a new Tile instance representing the tile at the given tile index.
   */
  tileAtIndex(tileIndex) {
    const minLonMicroDegrees = tileIndex[0] * this.tileSizeMicroDegrees;
    const maxLonMicroDegress = minLonMicroDegrees + this.tileSizeMicroDegrees;
    const minLatMicroDegrees = tileIndex[1] * this.tileSizeMicroDegrees;
    const maxLatMicroDegrees = minLatMicroDegrees + this.tileSizeMicroDegrees;
    const minLonLatDegrees = new THREE.Vector2(minLonMicroDegrees / 1e6,
                                               minLatMicroDegrees / 1e6);
    const maxLonLatDegrees = new THREE.Vector2(maxLonMicroDegress / 1e6,
                                               maxLatMicroDegrees / 1e6);
    return new Tile(minLonLatDegrees,
                    maxLonLatDegrees,
                    this.coords.lonLatDegreesToSceneCoords(minLonLatDegrees),
                    this.coords.lonLatDegreesToSceneCoords(maxLonLatDegrees),
                    tileIndex);
  }

  /**
   * Returns an array of tile indices starting at tileIndex and spiraling outward to
   * cover a square of the given "radius".  Specifically:
   *   if radius=0:
   *     returns array of length 1 containing tileIndex
   *   if radius=1:
   *     returns array of length 9 covering a 3x3 grid with tileIndex at the center,
   *     like this:
   *       4 3 2
   *       5 0 1
   *       6 7 8
   *   if radius=2:
   *     returns array of length 25 covering a 5x5 grid with tileIndex at the center,
   *     like this:
   *       16 15 14 13 12
   *       17  4  3  2 11
   *       18  5  0  1 10
   *       19  6  7  8  9
   *       20 21 22 23 24
   *   ...etc...
   * In all cases, the first element of the returned array is (a copy of) tileIndex,
   * and the other indices in the list spiral counterclockwise outward from there,
   * starting with the index to the right of tileIndex.
   */
  static tileIndicesNear(tileIndex, radius) {
    const currentTileIndex = [tileIndex[0], tileIndex[1]];
    const tileIndices = [];
    tileIndices.push([currentTileIndex[0], currentTileIndex[1]]);
    const iMax = 2*radius + 1;
    let offset = 1;
    let i = 1;
    while (true) {
      const jMax = i == iMax ? i - 1 : i;
      for (let j = 1; j <= jMax; ++j) {
        currentTileIndex[0] += offset;
        tileIndices.push([currentTileIndex[0], currentTileIndex[1]]);
      }
      if (i == iMax) { break; }
      for (let j = 1; j <= i; ++j) {
        currentTileIndex[1] += offset;
        tileIndices.push([currentTileIndex[0], currentTileIndex[1]]);
      }
      offset = -offset;
      ++i;
    }
    return tileIndices;
  }

  /**
   * Returns the "distance" between two tile indices. Specifically, this is just
   * the max of the distances between the 2 coordinate values.
   */
  static tileIndexDistance(tileIndex1, tileIndex2) {
    return Math.max(Math.abs(tileIndex1[0] - tileIndex2[0]),
                    Math.abs(tileIndex1[1] - tileIndex2[1]));
  }
};


export {Tile};
export {Tiler};
