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

Util.tileAt = (lonLatDegrees, tileSizeMicroDegrees) => {
  const lonMicroDegrees = lonLatDegrees.x * 1e6;
  const latMicroDegrees = lonLatDegrees.y * 1e6;
  const xmin = tileSizeMicroDegrees * Math.floor(lonMicroDegrees / tileSizeMicroDegrees);
  const xmax = xmin + tileSizeMicroDegrees;
  const ymin = tileSizeMicroDegrees * Math.floor(latMicroDegrees / tileSizeMicroDegrees);
  const ymax = ymin + tileSizeMicroDegrees;
  return [ [xmin/1e6,ymin/1e6],  [xmax/1e6,ymax/1e6] ];
};

Util.tilesAt = (lonLatDegrees, n, tileSizeMicroDegrees) => {
  const lonMicroDegrees = lonLatDegrees.x * 1e6;
  const latMicroDegrees = lonLatDegrees.y * 1e6;
  const xmin = tileSizeMicroDegrees * Math.floor(lonMicroDegrees / tileSizeMicroDegrees);
  const ymin = tileSizeMicroDegrees * Math.floor(latMicroDegrees / tileSizeMicroDegrees);
  const ans = [];
  const x0 = Math.floor(n/2);
  const y0 = Math.floor(n/2);
  for (let xi = 0; xi < n; ++xi) {
    const row = [];
    for (let yi = 0; yi < n; ++yi) {
      const thisXmin = xmin + (xi - x0) * tileSizeMicroDegrees;
      const thisYmin = ymin + (yi - y0) * tileSizeMicroDegrees;
      row.push(
          [[thisXmin/1e6, thisYmin/1e6],
           [(thisXmin+tileSizeMicroDegrees)/1e6, (thisYmin+tileSizeMicroDegrees)/1e6]]
      );
    }
    ans.push(row);
  }
  //ans.forEach(tile => {
  //  console.log('[' + tile[0][0] + ',' + tile[0][1] + '] -> [' + tile[1][0] + ',' + tile[1][1] + ']');
  //});
  return ans;
};

window.tileAt = Util.tileAt;
window.tilesAt = Util.tilesAt;

export {Util};
