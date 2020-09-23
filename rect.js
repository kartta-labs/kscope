const Rect = {};

Rect.rect = (xzMin, xzMax, options) => {
    const lineMat = new THREE.LineBasicMaterial({
        color: ('color' in options) ? options.color : 0xffffff,
        linewidth: options.linewidth || 3
    });
    const container = new THREE.Object3D();
    const geom = new THREE.Geometry();
    const y = options.y || 0;

    geom.vertices.push(new THREE.Vector3(xzMin.x, y, xzMin.y));
    geom.vertices.push(new THREE.Vector3(xzMax.x, y, xzMin.y));

    geom.vertices.push(new THREE.Vector3(xzMax.x, y, xzMin.y));
    geom.vertices.push(new THREE.Vector3(xzMax.x, y, xzMax.y));

    geom.vertices.push(new THREE.Vector3(xzMax.x, y, xzMax.y));
    geom.vertices.push(new THREE.Vector3(xzMin.x, y, xzMax.y));

    geom.vertices.push(new THREE.Vector3(xzMin.x, y, xzMax.y));
    geom.vertices.push(new THREE.Vector3(xzMin.x, y, xzMin.y));

    container.add(new THREE.LineSegments(geom, lineMat));
    return container;
};

Rect.solidRect = (xzMin, xzMax, options) => {
    const material = new THREE.MeshBasicMaterial( {
      color: 'color' in options ? options.color : 0xffffff
    });
    const container = new THREE.Object3D();
    const geom = new THREE.Geometry();
    const y = options.y || 0;

    geom.vertices.push(new THREE.Vector3(xzMin.x, y, xzMin.y));
    geom.vertices.push(new THREE.Vector3(xzMax.x, y, xzMin.y));
    geom.vertices.push(new THREE.Vector3(xzMax.x, y, xzMax.y));
    geom.vertices.push(new THREE.Vector3(xzMin.x, y, xzMax.y));

    geom.faces.push(new THREE.Face3(0, 1, 2));
    geom.faces.push(new THREE.Face3(2, 3, 0));

    const mesh = new THREE.Mesh( geom, material ) ;

    container.add(mesh);

    if ('outlinecolor' in options) {
      container.add(Rect.rect(xzMin, xzMax, {
        color: options.outlinecolor,
        y: y + 0.05
      }));
    }

    return container;
};

export {Rect};
