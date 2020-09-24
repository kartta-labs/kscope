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

  static latDegreesFromMercatorY(mercatorY) {
    return (2.0 * Math.atan(Math.exp(Math.PI * mercatorY))*180/Math.PI - 90);
  }

  static lonDegreesFromMercatorX(mercatorX) {
    return mercatorX * 180;
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

  constructor(sceneOriginLonLatDegrees) {
    this.sceneOriginLonLatDegrees = sceneOriginLonLatDegrees;
    this.sceneOriginMercator = new THREE.Vector2(
      Coords.mercatorXFromLonDegrees(sceneOriginLonLatDegrees.x),
      Coords.mercatorYFromLatDegrees(sceneOriginLonLatDegrees.y));
    this.oneMeterInMercatorAtSceneOriginLatitude =
      Coords.oneMeterInMercatorAtLatDegrees(this.sceneOriginLonLatDegrees.y);
  }

  lonLatDegreesToSceneCoords(lonLatDegrees) {
    return new THREE.Vector2(
       (Coords.mercatorXFromLonDegrees(lonLatDegrees.x) - this.sceneOriginMercator.x) / this.oneMeterInMercatorAtSceneOriginLatitude,
      -(Coords.mercatorYFromLatDegrees(lonLatDegrees.y) - this.sceneOriginMercator.y) / this.oneMeterInMercatorAtSceneOriginLatitude,
    );
  }

  sceneCoordsToLatLonDegrees(scenePoint) {
    const oneMeter = Coords.oneMeterInMercatorAtLatDegrees(this.sceneOriginLonLatDegrees.y);
    return new THREE.Vector2(Coords.lonDegreesFromMercatorX(this.sceneOriginMercator.x + scenePoint.x * this.oneMeterInMercatorAtSceneOriginLatitude),
                             Coords.latDegreesFromMercatorY(this.sceneOriginMercator.y - scenePoint.y * this.oneMeterInMercatorAtSceneOriginLatitude));
  }
}

export {Coords};
