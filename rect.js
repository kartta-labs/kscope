const Rect = {};

Rect.rect = (xzMin, xzMax, options) => {
    const lineMat = new THREE.LineBasicMaterial({
        color: options.axisColor || 0xffffff,
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

export {Rect};
