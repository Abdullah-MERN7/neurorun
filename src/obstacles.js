import * as THREE from 'three';
import { CONFIG } from './config.js';
import { assetLoader } from './assetLoader.js';

export const ObstacleType = {
  TRAIN: 'TRAIN',
  BARRIER: 'BARRIER',
  CONTAINER: 'CONTAINER'
};

/**
 * Base Obstacle wrapper with pre-built geometry and zero-allocation activation.
 */
class BaseObstacle {
  constructor(scene, type) {
    this.scene = scene;
    this.type = type;
    this.mesh = new THREE.Group();
    this.box = new THREE.Box3();
    this.isActive = false;
    this.hasCollided = false;
    this.laneIndex = 1;
    this.extraSpeed = 0;
    this.dims = { width: 2.0, height: 1.0, depth: 1.0 };

    this.buildModel();
    this.scene.add(this.mesh);
    this.mesh.visible = false;
  }

  buildModel() {
    // Overridden by subclasses
  }

  activate(laneIndex, zPos) {
    this.laneIndex = laneIndex;
    this.isActive = true;
    this.hasCollided = false;
    this.mesh.visible = true;

    const laneX = CONFIG.LANES[laneIndex];
    this.mesh.position.set(laneX, 0, zPos);
    this.updateBox();
  }

  update(worldSpeed, delta) {
    if (!this.isActive) return;

    this.mesh.position.z += (worldSpeed + this.extraSpeed) * delta;
    this.updateBox();

    if (this.mesh.position.z > 20.0) {
      this.deactivate();
    }
  }

  updateBox() {
    const pos = this.mesh.position;
    const halfW = this.dims.width * 0.5;
    const halfD = this.dims.depth * 0.5;

    this.box.min.set(pos.x - halfW, pos.y, pos.z - halfD);
    this.box.max.set(pos.x + halfW, pos.y + this.dims.height, pos.z + halfD);
  }

  deactivate() {
    this.isActive = false;
    this.mesh.visible = false;
  }
}

/**
 * Approaching Train Obstacle with Headlights
 */
class TrainObstacle extends BaseObstacle {
  constructor(scene) {
    super(scene, ObstacleType.TRAIN);
    this.extraSpeed = CONFIG.TRAIN_SPEED_OFFSET;
    this.dims = { width: 2.4, height: 3.8, depth: 14.0 };
  }

  buildModel() {
    // 1. Locomotive
    const locomotive = assetLoader.getModelClone('train_diesel');
    locomotive.scale.set(2.1, 2.4, 2.4);
    locomotive.position.set(0, 0.15, 0);
    this.mesh.add(locomotive);

    // 2. Trailing Freight Carriage
    const carriage = assetLoader.getModelClone('train_carriage');
    carriage.scale.set(2.5, 2.6, 2.4);
    carriage.position.set(0, 0.15, -6.8);
    this.mesh.add(carriage);

    // 3. Glowing Headlights (Emissive lenses, zero expensive shadow-casting dynamic lights)
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff6b0 });
    const hlGeo = new THREE.SphereGeometry(0.25, 8, 8);

    const hlLeft = new THREE.Mesh(hlGeo, hlMat);
    hlLeft.position.set(-0.85, 2.2, 2.9);
    this.mesh.add(hlLeft);

    const hlRight = new THREE.Mesh(hlGeo, hlMat);
    hlRight.position.set(0.85, 2.2, 2.9);
    this.mesh.add(hlRight);
  }
}

/**
 * Waist-High Road Barrier (Jumpable) with High-Visibility Hazard Markers
 */
class BarrierObstacle extends BaseObstacle {
  constructor(scene) {
    super(scene, ObstacleType.BARRIER);
    this.dims = { width: 2.0, height: 1.05, depth: 0.7 };
  }

  buildModel() {
    const barrierModel = assetLoader.getModelClone('barrier');
    barrierModel.scale.set(8.5, 8.5, 8.5);
    barrierModel.rotation.y = Math.PI / 2;
    barrierModel.position.set(0, 0, 0);
    this.mesh.add(barrierModel);

    // Hazard Clarity: Red/White safety reflectors on barrier top
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const stripeGeo = new THREE.BoxGeometry(0.2, 0.1, 0.1);

    const refL = new THREE.Mesh(stripeGeo, stripeMat);
    refL.position.set(-0.8, 1.05, 0);
    this.mesh.add(refL);

    const refR = new THREE.Mesh(stripeGeo, stripeMat);
    refR.position.set(0.8, 1.05, 0);
    this.mesh.add(refR);
  }
}

/**
 * Shipping Container Obstacle (Lane Blocked) with Amber Warning Beacons
 */
