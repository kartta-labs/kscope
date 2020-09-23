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

export {Util};
