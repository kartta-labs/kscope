

import {Util} from "./util.js";
import {Settings} from "./settings.js";
import {SkyBox} from "./skybox.js";

class App {
  /**
   */
  constructor(container) {
    this.container = container;
    this.camera = null;
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize( this.container.offsetWidth, this.container.offsetHeight );
    this.renderer.setClearColor( 0x6666ff, 1 );
    //this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
    this.container.appendChild( this.renderer.domElement );
    //this.event_tracker = new EventTracker(this.container);

    this.center = new THREE.Object3D();
    this.center.position.set(0,0,0);
    this.scene.add(this.center);

//??    this.movingCenterFrameTransformer = new MovingCenterFrameTransformer();
//??
//??    this.eventMode = 'look';
//??
//??    this.event_tracker.setMouseDownListener(e => {
//??      //console.log('mouseDown: e = ', e);
//??    }).setMouseUpListener(e => {
//??      //console.log('mouseUp: e = ', e);
//??    }).setMouseDragListener((p, dp, button) => {
//??      //console.log('mouseDrag: dp = ', dp);
//??
//??      let M;
//??
//??      if (this.eventMode == 'orbit') {
//??        const v = new THREE.Vector3(dp.y, dp.x, 0).normalize();
//??        const d = Math.sqrt(dp.x*dp.x + dp.y*dp.y);
//??        const angle = (d / this.container.offsetWidth) * Math.PI;
//??        const L = new THREE.Matrix4().makeRotationAxis(v, angle);
//??        M = this.movingCenterFrameTransformer.computeTransform(
//??            /* moving= */ this.camera,
//??            /* center= */ this.center,
//??            /* frame= */ this.camera,
//??            L);
//??      } else if (this.eventMode == 'look') {
//??        const v = new THREE.Vector3(dp.y, dp.x, 0).normalize();
//??        const d = Math.sqrt(dp.x*dp.x + dp.y*dp.y);
//??        const angle = (d / this.container.offsetWidth) * Math.PI;
//??        const L = new THREE.Matrix4().makeRotationAxis(v, angle);
//??        M = this.movingCenterFrameTransformer.computeTransform(
//??            /* moving= */ this.camera,
//??            /* center= */ this.camera,
//??            /* frame= */ this.camera,
//??            L);
//??      }
//??
//??      this.camera.matrix.multiplyMatrices(this.camera.matrix, M);
//??      this.camera.matrixWorldNeedsUpdate = true;
//??      this.render();
//??    }).setMouseWheelListener(e => {
//??      //console.log('mouseWheel: e = ', e);
//??    }).setKeyPressListener(e => {
//??      if (e.key == 'w') {
//??        this.handlePointerLockEvent(
//??            /* moveForward= */ true,
//??            /* moveBackward= */ false,
//??            /* moveLeft= */ false,
//??            /* moveRight= */ false
//??        );
//??      } else if (e.key == 's') {
//??        this.handlePointerLockEvent(
//??            /* moveForward= */ false,
//??            /* moveBackward= */ true,
//??            /* moveLeft= */ false,
//??            /* moveRight= */ false
//??        );
//??      } else if (e.key == 'a') {
//??        this.handlePointerLockEvent(
//??            /* moveForward= */ false,
//??            /* moveBackward= */ false,
//??            /* moveLeft= */ true,
//??            /* moveRight= */ false
//??        );
//??      } else if (e.key == 'd') {
//??        this.handlePointerLockEvent(
//??            /* moveForward= */ false,
//??            /* moveBackward= */ false,
//??            /* moveLeft= */ false,
//??            /* moveRight= */ true
//??        );
//??      }
//??      //console.log('keyPress: e = ', e);
//??    }).setKeyUpListener(e => {
//??      //console.log('keyUp: e = ', e);
//??      if (e.key == 'l') {
//??        this.eventMode = 'look';
//??      } else if (e.key == 'o') {
//??        this.eventMode = 'orbit';
//??      } else if (e.key == 'g') {
//??        if (this.controls) {
//??          this.camera.matrixWorld.decompose(this.camera.position,
//??                                            this.camera.quaternion,
//??                                            this.camera.scale);
//??          this.camera.matrixAutoUpdate = true;
//??          this.controls.lock();
//??        }
//??      }
//??    });
//??    this.event_tracker.start();

  }

  initializeLights() {
    // Add ambient lights.
    Settings.lights.Ambient.forEach((item) => {
      this.scene.add(new THREE.AmbientLight(item.color, item.intensity));
    });
    // Add directional lights (no shadows).
    Settings.lights.directional.forEach((item) => {
      const light = new THREE.DirectionalLight(item.color, item.intensity);
      light.position.set(item.position.x, item.position.y, item.position.z);
      this.scene.add(light);
    });
  }

  initializeCamera(initial_gaze_point) {
    this.camera = new THREE.PerspectiveCamera(
        Settings.fieldOfView,
        /* aspectRatio= */ this.container.offsetWidth/this.container.offsetHeight,
        Settings.nearPlane, Settings.farPlane);

    // Sets the camera height to human height (2m) looking to the center of the
    // scene from 10m away.
    this.camera.position.set(0, Settings.eyeHeightInMeters, -10);
    this.camera.up.set(0, 1, 0);
    // IMPORTANT: camera.lookAt only works if camera.matrixAutoUpdate is true so it must
    //    be called BEFORE setting camera.matrixAutoUpdate to false below!!!
    this.camera.lookAt(0, 0, 0);

    this.camera.matrixAutoUpdate = false;
    this.camera.updateMatrix();
    this.camera.matrixWorldNeedsUpdate = true;

    this.scene.add(this.camera);
  }

  initializeGround() {
    return Util.LoadTexture('images/asphalt.jpg')
          .then((asphalt) => {
            asphalt.repeat.set(2000, 2000);
            asphalt.wrapS = THREE.RepeatWrapping;
            asphalt.wrapT = THREE.RepeatWrapping;
            const planeMaterial = new THREE.MeshStandardMaterial({
              map: asphalt,
              side: THREE.DoubleSide
            });
            const planeGeometry = new THREE.PlaneGeometry(Settings.farPlane, Settings.farPlane);
            const plane = new THREE.Mesh(planeGeometry, planeMaterial);
            plane.rotation.x = -Math.PI / 2;
            plane.name = 'ground';
            if (Settings.shadows) {
              plane.receiveShadow = true;
            }
            this.scene.add(plane);
          });
  }

  initializeSky() {
    const sb = new SkyBox();
    return sb.getObject().then(skyboxObject => {
      this.scene.add(skyboxObject);
    });
  }

  render() {
    requestAnimationFrame(() => {
      this.renderer.render( this.scene, this.camera )
    });
  }

  initialize() {
    // lights
    this.initializeLights();

    // camera
    this.initializeCamera(/* initial_gaze_point= */ this.scene.position);

    // action!
    const promises = [];
    promises.push(this.initializeGround());
    promises.push(this.initializeSky());
    Promise.all(promises).then(() => {
      this.render();
    });

  }
}

export {App};
