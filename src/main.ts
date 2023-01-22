import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GUI, Controller } from "lil-gui";

class Spaceship {
  position: THREE.Vector3;
  velocity: THREE.Vector3;

  constructor(position: THREE.Vector3, velocity: THREE.Vector3) {
    this.position = position;
    this.velocity = velocity;
  }

  update(dt: number) {
    this.position.add(this.velocity.clone().multiplyScalar(dt));
  }
}

class Pursuer extends Spaceship {
  acceleration = new THREE.Vector3(0, 0, 0);
  direction = new THREE.Vector3(0, 0, 0);
  maxSpeed: number;
  maxSteerForce: number;
  visionDistance: number;
  visionAngle: number;

  constructor(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    maxSpeed: number,
    maxSteerForce: number,
    visionDistance: number,
    visionAngle: number
  ) {
    super(position, velocity);
    this.maxSpeed = maxSpeed;
    this.maxSteerForce = maxSteerForce;
    this.visionDistance = visionDistance;
    this.visionAngle = visionAngle * (Math.PI / 180);
  }

  update(dt: number) {
    this.velocity.add(this.acceleration.multiplyScalar(dt));
    this.velocity.clampLength(0, this.maxSpeed);
    this.position.add(this.velocity.clone().multiplyScalar(dt));
    this.acceleration.setScalar(0);
    this.direction.copy(this.velocity).normalize();
  }

  pursueTarget(target: Spaceship) {
    const offsetToTarget = target.position.clone().sub(this.position);

    const force = offsetToTarget.clone().normalize();
    force.multiplyScalar(this.maxSpeed);
    force.sub(this.velocity);
    force.clampLength(0, this.maxSteerForce);

    this.acceleration.add(force);
  }

  didCatchTarget(target: Spaceship): boolean {
    const dx = this.position.x - target.position.x;
    const dy = this.position.y - target.position.y;
    const dz = this.position.z - target.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance <= this.visionDistance) {
      const directionLengthSq =
        this.direction.x * this.direction.x +
        this.direction.y * this.direction.y +
        this.direction.z * this.direction.z;
      const targetLengthSq =
        target.position.x * target.position.x +
        target.position.y * target.position.y +
        target.position.z * target.position.z;
      let denominator = Math.sqrt(directionLengthSq * targetLengthSq);
      if (denominator == 0) {
        denominator = Math.PI / 2;
      }

      const dot =
        this.direction.x * target.position.x +
        this.direction.y * target.position.y +
        this.direction.z * target.position.z;
      let theta = dot / denominator;
      if (theta < -1) {
        theta = -1;
      } else if (theta > 1) {
        theta = 1;
      }
      const angle = Math.acos(theta);
      if (angle <= this.visionAngle / 2) {
        return true;
      }
    }

    // if (this.position.distanceTo(target.position) <= this.visionDistance) {
    //   if (this.direction.angleTo(target.position) <= this.visionAngle / 2) {
    //     return true;
    //   }
    // }

    return false;
  }
}

class Settings {
  targetVelocity = new THREE.Vector3(10, 0, 0);
  pursuerPosition = new THREE.Vector3(-10, -5, 5);
  pursuerVelocity = new THREE.Vector3(-10, 8, 4);
  maxSpeed = 20;
  maxSteerForce = 5;
  visionDistance = 5;
  visionAngle = 45;
}

class Simulation {
  target: Spaceship;
  pursuer: Pursuer;
  time = 0;
  finished = false;

  constructor(settings: Settings) {
    this.target = new Spaceship(
      new THREE.Vector3(0, 0, 0),
      settings.targetVelocity.clone()
    );
    this.pursuer = new Pursuer(
      settings.pursuerPosition.clone(),
      settings.pursuerVelocity.clone(),
      settings.maxSpeed,
      settings.maxSteerForce,
      settings.visionDistance,
      settings.visionAngle
    );
  }

  update(dt: number) {
    if (this.finished) {
      return;
    }

    this.time += dt;
    this.pursuer.pursueTarget(this.target);
    this.target.update(dt);
    this.pursuer.update(dt);

    this.finished = this.pursuer.didCatchTarget(this.target);
  }
}

