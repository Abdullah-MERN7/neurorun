import * as THREE from 'three';
import { CONFIG } from './config.js';
import { assetLoader } from './assetLoader.js';
import { ZoneType } from './world.js';

export const ObstacleType = {
  TRAIN: 'TRAIN',
  BARRIER: 'BARRIER',
  CONTAINER: 'CONTAINER',
  OVERHEAD: 'OVERHEAD'
};

// Cached procedural diagonal hazard stripes texture
let hazardStripeTexture = null;
function getHazardStripeTexture() {
  if (hazardStripeTexture) return hazardStripeTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  for (let x = -32; x < 160; x += 24) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x, 32);
    ctx.lineTo(x - 16, 32);
    ctx.closePath();
  }
  ctx.fill();
  hazardStripeTexture = new THREE.CanvasTexture(canvas);
  hazardStripeTexture.wrapS = THREE.RepeatWrapping;
  hazardStripeTexture.wrapT = THREE.RepeatWrapping;
  hazardStripeTexture.repeat.set(3, 1);
  hazardStripeTexture.generateMipmaps = false;
  hazardStripeTexture.minFilter = THREE.LinearFilter;
  return hazardStripeTexture;
}

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

    // 3. Glowing Headlights (Emissive lenses)
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

    // Red safety reflectors on barrier top
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

/**
 * Low Overhead Clearance Barrier (Slide Underneath)
 * High-visibility hazard stripes & warning lights.
 * Clearance below beam: 0.95m.
 * Running Remy (height 1.75m) collides.
 * Jumping Remy (height > 2.0m) collides.
 * Sliding Remy (height 0.70m) ducks cleanly underneath!
 */
class OverheadObstacle extends BaseObstacle {
  constructor(scene) {
    super(scene, ObstacleType.OVERHEAD);
    this.dims = { width: 2.4, height: 1.55, depth: 0.8 };
  }

  buildModel() {
    // 1. Dual side vertical clearance posts
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.5 });

    const postL = new THREE.Mesh(postGeo, postMat);
    postL.position.set(-1.15, 1.1, 0);
    this.mesh.add(postL);

    const postR = new THREE.Mesh(postGeo, postMat);
    postR.position.set(1.15, 1.1, 0);
    this.mesh.add(postR);

    // 2. Heavy overhead clearance beam with diagonal warning stripes
    const beamGeo = new THREE.BoxGeometry(2.4, 0.45, 0.35);
    const beamMat = new THREE.MeshStandardMaterial({
      map: getHazardStripeTexture(),
      roughness: 0.6,
      metalness: 0.3
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 1.45, 0);
    this.mesh.add(beam);

    // 3. Dual amber flashing warning beacons on top corners
    const beaconGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    const beaconL = new THREE.Mesh(beaconGeo, beaconMat);
    beaconL.position.set(-1.05, 1.75, 0);
    this.mesh.add(beaconL);

    const beaconR = new THREE.Mesh(beaconGeo, beaconMat);
    beaconR.position.set(1.05, 1.75, 0);
    this.mesh.add(beaconR);
  }

  updateBox() {
    const pos = this.mesh.position;
    const halfW = this.dims.width * 0.5;
    const halfD = this.dims.depth * 0.5;

    // Overhead collision zone starts at y = 0.85m up to 2.40m!
    // Player sliding height is 0.70m, so Remy ducks cleanly underneath!
    // Player running height is 1.75m, so Remy collides!
    this.box.min.set(pos.x - halfW, pos.y + 0.85, pos.z - halfD);
    this.box.max.set(pos.x + halfW, pos.y + 2.40, pos.z + halfD);
  }
}

