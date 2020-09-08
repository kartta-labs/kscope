// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview This file implements a class to run a 3D slippy map.
 */

import {RenderView} from "./render_view.js";
import {GeoPoint} from "./geospatial_utils.js";

class Slippy {
    constructor(settings) {
      this.widthMercatorX = settings.tileWidthInMercator;// 0.00002;
      this.heightMercatorY = this.widthMercatorX;
      this.overlap = 0.25;
      this.renderViews = {};
      this.settings = settings;
      this.currentTileCenter = Slippy.toGeoPoint(settings.origin);
      this.currentRenderView = this.createNewRenderView(this.currentTileCenter);
      this.currentBbox = this.createTileBbox(this.currentTileCenter);
    }
  
    static toGeoPoint(point) {
      return new GeoPoint(
        point.latitudeInMicroDegrees,
        point.longitudeInMicroDegrees);
    }
  
    createTileBbox(position) {
      const mercatorX = position.getMercatorXfromLongitude();
      const mercatorY = position.getMercatorYfromLatitude();
  
      const nonOverlappingTileWidthMercatorX = (1.0 - this.overlap) * this.widthMercatorX;
      const nonOverlappingTileHeightMercatorY = (1.0 - this.overlap) * this.heightMercatorY;
  
      const tileCenterMercatorX = (Math.floor(mercatorX / nonOverlappingTileWidthMercatorX) + 0.5) * nonOverlappingTileWidthMercatorX;
      const tileCenterMercatorY = (Math.floor(mercatorY / nonOverlappingTileHeightMercatorY) + 0.5) * nonOverlappingTileHeightMercatorY;
  
      const bottomLeftMercatorX = tileCenterMercatorX - this.widthMercatorX/2;
      const bottomLeftMercatorY = tileCenterMercatorY - this.heightMercatorY/2;
      const topRightMercatorX = tileCenterMercatorX + this.widthMercatorX/2;
      const topRightMercatorY = tileCenterMercatorY + this.heightMercatorY/2;
      const bottomLeft = new GeoPoint(0,0);
      bottomLeft.resetFromMecator(bottomLeftMercatorX, bottomLeftMercatorY);
      const topRight = new GeoPoint(0,0);
      topRight.resetFromMecator(topRightMercatorX, topRightMercatorY);
  
      const bbox = [bottomLeft.getLongitudeInDegrees(), bottomLeft.getLatitudeInDegrees(), topRight.getLongitudeInDegrees(), topRight.getLatitudeInDegrees()].join();
      return bbox;
    }
  
    createNewRenderView(center) {
      // Do a deep copy.
      const settings = JSON.parse(JSON.stringify(this.settings));
      settings.tileCenter = center;
      const renderView = new RenderView(settings);
      const bbox = this.createTileBbox(center);
      Slippy.fetchFeatures(renderView, bbox);
      this.renderViews[bbox] = renderView;
      return renderView;
    }
  
    deleteRenderView(center) {
      return;
      const bbox = this.createTileBbox(center);
      const renderView = this.renderViews[bbox];
      const scene = renderView.scene;
      // TODO: Traverse scene and dispose() all objects,
      // materials, textures, etc.
    }
  
    setRenderViewIfReady(geoPosition) {
      const bbox = this.createTileBbox(geoPosition)
      if (!(bbox in this.renderViews)) {
          this.createNewRenderView(geoPosition);
      }// else if (this.renderViews[bbox].processedFeatures){
        this.currentRenderView = this.renderViews[bbox];
        this.currentBbox = bbox;
      //}
    }
  
    static metersToGeoPoint(positionInMeters, originMeters, originGeoPoint) {
      const deltaXMeters = positionInMeters['x'] - originMeters['x'];
      // The z component of vector positionInMeters is horizontal.
      // The -y in world coordinates is northbound.
      const deltaYMeters = -positionInMeters['z'] - originMeters['y'];
      const deltaMercatorX = deltaXMeters * originGeoPoint.getOneMeterInMercatorUnit();
      const deltaMercatorY = deltaYMeters * originGeoPoint.getOneMeterInMercatorUnit();
  
      const mercatorX = originGeoPoint.getMercatorXfromLongitude() + deltaMercatorX;
      const mercatorY = originGeoPoint.getMercatorYfromLatitude() + deltaMercatorY;
      const geo = new GeoPoint(0,0);
      geo.resetFromMecator(mercatorX, mercatorY);
      return geo;
    }
  
    watch(positionInMeters, callback) {
      const geoPosition = Slippy.metersToGeoPoint(positionInMeters, {'x':0, 'y':0}, this.currentRenderView.sceneOrigin);
      const bbox = this.createTileBbox(geoPosition)
      if (bbox != this.currentBbox){
        this.setRenderViewIfReady(geoPosition);
        callback();
        this.currentBbox = bbox;
      }
    }
  
    /**
     * This functions calls the Kartta API to fetch the historical maps data.
     * @param {function(!Object)} callback Callback function to process the response returned
     *     from Kartta Labs API.
     */
    static fetchFeatures(renderView, bbox) {
      const settings = renderView.settings;
      const url = settings.fullUrl
                ? settings.fullUrl
                : settings.endpoint + '?bbox=' + bbox;
      fetch(url)
          .then(response => response.json())
          .then(data => renderView.processFeatures(data))
          .catch(e => console.log(e));
    }
  }

export {Slippy};