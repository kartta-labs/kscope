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


/**
 * Converts a geojson feature to a THREE.Shape instance in scene coords.
 * @param feature {Objet} a geojson object
 * @param coords {Coords} the coordinate system for converting the geojson (lon,lat) coords to scene coords
 * @return {THREE.Shape} a new THREE.Shape instance
 */
Util.featureToSceneCoordsShape = (feature, coords) => {
  // Convert the coordinate array in the feature to an array of THREE.Vector2 containing lon,lat in degrees.
  // Note this only uses the first array (outer ring? first polygon?) in the coordinates array.
  // TODO: generalize this to incorporate all coordinates.
  const lonLatDegreesArray = feature.geometry.coordinates[0].map(lonLatDegrees => new THREE.Vector2(lonLatDegrees[0], lonLatDegrees[1]));
  // Convert to scene coords
  const sceneCoordsArray = lonLatDegreesArray.map(lonLatDegrees => coords.lonLatDegreesToSceneCoords(lonLatDegrees));
  // Create the shape
  return new THREE.Shape(sceneCoordsArray);
}


export {Util};
