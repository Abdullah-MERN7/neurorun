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
    this.updateBoundingBox();
  }

  playAnimation(name, fadeDuration = 0.15) {
    if (this.currentActionName === name || !this.actions[name]) return;

    const nextAction = this.actions[name];
    const prevAction = this.actions[this.currentActionName];

    nextAction.reset();
    nextAction.fadeIn(fadeDuration);
    nextAction.play();

    if (prevAction) {
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
    this.playAnimation('run', 0.05);
    this.updateBoundingBox();
  }
}
