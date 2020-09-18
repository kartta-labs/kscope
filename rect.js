const Rect = {};

Rect.rect = (xzMin, xzMax, options) => {
    const lineMat = new THREE.LineBasicMaterial({
        color: options.color || 0xffffff,
        linewidth: options.linewidth || 3
    });
    const container = new THREE.Object3D();
    const geom = new THREE.Geometry();
    const y = options.y || y;

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
    const material = new THREE.MeshBasicMaterial( { color: options.color || 0xffffff } );
    const container = new THREE.Object3D();
    const geom = new THREE.Geometry();
    const y = options.y || y;

    geom.vertices.push(new THREE.Vector3(xzMin.x, y, xzMin.y));
    geom.vertices.push(new THREE.Vector3(xzMax.x, y, xzMin.y));
    geom.vertices.push(new THREE.Vector3(xzMax.x, y, xzMax.y));
    geom.vertices.push(new THREE.Vector3(xzMin.x, y, xzMax.y));

    geom.faces.push(new THREE.Face3(0, 1, 2));
    geom.faces.push(new THREE.Face3(2, 3, 0));

    const mesh = new THREE.Mesh( geom, material ) ;

    container.add(mesh);
    return container;
};

export {Rect};
