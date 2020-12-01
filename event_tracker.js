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

class EventTracker {

  constructor(dom_element) {
    this.dom_element = dom_element;
    this.mouseIsDown = false;
    this.lastP = null;
    this.lastDrag = null;
    this.lastTime = null;
    this.mouseDownListener = null;
    this.mouseDragListener = null;
    this.mouseUpListener = null;
    this.mouseWheelListener = null;
    this.keyPressListener = null;
    this.keyUpListener = null;
    this.keyDownListener = null;
    this.lastTouchP = null;

    this.specialKeys = {
      'Tab': true,
      'Escape': true,
      'Delete': true,
      'Backspace': true
    };

    this.touchStart = (event) => {
      event.preventDefault();
      this.lastTouchP = this.relTouchCoords(event);
      this.lastTouchTime = event.timeStamp;
      if (this.touchStartListener) {
        this.touchStartListener(this.lastTouchP);
      }
    };

    this.touchMove = (event) => {
      event.preventDefault();
      const p = this.relTouchCoords(event);
      const t = event.timeStamp;
      this.lastTouchMove = p.map((p,i) => {
        return {
          x : p.x - this.lastTouchP[i].x,
	      y : p.y - this.lastTouchP[i].y
	    };
      });
      if (this.touchMoveListener) {
        this.touchMoveListener(p, this.lastTouchMove);
      }
      this.lastTouchP = p;
      this.lastTouchTime = t;
    };

    this.mouseDown = (event) => {
      this.mouseIsDown = true;
      this.lastP = this.relCoords(event);
      this.lastTime = event.timeStamp;
      if (this.mouseDownListener) {
        this.mouseDownListener(this.lastP);
      }
    };

    this.mouseMove = (event) => {
      const p = this.relCoords(event);
      const t = event.timeStamp;
      if (this.mouseIsDown) {
        this.lastDrag = { x : p.x - this.lastP.x, y : p.y - this.lastP.y };
        if (this.mouseDragListener) {
          this.mouseDragListener(p, this.lastDrag, event.button);
        }
        this.lastP = p;
        this.lastTime = t;
      } else {
        if (this.mouseMoveListener) {
          this.mouseMoveListener(p, event.button);
        }
      }
    };

    this.mouseUp = (event) => {
      const p = this.relCoords(event);
      const t = event.timeStamp;
      this.mouseIsDown = false;
      if (this.mouseUpListener) {
        this.mouseUpListener(p, t - this.lastTime, this.lastDrag, event);
      }
      this.lastP = p;
      this.lastTime = t;
    };

    this.mouseWheel = (event) => {
      if (this.mouseWheelListener) {
	    event.preventDefault();
	    event.stopPropagation();
	    let delta = 0;
	    if ( event.wheelDelta ) { // WebKit / Opera / Explorer 9
		  delta = event.wheelDelta / 40;
	    } else if ( event.detail ) { // Firefox
		  delta = - event.detail / 3;
	    }
        const p = this.relCoords(event);
        this.mouseWheelListener(delta, p);
      }
    };

    this.keyPress = (event) => {
      if (this.keyPressListener) { this.keyPressListener(event); }
    };

    this.keyUp = (event) => {
      if (this.keyUpListener) { this.keyUpListener(event); }
    };

    this.keyDown = (event) => {
      if (this.keyDownListener) { this.keyDownListener(event); }
    };

  }

  setTouchStartListener(listener) {
    this.touchStartListener = listener;
    return this;
  }
  setTouchMoveListener(listener) {
    this.touchMoveListener = listener;
    return this;
  }
  setMouseDownListener(listener) {
    this.mouseDownListener = listener;
    return this;
  }
  setMouseMoveListener(listener) {
    this.mouseMoveListener = listener;
    return this;
  }
  setMouseDragListener(listener) {
    this.mouseDragListener = listener;
    return this;
  }
  setMouseUpListener(listener) {
    this.mouseUpListener = listener;
    return this;
  }
  setMouseWheelListener(listener) {
    this.mouseWheelListener = listener;
    return this;
  }
  setKeyPressListener(listener) {
    this.keyPressListener = listener;
    return this;
  }
  setKeyUpListener(listener) {
    this.keyUpListener = listener;
    return this;
  }
  setKeyDownListener(listener) {
    this.keyDownListener = listener;
    return this;
  }

  relCoords(event) {
    return { x : event.pageX - this.dom_element.offsetLeft,
             y : event.pageY - this.dom_element.offsetTop,
             button: event.button };
  }

  relTouchCoords(event) {
    const touchP = [];
    for (let i = 0; i < event.touches.length; ++i) {
      touchP.push(this.relCoords(event.touches[i]));
    }
    return touchP;
  }

  start() {
    this.dom_element.addEventListener( 'keypress',   this.keyPress,  false );
    this.dom_element.addEventListener( 'keyup',      this.keyUp,     false );
    this.dom_element.addEventListener( 'keydown',    this.keyDown,   false );
    this.dom_element.addEventListener( 'mousedown',  this.mouseDown,  false );
    this.dom_element.addEventListener( 'mousewheel', this.mouseWheel, false );
    this.dom_element.addEventListener( 'mousemove', this.mouseMove, false);
    this.dom_element.addEventListener( 'mouseup', this.mouseUp, false);
    this.dom_element.addEventListener( 'touchstart', this.touchStart, false );
    this.dom_element.addEventListener( 'touchmove', this.touchMove, false );
    this.dom_element.addEventListener( 'contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

  }

};

export {EventTracker};
