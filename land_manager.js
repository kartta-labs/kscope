import {Coords} from "./coords.js";
import {Settings} from "./settings.js";

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

const k = 18 * Settings.groundTextureSize / 4096;
const ROAD_WIDTHS = {
  living_street: 1*k,
  secondary: 1*k,
  tertiary: 1*k,
  unclassified: 1*k,
  path: 1*k,
  residential: 1*k,

  primary: 2*k,
  bridge: 2*k,

  motorway: 3*k,
  trunk: 3*k
};

class LandManager {
  constructor(app, textureCanvas, z, landFetchRadius, landDropRadius) {
    this.app = app;
    this.textureCanvas = textureCanvas;
    this.z = z;
    this.landFetchRadius = landFetchRadius;
    this.landDropRadius = landDropRadius;
    this.landTileDetails = {};
    this.lastTileKey = null;
  }

  updateLandForCameraPosition() {
    // Determine which tile the camera is over.
    const cameraPos = new THREE.Vector3();
    this.app.camera.getWorldPosition(cameraPos);
    const cameraGroundPosScene = new THREE.Vector2(cameraPos.x, cameraPos.z);
    const cameraGroundPosLonLatDegrees = this.app.coords.sceneCoordsToLatLonDegrees(cameraGroundPosScene);
    const cameraTileCoord = lonLatDegreesToTileCoord(cameraGroundPosLonLatDegrees, this.z);
    const key = tileCoordKey(cameraTileCoord);

    // If it's the same tile as last time, do nothing.
    if (key == this.lastTileKey) {
      return;
    }
    this.lastTileKey = key;

    // Delete any land tiles outside landDropRadius of the camera position.
    Object.keys(this.landTileDetails).forEach(tileKey => {
      if (this.landTileDetails[tileKey].landFeatures
          && tileDistance(cameraTileCoord, this.landTileDetails[tileKey].tileCoord) > this.landDropRadius) {
        delete this.landTileDetails[tileKey].object3D;
      }
    });


    // Add new land tiles within landFetchRadius of the camera position
    const tileCoords = tileCoordsInRadius(cameraTileCoord, this.landFetchRadius);
    tileCoords.forEach(tileCoord => {
      const key = tileCoordKey(tileCoord);
      if (key in this.landTileDetails) { return; }
      this.landTileDetails[key] = {
        key: key,
        tileCoord: tileCoord,
        landFeatures: [],
        roadFeatures: [],
        loaded: false,
      };
      this.fetchAndRenderLandTile(this.landTileDetails[key]);
    });
  }

  fetchAndRenderLandTile(landTileDetail) {
    const url = "https://vectortiles.re.city/maps/antique/" + landTileDetail.key + ".pbf";
    this.app.fetchQueue.fetch(url)
    .then(response => {
      return response.arrayBuffer();
    })
    .then(data => {
      const x = landTileDetail.tileCoord[0];
      const y = landTileDetail.tileCoord[1];
      const z = landTileDetail.tileCoord[2];
      const tile = new mvt.VectorTile(new Protobuf(data));
      const obj = new THREE.Object3D();
      landTileDetail.loaded = true;

      if (tile.layers.land) {
        for (let i = 0; i < tile.layers.land.length; ++i) {
          const f = tile.layers.land.feature(i);
          const gf = f.toGeoJSON(x,y,z);
          landTileDetail.landFeatures.push(gf);
        }
      }
      if (tile.layers.roads) {
        for (let i = 0; i < tile.layers.roads.length; ++i) {
          landTileDetail.roadFeatures.push(tile.layers.roads.feature(i).toGeoJSON(x,y,z));
        }
      }
      this.renderLandTile(landTileDetail);
      this.app.requestRender();
    });
  }

  renderLandTile(landTileDetails) {
    this.textureCanvas.fillStyle(Settings.landColor);

    landTileDetails.landFeatures.forEach(landFeature => {
      if (landFeature.geometry.type == 'Polygon') {
        this.fillPolygonFeature(landFeature.geometry.coordinates);
      } else if (landFeature.geometry.type == 'MultiPolygon') {
        landFeature.geometry.coordinates.forEach(polygonCoordinates => {
          return this.fillPolygonFeature(polygonCoordinates);
        });
      }
    });


    landTileDetails.roadFeatures.forEach(roadFeature => {
      this.textureCanvas.strokeStyle(Settings.roadColor);
      const width = roadFeature.properties.type in ROAD_WIDTHS ? ROAD_WIDTHS[roadFeature.properties.type] : 1;
      if (roadFeature.geometry.type == 'LineString') {
        this.drawLineStringFeature(roadFeature.geometry.coordinates, width);
      } else if (roadFeature.geometry.type == 'MultiLineString') {
        roadFeature.geometry.coordinates.forEach(roadCoordinates => {
          this.drawLineStringFeature(roadCoordinates, width);
        });
      }
    });
  }

  drawLineStringFeature(coordinates, width) {
    const lonLatDegreesArray = coordinates.map(lonLatDegrees => new THREE.Vector2(lonLatDegrees[0], lonLatDegrees[1]));
    const sceneCoordsArray = lonLatDegreesArray.map(lonLatDegrees => this.app.coords.lonLatDegreesToSceneCoords(lonLatDegrees));
    this.textureCanvas.lineWidth(width);
    this.textureCanvas.beginPath();
    this.textureCanvas.moveTo(sceneCoordsArray[0].x, sceneCoordsArray[0].y);
    for (let i = 1; i < sceneCoordsArray.length; ++i) {
      this.textureCanvas.lineTo(sceneCoordsArray[i].x, sceneCoordsArray[i].y);
    }
    this.textureCanvas.stroke();
  }

  fillPolygonFeature(coordinates) {
    let lonLatDegreesArray = coordinates[0].map(lonLatDegrees => new THREE.Vector2(lonLatDegrees[0], lonLatDegrees[1]));
    let sceneCoordsArray = lonLatDegreesArray.map(lonLatDegrees => this.app.coords.lonLatDegreesToSceneCoords(lonLatDegrees));
    this.textureCanvas.beginPath();
    this.tracePath(sceneCoordsArray);
    for (let i = 1; i < coordinates.length; ++i) {
      lonLatDegreesArray = coordinates[i].map(lonLatDegrees => new THREE.Vector2(lonLatDegrees[0], lonLatDegrees[1]));
      sceneCoordsArray = lonLatDegreesArray.map(lonLatDegrees => this.app.coords.lonLatDegreesToSceneCoords(lonLatDegrees));
      this.tracePath(sceneCoordsArray, -1);
    }
    this.textureCanvas.closePath();
    this.textureCanvas.fill();
  }

  tracePath(sceneCoordsArray, direction) {
    if (direction === undefined) { direction = 1; }
    const i0 = direction > 0 ? 0 : sceneCoordsArray.length - 1;
    this.textureCanvas.moveTo(sceneCoordsArray[i0].x, sceneCoordsArray[i0].y);
    for (let i = 1; i < sceneCoordsArray.length; ++i) {
      if (direction > 0) {
        this.textureCanvas.lineTo(sceneCoordsArray[i].x, sceneCoordsArray[i].y);
      } else {
        this.textureCanvas.lineTo(sceneCoordsArray[i0 - i].x, sceneCoordsArray[i0 - i].y);
      }
    }
  }

  rerender() {
    this.textureCanvas.clear(Settings.waterColor);
    Object.keys(this.landTileDetails).forEach(tileKey => {
      if (this.landTileDetails[tileKey].loaded) {
        this.renderLandTile(this.landTileDetails[tileKey]);
      }
    });
  }

}

export {LandManager};
