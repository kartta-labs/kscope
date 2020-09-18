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

    this.specialKeys = {
      'Tab': true,
      'Escape': true,
      'Delete': true,
      'Backspace': true
    };

    this.mouseDown = (event) => {
      this.mouseIsDown = true;
      this.lastP = this.relCoords(event);
      this.lastTime = event.timeStamp;
      if (this.mouseDownListener) {
        this.mouseDownListener(this.lastP);
      }
      window.addEventListener('mousemove', this.mouseMove);
      window.addEventListener('mouseup', this.mouseUp);
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
      window.removeEventListener('mousemove', this.mouseMove);
      window.removeEventListener('mouseup', this.mouseUp);
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
      if (!(event.key in this.specialKeys) && this.keyPressListener) { this.keyPressListener(event); }
    };

    this.keyUp = (event) => {
      if (!(event.key in this.specialKeys) && this.keyUpListener) { this.keyUpListener(event); }
    };

  }

  setMouseDownListener(listener) {
    this.mouseDownListener = listener;
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

  relCoords(event) {
    return { x : event.pageX - this.dom_element.offsetLeft,
             y : event.pageY - this.dom_element.offsetTop };
  }

  start() {
    window.addEventListener( 'keypress',   this.keyPress,  false );
    window.addEventListener( 'keyup',      this.keyUp,     false );
    this.dom_element.addEventListener( 'mousedown',  this.mouseDown,  false );
	this.dom_element.addEventListener( 'mousewheel', this.mouseWheel, false );
  }

};

export {EventTracker};
