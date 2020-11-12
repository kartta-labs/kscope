import {Util} from "./util.js";

class TextureCanvas {

  constructor(canvasWidthPixels, canvasHeightPixels, xMin, yMin, xMax, yMax) {
    this.canvasWidthPixels = canvasWidthPixels;
    this.canvasHeightPixels = canvasHeightPixels;
    this.canvas = document.createElement("canvas"); //document.getElementById("debugdebugcanvas");
    this.canvas.width = canvasWidthPixels;
    this.canvas.height = canvasHeightPixels;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.texture = new THREE.Texture( this.canvas );
    this.setCoords(xMin, yMin, xMax, yMax);
    this.clear();
  }

  getTexture() {
    return this.texture;
  }

  setCoords(xMin, yMin, xMax, yMax) {
    this.xMin = xMin;
    this.yMin = yMin;
    this.xMax = xMax;
    this.yMax = yMax;
    this.xInterp = new Util.LinearInterpolator(xMin,xMax,0,this.canvasWidthPixels);
    this.yInterp = new Util.LinearInterpolator(yMin,yMax,0,this.canvasHeightPixels);
  }

  coords(x,y) {
    return [this.xInterp.interpolate(x), this.yInterp.interpolate(y)];
  }

  clear() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.texture.needsUpdate = true;
  }
  fillStyle(style) {
      this.ctx.fillStyle = style;
      this.texture.needsUpdate = true;
  }
  lineWidth(w) {
      this.ctx.lineWidth = w;
      this.texture.needsUpdate = true;
  }
  strokeStyle(style) {
      this.ctx.strokeStyle = style;
      this.texture.needsUpdate = true;
  }
  fillRect(x,y,w,h) {
      this.ctx.fillRect(this.xInterp.interpolate(x), this.yInterp.interpolate(y),
                    this.xInterp.scale(w),  this.yInterp.scale(h));
      this.texture.needsUpdate = true;
  }
  beginPath() {
    this.ctx.beginPath();
  }
  closePath() {
    this.ctx.closePath();
  }
  moveTo(x,y) {
      this.ctx.moveTo(this.xInterp.interpolate(x), this.yInterp.interpolate(y));
      this.texture.needsUpdate = true;
  }
  lineTo(x,y) {
      this.ctx.lineTo(this.xInterp.interpolate(x), this.yInterp.interpolate(y));
      this.texture.needsUpdate = true;
  }
  stroke() {
      this.ctx.stroke();
      this.texture.needsUpdate = true;
  }
  fill() {
      this.ctx.fill();
      this.texture.needsUpdate = true;
  }
  arc(x,y,r,a0,a1) {
      this.ctx.arc(this.xInterp.interpolate(x),
               this.yInterp.interpolate(y),
               this.xInterp.scale(r),
               a0,a1);
      this.texture.needsUpdate = true;
  }

}

export {TextureCanvas};
