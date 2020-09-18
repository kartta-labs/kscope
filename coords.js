const EARTH_RADIUS_METERS = 6378137;
const EQUATOR_CIRCUMFERENCE_METERS = 2 * Math.PI * EARTH_RADIUS_METERS;

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

}

export {Coords};
