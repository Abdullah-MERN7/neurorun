import * as THREE from 'three';
import { CONFIG } from './config.js';
import { assetLoader } from './assetLoader.js';

export const PlayerState = {
  RUNNING: 'RUNNING',
  JUMPING: 'JUMPING',
  SLIDING: 'SLIDING',
  PAUSED_QUESTION: 'PAUSED_QUESTION',
  HIT: 'HIT',
  DEAD: 'DEAD'
};

export class Player {
  constructor(scene) {
    this.scene = scene;

    this.mesh = null;
    this.mixer = null;
    this.actions = {};
    this.currentActionName = '';

    // Lane positioning
    this.laneIndex = 1; // 0 = Left, 1 = Center, 2 = Right
    this.targetX = CONFIG.LANES[this.laneIndex];
    this.position = new THREE.Vector3(0, 0, 0);

    // Physics
    this.velocityY = 0;
    this.isGrounded = true;
    this.state = PlayerState.RUNNING;
    this.slideTimer = 0;

    // Dynamic Collision Box3
    this.box = new THREE.Box3();

    // Callbacks
    this.onJump = null;
    this.onLand = null;
    this.onSlide = null;
  }

  init() {
    const rawRemy = assetLoader.getCharacter();
    if (!rawRemy) {
      throw new Error('[Player] Remy character model not loaded!');
    }

    this.mesh = rawRemy;
    // Exactly calibrated human scale (~1.75m)
    this.mesh.scale.setScalar(CONFIG.PLAYER_SCALE);
    // Face forward down the tracks (towards negative Z)
    this.mesh.rotation.y = Math.PI;
    this.mesh.position.set(0, 0, 0);

    this.scene.add(this.mesh);

    // Setup AnimationMixer
    this.mixer = new THREE.AnimationMixer(this.mesh);

    const runClip = assetLoader.getAnimation('run');
    const jumpClip = assetLoader.getAnimation('jump');
    const slideClip = assetLoader.getAnimation('slide');

    if (runClip) {
      this.actions.run = this.mixer.clipAction(runClip);
      this.actions.run.setEffectiveWeight(1.0);
    }
    if (jumpClip) {
      this.actions.jump = this.mixer.clipAction(jumpClip);
      this.actions.jump.setLoop(THREE.LoopOnce);
      this.actions.jump.clampWhenFinished = true;
    }
    if (slideClip) {
      this.actions.slide = this.mixer.clipAction(slideClip);
      this.actions.slide.setLoop(THREE.LoopOnce);
      this.actions.slide.clampWhenFinished = true;
    }

    this.playAnimation('run', 0.1);

    this.playAnimation('run', 0.1);

    // ============================================================
    // NEURAL SHIELD: Clean Endless-Runner Energy Ring Aura
    // Thin green/cyan circular aura centered around Remy's body,
    // player remains 100% visible, subtle rotation and pulse.
    // ============================================================
    this.shieldMesh = new THREE.Group();

    // 1. Primary outer energy ring at waist height (y = 0.85m)
    const ring1Geo = new THREE.TorusGeometry(0.68, 0.022, 16, 48);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.85
    });
    this.shieldRing1 = new THREE.Mesh(ring1Geo, ring1Mat);
    this.shieldRing1.rotation.x = Math.PI / 2;
    this.shieldRing1.position.y = 0.85;
    this.shieldMesh.add(this.shieldRing1);

    // 2. Secondary inner concentric energy ring
    const ring2Geo = new THREE.TorusGeometry(0.55, 0.014, 16, 40);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.65
    });
    this.shieldRing2 = new THREE.Mesh(ring2Geo, ring2Mat);
    this.shieldRing2.rotation.x = Math.PI / 2;
    this.shieldRing2.position.y = 0.85;
    this.shieldMesh.add(this.shieldRing2);

    // 3. Soft glowing ground aura ring slightly above the road/ballast
    const groundRingGeo = new THREE.RingGeometry(0.46, 0.72, 32);
    const groundRingMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    });
    this.shieldGroundRing = new THREE.Mesh(groundRingGeo, groundRingMat);
    this.shieldGroundRing.rotation.x = -Math.PI / 2;
    this.shieldGroundRing.position.y = 0.04;
    this.shieldMesh.add(this.shieldGroundRing);

    this.shieldAnimTimer = 0;
    this.shieldMesh.visible = false;
    this.scene.add(this.shieldMesh);

    this.updateBoundingBox();
  }

  setShield(active) {
    if (this.shieldMesh) {
      this.shieldMesh.visible = active;
    }
  }

  playAnimation(name, fadeDuration = 0.15, force = false) {
    if (!force && this.currentActionName === name) return;
    if (!this.actions[name]) return;

    const nextAction = this.actions[name];
    const prevAction = this.actions[this.currentActionName];

    nextAction.reset();
    nextAction.fadeIn(fadeDuration);
    nextAction.play();

    if (prevAction && prevAction !== nextAction) {
      prevAction.fadeOut(fadeDuration);
    }

    this.currentActionName = name;
  }

  moveLeft() {
    if (this.state === PlayerState.DEAD) return;
    if (this.laneIndex > 0) {
      this.laneIndex--;
      this.targetX = CONFIG.LANES[this.laneIndex];
    }
  }

  moveRight() {
    if (this.state === PlayerState.DEAD) return;
    if (this.laneIndex < CONFIG.LANES.length - 1) {
      this.laneIndex++;
      this.targetX = CONFIG.LANES[this.laneIndex];
    }
  }

  setLane(index) {
    if (this.state === PlayerState.DEAD) return;
    if (index >= 0 && index < CONFIG.LANES.length) {
      this.laneIndex = index;
      this.targetX = CONFIG.LANES[this.laneIndex];
    }
  }

  jump() {
    if (this.state === PlayerState.DEAD || this.state === PlayerState.PAUSED_QUESTION) return;
    if (this.isGrounded) {
      this.isGrounded = false;
      this.velocityY = CONFIG.JUMP_VELOCITY;
      this.state = PlayerState.JUMPING;
      this.playAnimation('jump', 0.1);
      if (this.onJump) this.onJump();
    }
  }

  slide() {
    if (this.state === PlayerState.DEAD || this.state === PlayerState.PAUSED_QUESTION) return;
    if (!this.isGrounded) {
      this.velocityY = -20.0;
      return;
    }

    this.state = PlayerState.SLIDING;
    this.slideTimer = CONFIG.SLIDE_DURATION;
    this.playAnimation('slide', 0.1);
    if (this.onSlide) this.onSlide();
  }

  update(delta) {
    if (!this.mesh) return;

    // Horizontal lane interpolation (smooth damp)
    this.position.x = THREE.MathUtils.damp(
      this.position.x,
      this.targetX,
      CONFIG.LANE_LERP_SPEED,
      delta
    );

    // Subtle bank angle while moving horizontally
    const xDiff = this.targetX - this.position.x;
    this.mesh.rotation.z = THREE.MathUtils.damp(
      this.mesh.rotation.z,
      -xDiff * 0.08,
      12.0,
      delta
    );

    // If in Question state, freeze jump/slide physics
    if (this.state === PlayerState.PAUSED_QUESTION) {
      this.mesh.position.set(this.position.x, this.position.y, 0);
      if (this.mixer) this.mixer.update(delta * 0.3); // Subtle idle breathing
      this.updateBoundingBox();
      return;
    }

    // Vertical Jump & Gravity Physics
    if (!this.isGrounded) {
      this.velocityY += CONFIG.GRAVITY * delta;
      this.position.y += this.velocityY * delta;

      if (this.position.y <= 0) {
        this.position.y = 0;
        this.velocityY = 0;
        this.isGrounded = true;

        if (this.state === PlayerState.JUMPING) {
          this.state = PlayerState.RUNNING;
          this.playAnimation('run', 0.15);
          if (this.onLand) this.onLand();
        }
      }
    }

    // Slide timer countdown
    if (this.state === PlayerState.SLIDING) {
      this.slideTimer -= delta;
      if (this.slideTimer <= 0) {
        this.state = PlayerState.RUNNING;
        this.playAnimation('run', 0.15);
      }
    }

    this.mesh.position.set(this.position.x, this.position.y, 0);

    if (this.shieldMesh && this.shieldMesh.visible) {
      this.shieldAnimTimer += delta;
      this.shieldMesh.position.set(this.position.x, this.position.y, 0);

      // Counter-rotating energy rings
      this.shieldRing1.rotation.z += delta * 2.2;
      this.shieldRing2.rotation.z -= delta * 2.8;
      this.shieldGroundRing.rotation.z += delta * 1.2;

      // Subtle pulse scale
      const pulse = 1.0 + Math.sin(this.shieldAnimTimer * 3.6) * 0.04;
      this.shieldMesh.scale.set(pulse, 1.0, pulse);
    }

    if (this.mixer) {
      this.mixer.update(delta);
    }

    this.updateBoundingBox();
  }

  updateBoundingBox() {
    const isSliding = this.state === PlayerState.SLIDING;
    const dims = isSliding
      ? CONFIG.PLAYER_BOUNDS.SLIDING
      : CONFIG.PLAYER_BOUNDS.RUNNING;

    const minX = this.position.x - dims.width * 0.5;
    const maxX = this.position.x + dims.width * 0.5;
    const minY = this.position.y;
    const maxY = this.position.y + dims.height;
    const minZ = -dims.depth * 0.5;
    const maxZ = dims.depth * 0.5;

    this.box.min.set(minX, minY, minZ);
    this.box.max.set(maxX, maxY, maxZ);
  }

  reset() {
    this.laneIndex = 1;
    this.targetX = CONFIG.LANES[1];
    this.position.set(0, 0, 0);
    this.velocityY = 0;
    this.isGrounded = true;
    this.state = PlayerState.RUNNING;
    this.slideTimer = 0;

    if (this.mesh) {
      this.mesh.position.set(0, 0, 0);
      this.mesh.rotation.z = 0;
    }
    if (this.shieldMesh) {
      this.shieldMesh.visible = false;
    }
    this.playAnimation('run', 0.05);
    this.updateBoundingBox();
  }
}