class ContainerObstacle extends BaseObstacle {
  constructor(scene) {
    super(scene, ObstacleType.CONTAINER);
    this.dims = { width: 2.5, height: 2.5, depth: 6.0 };
  }

  buildModel() {
    const containerModel = assetLoader.getModelClone('container');
    containerModel.scale.set(7.2, 7.2, 7.2);
    containerModel.position.set(0, 0, 0);
    this.mesh.add(containerModel);

    // Hazard Clarity: Luminous amber beacons on front corners
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const beaconGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);

    const bLeft = new THREE.Mesh(beaconGeo, beaconMat);
    bLeft.position.set(-1.25, 2.55, 2.9);
    this.mesh.add(bLeft);

    const bRight = new THREE.Mesh(beaconGeo, beaconMat);
    bRight.position.set(1.25, 2.55, 2.9);
    this.mesh.add(bRight);
  }
}

export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;

    // Zero-allocation pre-instantiated pools
    this.trainPool = [];
    this.barrierPool = [];
    this.containerPool = [];

    this.activeObstacles = [];
    this.spawnTimer = 0;

    this.initPools();
  }

  initPools() {
    // 5 of each is ample for any active runner distance
    for (let i = 0; i < 5; i++) {
      this.trainPool.push(new TrainObstacle(this.scene));
      this.barrierPool.push(new BarrierObstacle(this.scene));
      this.containerPool.push(new ContainerObstacle(this.scene));
    }
  }

  getFreeFromPool(pool) {
    for (const obs of pool) {
      if (!obs.isActive) return obs;
    }
    return null;
  }

  update(worldSpeed, delta, allowSpawning = true) {
    for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
      const obs = this.activeObstacles[i];
      obs.update(worldSpeed, delta);
      if (!obs.isActive) {
        this.activeObstacles.splice(i, 1);
      }
    }

    if (!allowSpawning) return;

    this.spawnTimer += delta;
    const spawnInterval = Math.max(1.6, 2.8 - (worldSpeed - CONFIG.INITIAL_SPEED) * 0.05);

    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      this.spawnPattern();
    }
  }

  spawnPattern() {
    const patternType = Math.floor(Math.random() * 4);
    const spawnZ = CONFIG.OBSTACLE_SPAWN_Z;

    if (patternType === 0) {
      // 1 Approaching Train
      const lane = Math.floor(Math.random() * 3);
      const train = this.getFreeFromPool(this.trainPool);
      if (train) {
        train.activate(lane, spawnZ);
        this.activeObstacles.push(train);
      }
    } else if (patternType === 1) {
      // 1 Container + 1 Jumpable Barrier
      const freeLane = Math.floor(Math.random() * 3);
      const lanes = [0, 1, 2].filter(l => l !== freeLane);

      const barrier = this.getFreeFromPool(this.barrierPool);
      if (barrier) {
        barrier.activate(lanes[0], spawnZ);
        this.activeObstacles.push(barrier);
      }

      const container = this.getFreeFromPool(this.containerPool);
      if (container) {
        container.activate(lanes[1], spawnZ);
        this.activeObstacles.push(container);
      }
    } else if (patternType === 2) {
      // 2 Jumpable barriers side-by-side
      const b1Lane = Math.floor(Math.random() * 3);
      const b2Lane = (b1Lane + 1) % 3;

      const b1 = this.getFreeFromPool(this.barrierPool);
      if (b1) {
        b1.activate(b1Lane, spawnZ);
        this.activeObstacles.push(b1);
      }

      const b2 = this.getFreeFromPool(this.barrierPool);
      if (b2) {
        b2.activate(b2Lane, spawnZ);
        this.activeObstacles.push(b2);
      }
    } else {
      // Train in one lane and jumpable barrier in another
      const trainLane = Math.floor(Math.random() * 3);
      const barrierLane = (trainLane + 1) % 3;

      const train = this.getFreeFromPool(this.trainPool);
      if (train) {
        train.activate(trainLane, spawnZ);
        this.activeObstacles.push(train);
      }

      const barrier = this.getFreeFromPool(this.barrierPool);
      if (barrier) {
        barrier.activate(barrierLane, spawnZ);
        this.activeObstacles.push(barrier);
      }
    }
  }

  checkCollision(playerBox) {
    for (const obs of this.activeObstacles) {
      if (!obs.hasCollided && obs.box.intersectsBox(playerBox)) {
        obs.hasCollided = true;
        return {
          hit: true,
          obstacleType: obs.type,
          obstacle: obs
        };
      }
    }
    return { hit: false };
  }

  reset() {
    for (const obs of this.activeObstacles) {
      obs.deactivate();
    }
    this.activeObstacles = [];
    this.spawnTimer = 0;
  }
}
