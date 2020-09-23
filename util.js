const Util = {};

Util.LoadTexture = (image) => {
  const promise = new Promise(function(resolve, reject) {
    new THREE.TextureLoader().load(
        image,
        /* onLoad= */ (texture) => {
            resolve(texture);
        },
        /* progress= */ undefined,
        /* onError= */ (err) => {
            reject(err);
        }
    );
  });
  return promise;
};

Util.generateRandomGreyColor = (brightness, variation) => {
  brightness = Math.min(1, Math.max(0, brightness));
  const v = Math.min(1, Math.max(0, brightness + 2 * (Math.random() - 0.5) * variation));
  return new THREE.Color(v,v,v);
};

Util.tileIndexAtLonLatDegrees = (lonLatDegrees, tileSizeMicroDegrees) => {
  const lonMicroDegrees = lonLatDegrees.x * 1e6;
  const latMicroDegrees = lonLatDegrees.y * 1e6;
  return [Math.floor(lonMicroDegrees / tileSizeMicroDegrees),
          Math.floor(latMicroDegrees / tileSizeMicroDegrees)];
};

Util.tileAtIndex = (tileIndex, tileSizeMicroDegrees) => {
  const minLonMicroDegrees = tileSizeMicroDegrees * tileIndex[0];
  const maxLonMicroDegress = minLonMicroDegrees + tileSizeMicroDegrees;
  const minLatMicroDegrees = tileSizeMicroDegrees * tileIndex[1];
  const maxLatMicroDegrees = minLatMicroDegrees + tileSizeMicroDegrees;
  const minLonDegrees = minLonMicroDegrees / 1e6;
  const maxLonDegrees = maxLonMicroDegress / 1e6;
  const minLatDegrees = minLatMicroDegrees / 1e6;
  const maxLatDegrees = maxLatMicroDegrees / 1e6;
  return {
    lonLatMin: new THREE.Vector2(minLonDegrees, minLatDegrees),
    lonLatMax: new THREE.Vector2(maxLonDegrees, maxLatDegrees),
    bboxString: minLonDegrees + ',' + minLatDegrees + ',' + maxLonDegrees + ',' + maxLatDegrees
  };
};

Util.tileIndicesNear = (tileIndex, radius) => {
  const currentTileIndex = tileIndex;
  const tileIndices = [];
  tileIndices.push([currentTileIndex[0], currentTileIndex[1]]); // pushes copy of tileIndex array
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
};

export {Util};