let settings: Settings;
let sim: Simulation;

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let controls: OrbitControls;
let clock: THREE.Clock;
let gui: GUI;
let timeElement = document.getElementById("time");
let pauseButton: Controller;

let targetMesh: THREE.Mesh;
let pursuerMesh: THREE.Mesh;
let visionCone: THREE.Mesh;
let visionConeAxis: THREE.Vector3;

init();
animate();

function init() {
  settings = new Settings();
  sim = new Simulation(settings);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x353839);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 100;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x606060, 1));

  const spaceshipGeometry = new THREE.SphereGeometry(1);
  targetMesh = new THREE.Mesh(
    spaceshipGeometry,
    new THREE.MeshLambertMaterial({ color: 0x228b22 })
  );
  pursuerMesh = new THREE.Mesh(
    spaceshipGeometry,
    new THREE.MeshLambertMaterial({ color: 0xdc143c })
  );
  scene.add(targetMesh);
  scene.add(pursuerMesh);

  visionCone = new THREE.Mesh(
    generateConeGeometry(settings.visionDistance, settings.visionAngle),
    new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
    })
  );
  visionConeAxis = new THREE.Vector3(0, 1, 0);
  scene.add(visionCone);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  clock = new THREE.Clock();

  gui = new GUI();
  const targetVelocityFolder = gui.addFolder("Target Velocity");
  targetVelocityFolder.add(settings.targetVelocity, "x", -100, 100, 1);
  targetVelocityFolder.add(settings.targetVelocity, "y", -100, 100, 1);
  targetVelocityFolder.add(settings.targetVelocity, "z", -100, 100, 1);
  const pursuerPositionFolder = gui.addFolder("Pursuer Position");
  pursuerPositionFolder.add(settings.pursuerPosition, "x", -100, 100, 1);
  pursuerPositionFolder.add(settings.pursuerPosition, "y", -100, 100, 1);
  pursuerPositionFolder.add(settings.pursuerPosition, "z", -100, 100, 1);
  const puruserVelocityFolder = gui.addFolder("Pursuer Velocity");
  puruserVelocityFolder.add(settings.pursuerVelocity, "x", -100, 100, 1);
  puruserVelocityFolder.add(settings.pursuerVelocity, "y", -100, 100, 1);
  puruserVelocityFolder.add(settings.pursuerVelocity, "z", -100, 100, 1);
  gui.add(settings, "maxSpeed", 1, 100, 1);
  gui.add(settings, "maxSteerForce", 1, 100, 1);
  gui.add(settings, "visionDistance", 1, 100, 1);
  gui.add(settings, "visionAngle", 1, 90, 1);

  const obj = {
    Pause: () => {
      sim.finished = !sim.finished;
      if (sim.finished) {
        pauseButton.name("Unpause");
      } else {
        pauseButton.name("Pause");
      }
    },
    Restart: () => {
      sim = new Simulation(settings);
      visionCone.geometry.dispose();
      visionCone.geometry = generateConeGeometry(
        settings.visionDistance,
        settings.visionAngle
      );
    },
  };
  pauseButton = gui.add(obj, "Pause");
  gui.add(obj, "Restart");

  window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
}

function generateConeGeometry(height: number, angle: number) {
  const radius = Math.tan(angle * (Math.PI / 180)) * height;
  const geometry = new THREE.ConeGeometry(radius, height);
  geometry.translate(0, -height / 2, 0);
  geometry.rotateX(Math.PI);
  return geometry;
}

function animate() {
  requestAnimationFrame(animate);

  sim.update(clock.getDelta());

  controls.update();
  targetMesh.position.copy(sim.target.position);
  pursuerMesh.position.copy(sim.pursuer.position);

  const direction = sim.pursuer.velocity.clone().normalize();
  const radians = Math.acos(direction.y);
  visionConeAxis.set(direction.z, 0, -direction.x);
  visionCone.setRotationFromAxisAngle(visionConeAxis, radians);
  visionCone.position.copy(sim.pursuer.position);

  if (timeElement) {
    timeElement.innerText = sim.time.toPrecision(3).toString();
  }

  renderer.render(scene, camera);
}
