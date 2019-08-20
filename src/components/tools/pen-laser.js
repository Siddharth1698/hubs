const InterpolationBuffer = require("buffered-interpolation");
import MobileStandardMaterial from "../../materials/MobileStandardMaterial";

function almostEquals(epsilon, u, v) {
  return Math.abs(u.x - v.x) < epsilon && Math.abs(u.y - v.y) < epsilon && Math.abs(u.z - v.z) < epsilon;
}

AFRAME.registerComponent("pen-laser", {
  schema: {
    color: { type: "color", default: "#FF0033" },
    availableColors: {
      default: [
        "#FF0033",
        "#FFFF00",
        "#0099FF",
        "#00FF33",
        "#9900FF",
        "#FF6600",
        "#8D5524",
        "#C68642",
        "#E0AC69",
        "#F1C27D",
        "#FFDBAC",
        "#FFFFFF",
        "#222222",
        "#111111",
        "#000000"
      ]
    },
    laserVisible: { default: false },
    remoteLaserVisible: { default: false },
    laserOrigin: { default: { x: 0, y: 0, z: 0 } },
    remoteLaserOrigin: { default: { x: 0, y: 0, z: 0 } },
    laserTarget: { default: { x: 0, y: 0, z: 0 } }
  },

  init() {
    let material = new THREE.MeshStandardMaterial({ color: "red", opacity: 0.5, transparent: true, visible: true });
    if (window.APP && window.APP.quality === "low") {
      material = MobileStandardMaterial.fromStandardMaterial(material);
    }

    const lineCurve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
    const geometry = new THREE.TubeBufferGeometry(lineCurve, 2, 0.003, 8, true);
    this.laser = new THREE.Mesh(geometry, material);

    this.laserTip = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 16, 12), material);
    this.laserTip.scale.setScalar(0.01);
    this.laserTip.matrixNeedsUpdate = true;

    const environmentMapComponent = this.el.sceneEl.components["environment-map"];
    if (environmentMapComponent) {
      environmentMapComponent.applyEnvironmentMap(this.laser);
    }

    //prevents the line from being a raycast target for the cursor
    this.laser.raycast = function() {};

    this.el.sceneEl.setObject3D(`pen-laser-${this.laser.uuid}`, this.laser);
    this.el.sceneEl.setObject3D(`pen-laser-tip-${this.laser.uuid}`, this.laserTip);

    this.originBuffer = new InterpolationBuffer(InterpolationBuffer.MODE_LERP, 0.1);
    this.targetBuffer = new InterpolationBuffer(InterpolationBuffer.MODE_LERP, 0.1);
  },

  update: (() => {
    const originBufferPosition = new THREE.Vector3();
    const targetBufferPosition = new THREE.Vector3();

    return function(prevData) {
      if (prevData.color != this.data.color) {
        this.laser.material.color.set(this.data.color);
      }

      if (prevData.remoteLaserOrigin && !almostEquals(0.001, prevData.remoteLaserOrigin, this.data.remoteLaserOrigin)) {
        this.originBuffer.setPosition(
          originBufferPosition.set(
            this.data.remoteLaserOrigin.x,
            this.data.remoteLaserOrigin.y,
            this.data.remoteLaserOrigin.z
          )
        );
      }

      if (prevData.laserTarget && !almostEquals(0.001, prevData.laserTarget, this.data.laserTarget)) {
        this.targetBuffer.setPosition(
          targetBufferPosition.set(this.data.laserTarget.x, this.data.laserTarget.y, this.data.laserTarget.z)
        );
      }
    };
  })(),

  tick(_, dt) {
    const isMine = this.el.parentEl.components.networked.initialized && this.el.parentEl.components.networked.isMine();
    let laserVisible = false;
    let origin, target;

    if (isMine && this.data.laserVisible) {
      origin = this.data.laserOrigin;
      target = this.data.laserTarget;
    } else if (!isMine && this.data.remoteLaserVisible) {
      this.originBuffer.update(dt);
      this.targetBuffer.update(dt);
      origin = this.originBuffer.getPosition();
      target = this.targetBuffer.getPosition();
    }

    if (origin && target) {
      this.laser.position.copy(origin);
      this.laser.lookAt(target);
      this.laser.scale.set(1, 1, origin.distanceTo(target) * 2); //multiply by 2 because parent scale is 0.5
      this.laser.matrixNeedsUpdate = true;
      this.laserTip.position.copy(target);
      this.laserTip.matrixNeedsUpdate = true;
      laserVisible = true;
    }

    if (this.laser.material.visible !== laserVisible) {
      this.laser.material.visible = laserVisible;
    }
  },

  remove() {
    this.el.sceneEl.removeObject3D(`pen-laser-${this.laser.uuid}`);
    this.el.sceneEl.removeObject3D(`pen-laser-tip-${this.laser.uuid}`);
  }
});