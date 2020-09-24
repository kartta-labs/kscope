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
 * Updates the current page url without triggering a page reload, and without changing navigation history.
 * Takes an object containing parameter name,value settings, and affects only those parameter values in the
 * url -- any parameters present in the url and not present in params are left unchanged.
 */
Util.updatePageUrl = (params) => {
  const url = new URL(document.location);
  Object.keys(params).forEach(key => {
    url.searchParams.set(key, params[key]);
  });
  window.history.replaceState(
      null, '',
      location.origin + location.pathname + '?' + url.searchParams.toString());
};

Util.stringToBoolean = (s) => {
  s = s.toLowerCase();
  return s == "yes" || s == "true" || s == "1";
};

Util.setOptionFromUrlParams = (options, params, name, parse) => {
  if (params.has(name)) {
    options[name] = parse ? parse(params.get(name)) : params.get(name);
  }
};


export {Util};
