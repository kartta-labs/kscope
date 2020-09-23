const EARTH_RADIUS_METERS = 6378137;
const EQUATOR_CIRCUMFERENCE_METERS = 2 * Math.PI * EARTH_RADIUS_METERS;
const MAX_LAT = 85.051129;
const INVERSE_PRECISION_METERS = 0.1;
const INVERSE_MAX_ITERATIONS = 100;

class Coords {

  static degreesToRadians(degrees) {
    return degrees / 180 * Math.PI;
  }

  static mercatorYFromLatDegrees(latDegrees) {
    return Math.log(Math.tan(Math.PI / 4.0 + Coords.degreesToRadians(latDegrees) / 2.0)) / Math.PI;
  }

  static mercatorXFromLonDegrees(lonDegrees) {
    return lonDegrees / 180;
  }

  static circumferenceAtLatRadians(latRadians) {
    return EQUATOR_CIRCUMFERENCE_METERS * Math.cos(latRadians);
  }

  static oneMeterInMercatorAtLatRadians(latRadians) {
    // The constant number "2" is the extent of Mercator Coordinates, i.e.:
    // max(MercatorX) - min(MercatorX) = 1 - (-1) = 2.
    return 2 / Coords.circumferenceAtLatRadians(latRadians);
  }

  static oneMeterInMercatorAtLatDegrees(latDegrees) {
    return Coords.oneMeterInMercatorAtLatRadians(Coords.degreesToRadians(latDegrees));
  }


  /**
   * Find the inverse value of a monotonic function by bisection.
   *
   * @param f function to be inverted
   * @param fx value to find the inverse at
   * @param x0 x value known to be on one side of the solution
   * @param fx0 f(x0)
   * @param x1 x value known to be on the other side of the solution
   * @param fx1 f(x1)
   * @param precision
   * @param maxIterations
   *
   * Returns the first x value for which |f(x)-fx|<=precision, or after maxIterations iterations.
   * Assumes fx0 < fx1; caller must ensure that.
   */
  static invertByBisection(f, fx, x0, fx0, x1, fx1, epsilon, maxIterations) {
    for (let i = 0; i < maxIterations; ++i) {
      let xMid = (x0 + x1)/2;
      let fxMid = f(xMid);
      if (Math.abs(fxMid - fx) <= epsilon) {
        return xMid;
      }
      if (fx < fxMid) {
        x1 = xMid;
        fx1 = fxMid;
      } else {
        x0 = xMid;
        fx0 = fxMid;
      }
    }
  }

  constructor(sceneOriginLonLatDegrees) {
    this.sceneOriginLonLatDegrees = sceneOriginLonLatDegrees;
    this.sceneOriginMercator = new THREE.Vector2(
      Coords.mercatorXFromLonDegrees(sceneOriginLonLatDegrees.x),
      Coords.mercatorYFromLatDegrees(sceneOriginLonLatDegrees.y));
  }

  lonLatDegreesToSceneCoords(lonLatDegrees) {
    const oneMeter = Coords.oneMeterInMercatorAtLatDegrees(lonLatDegrees.y);
    return new THREE.Vector2(
       (Coords.mercatorXFromLonDegrees(lonLatDegrees.x) - this.sceneOriginMercator.x) / oneMeter,
      -(Coords.mercatorYFromLatDegrees(lonLatDegrees.y) - this.sceneOriginMercator.y) / oneMeter,
    );
  }

  /**
   * Implementation of just the lat/y part of lonLatDegreesToSceneCoords().  This is just used
   * internally by sceneCoordsToLatLonDegrees(), which uses approximation to invert this function.
   */
  latDegreesToSceneY(lat) {
      return -(Coords.mercatorYFromLatDegrees(lat) - this.sceneOriginMercator.y) / Coords.oneMeterInMercatorAtLatDegrees(lat);
  }

  /**
   * Returns an approximation of the geographics (lon,lat) coordinates which correspond to
   * the given scene coordinates.
   */
  sceneCoordsToLatLonDegrees(scenePoint) {
    const lat = Coords.invertByBisection(lat => this.latDegreesToSceneY(lat),
                                         scenePoint.y,
                                         MAX_LAT, this.latDegreesToSceneY(MAX_LAT),
                                         -MAX_LAT, this.latDegreesToSceneY(-MAX_LAT),
                                         INVERSE_PRECISION_METERS,
                                         INVERSE_MAX_ITERATIONS);
    const oneMeter = Coords.oneMeterInMercatorAtLatDegrees(lat);
    const lon = 180.0 * (scenePoint.x * oneMeter + this.sceneOriginMercator.x);
    return new THREE.Vector2(lon, lat);
  }

}

export {Coords};
