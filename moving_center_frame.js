/**
 * Moving/center/frame transformation computer.
 *
 * Takes 3 THREE.js objects: moving, center, and frame, and a 4x4 matrix L.
 * L is the matrix of a spatial transformation, expressed in the coordinate
 * system of the `frame` object translated so as to move its origin to the
 * origin of the `center` system.
 *
 * Returns the 4x4 matrix representing the same transformation L, but expressed
 * in the coordinate system of the `moving` object.
 */
class MovingCenterFrame {

  constructor() {
    this.Q     = new THREE.Matrix4();
    this.QInv  = new THREE.Matrix4();
    this.V     = new THREE.Matrix4();
    this.TfInv = new THREE.Matrix4();
    this.TmInv = new THREE.Matrix4();
    this.P     = new THREE.Matrix4();
    this.PInv  = new THREE.Matrix4();
  }

  computeTransform(moving, center, frame, L) {
    const Tm = moving.matrixWorld;
    const Tf = frame.matrixWorld;
    const Tc = center.matrixWorld;
    this.TfInv.getInverse(Tf);
    this.TmInv.getInverse(Tm);

    const ce = Tc.elements;
    const fe = Tf.elements;

    this.P.set(1, 0, 0, fe[12] - ce[12],
               0, 1, 0, fe[13] - ce[13],
               0, 0, 1, fe[14] - ce[14],
               0, 0, 0, 1);

    this.Q.identity();
    this.Q.multiply(this.TfInv);
    this.Q.multiply(this.P);
    this.Q.multiply(Tm);

    this.QInv.getInverse(this.Q);

    this.V.identity();
    this.V.multiply(this.QInv);
    this.V.multiply(L);
    this.V.multiply(this.Q);

    return this.V;
  }


}

export {MovingCenterFrame};