export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;

    // Zero-allocation pre-instantiated pools
    this.trainPool = [];
    this.barrierPool = [];
    this.containerPool = [];
    this.overheadPool = [];

    this.activeObstacles = [];
    this.spawnTimer = 0;

    this.initPools();
  }

  initPools() {
    for (let i = 0; i < 5; i++) {
      this.trainPool.push(new TrainObstacle(this.scene));
      this.barrierPool.push(new BarrierObstacle(this.scene));
      this.containerPool.push(new ContainerObstacle(this.scene));
      this.overheadPool.push(new OverheadObstacle(this.scene));
    }
  }

  getFreeFromPool(pool) {
    for (const obs of pool) {
      if (!obs.isActive) return obs;
    }
    return null;
  }

  update(worldSpeed, delta, allowSpawning = true, currentZone = ZoneType.CITY_ROAD) {
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
      this.spawnPattern(currentZone);
    }
  }

  spawnPattern(currentZone) {
    const isRailZone = (
      currentZone === ZoneType.RAILWAY ||
      currentZone === ZoneType.TRANSITION_TO_RAIL ||
      currentZone === ZoneType.TRANSITION_FROM_RAIL
    );
    const spawnZ = CONFIG.OBSTACLE_SPAWN_Z;

    if (isRailZone) {
      // RAILWAY GAMEPLAY: Trains, track maintenance barriers, low clearance gantries
      const patternType = Math.floor(Math.random() * 5);

      if (patternType === 0) {
        // Approaching train on an outer track (lane 0 or lane 2)
        const lane = Math.random() < 0.5 ? 0 : 2;
        const train = this.getFreeFromPool(this.trainPool);
        if (train) {
          train.activate(lane, spawnZ);
          this.activeObstacles.push(train);
        }
      } else if (patternType === 1) {
        // Train approaching in center lane (lane 1)
        const train = this.getFreeFromPool(this.trainPool);
        if (train) {
          train.activate(1, spawnZ);
          this.activeObstacles.push(train);
        }
      } else if (patternType === 2) {
        // Track maintenance jumpable barrier on center track + train on outer track
        const trainLane = Math.random() < 0.5 ? 0 : 2;
        const train = this.getFreeFromPool(this.trainPool);
        if (train) {
          train.activate(trainLane, spawnZ);
          this.activeObstacles.push(train);
        }
        const barrier = this.getFreeFromPool(this.barrierPool);
        if (barrier) {
          barrier.activate(1, spawnZ);
          this.activeObstacles.push(barrier);
        }
      } else if (patternType === 3) {
        // Low clearance overhead beam across 1 lane (requires SLIDE!)
        const lane = Math.floor(Math.random() * 3);
        const overhead = this.getFreeFromPool(this.overheadPool);
        if (overhead) {
          overhead.activate(lane, spawnZ);
          this.activeObstacles.push(overhead);
        }
      } else {
        // 2 Jumpable track maintenance barriers across two lanes
        const freeLane = Math.floor(Math.random() * 3);
        const lanes = [0, 1, 2].filter(l => l !== freeLane);
        const b1 = this.getFreeFromPool(this.barrierPool);
        if (b1) {
          b1.activate(lanes[0], spawnZ);
          this.activeObstacles.push(b1);
        }
        const b2 = this.getFreeFromPool(this.barrierPool);
        if (b2) {
          b2.activate(lanes[1], spawnZ);
          this.activeObstacles.push(b2);
        }
      }
    } else {
      // ROAD GAMEPLAY: Jumpable barriers, Containers, and Overhead Slide Obstacles
      const patternType = Math.floor(Math.random() * 4);

      if (patternType === 0) {
        // 1 Jumpable road barrier in one lane
        const lane = Math.floor(Math.random() * 3);
        const barrier = this.getFreeFromPool(this.barrierPool);
        if (barrier) {
          barrier.activate(lane, spawnZ);
          this.activeObstacles.push(barrier);
        }
      } else if (patternType === 1) {
        // 1 Overhead clearance bar requiring SLIDE underneath!
        const lane = Math.floor(Math.random() * 3);
        const overhead = this.getFreeFromPool(this.overheadPool);
        if (overhead) {
          overhead.activate(lane, spawnZ);
          this.activeObstacles.push(overhead);
        }
      } else if (patternType === 2) {
        // 1 Container in one lane + 1 Barrier in another lane
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
      } else {
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

/**
 * Pre-allocated Zero-Garbage Collectible Coin Manager
 */
export class CoinManager {
  constructor(scene) {
    this.scene = scene;
    this.poolSize = 25;
    this.coins = [];
    this.activeCoins = [];
    this.spawnTimer = 0;

    const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 12);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0xffaa00,
      emissiveIntensity: 0.25
    });

    for (let i = 0; i < this.poolSize; i++) {
      const mesh = new THREE.Mesh(coinGeo, coinMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.coins.push({
        mesh,
        isActive: false,
        box: new THREE.Box3()
      });
    }
  }

  update(worldSpeed, delta, allowSpawning = true, playerPos = null) {
    const rotDelta = delta * 3.5;
    const maxZ = playerPos ? (playerPos.z + 0.4) : 1.0;

    for (let i = this.activeCoins.length - 1; i >= 0; i--) {
      const c = this.activeCoins[i];
      c.mesh.position.z += worldSpeed * delta;
      c.mesh.rotation.y += rotDelta;

      const pos = c.mesh.position;
      c.box.min.set(pos.x - 0.35, pos.y - 0.35, pos.z - 0.35);
      c.box.max.set(pos.x + 0.35, pos.y + 0.35, pos.z + 0.35);

      // Clean up if passed player: never allow coin mesh to remain behind Remy
      if (c.mesh.position.z > maxZ) {
        c.isActive = false;
        c.mesh.visible = false;
        this.activeCoins.splice(i, 1);
      }
    }

    if (!allowSpawning) return;

    this.spawnTimer += delta;
    if (this.spawnTimer >= 2.2) {
      this.spawnTimer = 0;
      this.spawnTrail();
    }
  }

  spawnTrail() {
    const laneIdx = Math.floor(Math.random() * 3);
    const laneX = CONFIG.LANES[laneIdx];
    const baseZ = CONFIG.OBSTACLE_SPAWN_Z + 25;
    const count = 4;

    for (let i = 0; i < count; i++) {
      const freeCoin = this.coins.find(c => !c.isActive);
      if (!freeCoin) break;

      freeCoin.isActive = true;
      freeCoin.mesh.visible = true;
      freeCoin.mesh.position.set(laneX, 0.8, baseZ - i * 3.5);
      this.activeCoins.push(freeCoin);
    }
  }

  /**
   * Check collision with player.
   * Both normal collision and magnet attraction enforce the strict ~0.9m cutoff.
   */
  checkCollision(playerBox, playerPos = null) {
    let collectedCount = 0;
    const pZ = playerPos ? playerPos.z : 0;
    const pX = playerPos ? playerPos.x : 0;
    const pY = playerPos ? (playerPos.y + 0.8) : 0.8;

    for (let i = this.activeCoins.length - 1; i >= 0; i--) {
      const c = this.activeCoins[i];
      if (!c.isActive) continue;

      let shouldCollect = false;

      // Standard box intersection
      if (c.box.intersectsBox(playerBox)) {
        shouldCollect = true;
      } else if (playerPos) {
        // Strict collection distance threshold ~0.9m
        const dx = pX - c.mesh.position.x;
        const dy = pY - c.mesh.position.y;
        const dz = pZ - c.mesh.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        // Immediately hide and collect at ~0.9m or if crossing player's front plane
        if (distSq <= 0.81 || (Math.abs(dx) < 0.9 && c.mesh.position.z >= pZ - 0.25)) {
          shouldCollect = true;
        }
      }

      if (shouldCollect) {
        c.isActive = false;
        c.mesh.visible = false;
        this.activeCoins.splice(i, 1);
        collectedCount++;
      }
    }
    return collectedCount;
  }

  /**
   * Attract coins toward player during NEURO_MAGNET.
   * Immediately hides and collects coins at ~0.9m radius.
   * Never moves coins inside or behind player body.
   */
  attractToPlayer(playerPos, radius = 14.0, delta = 0.016) {
    const targetY = playerPos.y + 0.8;
    let collectedCount = 0;

    for (let i = this.activeCoins.length - 1; i >= 0; i--) {
      const c = this.activeCoins[i];
      if (!c.isActive) continue;

      const dx = playerPos.x - c.mesh.position.x;
      const dy = targetY - c.mesh.position.y;
      const dz = playerPos.z - c.mesh.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      // When coin enters ~0.9m radius OR reaches player's front plane (z >= playerPos.z - 0.25):
      // IMMEDIATELY hide and return to pool without moving inside or behind player body!
      if (distSq <= 0.81 || c.mesh.position.z >= playerPos.z - 0.25) {
        c.isActive = false;
        c.mesh.visible = false;
        this.activeCoins.splice(i, 1);
        collectedCount++;
        continue;
      }

      if (distSq < radius * radius) {
        // Smoothly pull coin towards player without overshooting
        const pullSpeed = 16.0 * delta;
        c.mesh.position.x += dx * pullSpeed;
        c.mesh.position.y += dy * pullSpeed;
        c.mesh.position.z += dz * pullSpeed;

        c.box.min.set(c.mesh.position.x - 0.35, c.mesh.position.y - 0.35, c.mesh.position.z - 0.35);
        c.box.max.set(c.mesh.position.x + 0.35, c.mesh.position.y + 0.35, c.mesh.position.z + 0.35);
      }
    }
    return collectedCount;
  }

  reset() {
    for (const c of this.coins) {
      c.isActive = false;
      c.mesh.visible = false;
    }
    this.activeCoins = [];
    this.spawnTimer = 0;
  }
}

