import * as THREE from 'three';
import { CONFIG } from './config.js';
import { assetLoader } from './assetLoader.js';
import { Player, PlayerState } from './player.js';
import { World } from './world.js';
import { ObstacleManager } from './obstacles.js';
import { GateManager } from './gate.js';
import { InputManager } from './input.js';
import { uiManager } from './ui.js';
import { audioManager } from './audio.js';

export const GameState = {
  LOADING: 'LOADING',
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  QUESTION: 'QUESTION',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER'
};

export class Game {
  constructor() {
    this.state = GameState.LOADING;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    this.player = null;
    this.world = null;
    this.obstacleManager = null;
    this.gateManager = null;
    this.inputManager = null;

    // Runtime gameplay state
    this.speed = CONFIG.INITIAL_SPEED;
    this.score = 0;
    this.distance = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.correctAnswers = 0;
    this.totalQuestions = 0;

    this.activeQuestion = null;
  }

  async init() {
    this.initScene();
    uiManager.init();
    this.initInput();

    try {
      await assetLoader.loadAll((progress, text) => {
        uiManager.updateLoading(progress, text);
      });

      this.player = new Player(this.scene);
      this.player.init();

      this.player.onJump = () => audioManager.playJump();
      this.player.onLand = () => audioManager.playLand();
      this.player.onSlide = () => audioManager.playSlide();

      this.world = new World(this.scene);
      this.world.init();

      this.obstacleManager = new ObstacleManager(this.scene);
      this.gateManager = new GateManager(this.scene);
    } catch (err) {
      console.error('[Game] Initialization Error:', err);
    } finally {
      uiManager.hideLoading();
      this.state = GameState.MENU;
      uiManager.showStartScreen(
        () => this.startRun(),
        () => audioManager.toggleMute()
      );
    }

    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();

    // Stylized twilight sky
    this.scene.background = new THREE.Color(0x131a2e);
    this.scene.fog = new THREE.FogExp2(0x17213b, 0.0075);

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.CAMERA.FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      400
    );
    this.camera.position.set(0, CONFIG.CAMERA.OFFSET_Y, CONFIG.CAMERA.OFFSET_Z);
    this.camera.lookAt(0, CONFIG.CAMERA.LOOK_Y, CONFIG.CAMERA.LOOK_Z);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    document.body.appendChild(this.renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xcbe5ff, 0x1a2436, 2.2);
    this.scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xffedd4, 3.2);
    sun.position.set(22, 38, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -15;
    this.scene.add(sun);
  }

  initInput() {
    this.inputManager = new InputManager();

    this.inputManager.handlers.onLeft = () => {
      audioManager.unlock();
      if (this.state === GameState.PLAYING) {
        this.player.moveLeft();
      } else if (this.state === GameState.QUESTION) {
        this.player.moveLeft();
        uiManager.highlightQuestionChoice(this.player.laneIndex);
      }
    };

    this.inputManager.handlers.onRight = () => {
      audioManager.unlock();
      if (this.state === GameState.PLAYING) {
        this.player.moveRight();
      } else if (this.state === GameState.QUESTION) {
        this.player.moveRight();
        uiManager.highlightQuestionChoice(this.player.laneIndex);
      }
    };

    this.inputManager.handlers.onDigit = (laneIdx) => {
      if (this.state === GameState.QUESTION) {
        this.player.setLane(laneIdx);
        uiManager.highlightQuestionChoice(laneIdx);
      }
    };

    this.inputManager.handlers.onConfirm = () => {
      if (this.state === GameState.QUESTION) {
        this.submitQuestionAnswer(this.player.laneIndex);
        return true;
      }
      return false;
    };

    this.inputManager.handlers.onJump = () => {
      audioManager.unlock();
      if (this.state === GameState.PLAYING) {
        this.player.jump();
      }
    };

    this.inputManager.handlers.onSlide = () => {
      audioManager.unlock();
      if (this.state === GameState.PLAYING) {
        this.player.slide();
      }
    };

    this.inputManager.handlers.onPause = () => {
      if (this.state === GameState.PLAYING) {
        this.pause();
      } else if (this.state === GameState.PAUSED) {
        this.resume();
      }
    };
  }

  startRun() {
    audioManager.unlock();
    this.resetGameplayState();
    this.state = GameState.PLAYING;
    uiManager.showHUD();
    audioManager.play('land', 0.5);
  }

  pause() {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.PAUSED;
    uiManager.showPause(
      () => this.resume(),
      () => this.restart()
    );
  }

  resume() {
    if (this.state !== GameState.PAUSED) return;
    this.state = GameState.PLAYING;
    uiManager.hidePause();
  }

  restart() {
    this.resetGameplayState();
    this.state = GameState.PLAYING;
    uiManager.showHUD();
  }

  resetGameplayState() {
    this.speed = CONFIG.INITIAL_SPEED;
    this.score = 0;
    this.distance = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.correctAnswers = 0;
    this.totalQuestions = 0;
    this.activeQuestion = null;

    if (this.player) this.player.reset();
    if (this.world) this.world.reset();
    if (this.obstacleManager) this.obstacleManager.reset();
    if (this.gateManager) this.gateManager.reset();

    uiManager.hideQuestionModal();
    uiManager.updateHUD(0, 0, 1, this.speed);
  }

  triggerQuestionPause(question) {
    this.state = GameState.QUESTION;
    this.player.state = PlayerState.PAUSED_QUESTION;
    this.activeQuestion = question;

    uiManager.showQuestionModal(
      question,
      this.player.laneIndex,
      (selectedIdx) => {
        this.player.setLane(selectedIdx);
        uiManager.highlightQuestionChoice(selectedIdx);
      },
      (selectedIdx) => {
        const laneToSubmit = selectedIdx !== undefined ? selectedIdx : this.player.laneIndex;
        this.submitQuestionAnswer(laneToSubmit);
      }
    );
  }

  submitQuestionAnswer(chosenLaneIndex) {
    if (this.state !== GameState.QUESTION || !this.activeQuestion) return;

    this.totalQuestions++;
    const isCorrect = chosenLaneIndex === this.activeQuestion.correctIndex;

    if (isCorrect) {
      audioManager.playCorrect();
      uiManager.triggerFlash(true);

      this.correctAnswers++;
      this.score += CONFIG.SCORE.GATE_CORRECT * this.combo;
      this.combo = Math.min(CONFIG.SCORE.MAX_COMBO, this.combo + 1);
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      this.speed = Math.min(CONFIG.MAX_SPEED, this.speed + CONFIG.SPEED_BOOST);
    } else {
      audioManager.playWrong();
      uiManager.triggerFlash(false);

      this.combo = 1;
      this.speed = Math.max(CONFIG.INITIAL_SPEED, this.speed - 3.5);
    }

    uiManager.hideQuestionModal();
    this.activeQuestion = null;

    this.player.state = PlayerState.RUNNING;
    this.state = GameState.PLAYING;
  }

  update(delta) {
    // 1. Cinematic Background during MENU state
    if (this.state === GameState.MENU) {
      // Slowly scroll railway tracks and animate Remy
      this.world.update(5.5, delta, 0);
      if (this.player && this.player.mixer) {
        this.player.mixer.update(delta * 0.85);
      }
      // Subtle cinematic camera motion
      const t = this.clock.getElapsedTime();
      this.camera.position.x = Math.sin(t * 0.5) * 0.35;
      this.camera.position.y = CONFIG.CAMERA.OFFSET_Y + Math.cos(t * 0.6) * 0.08;
      this.camera.lookAt(0, CONFIG.CAMERA.LOOK_Y, CONFIG.CAMERA.LOOK_Z);
      return;
    }

    // 2. Question Pause State (Complete Freeze of world & distance)
    if (this.state === GameState.QUESTION) {
      if (this.player) {
        this.player.update(delta);
        this.updateCamera(delta);
      }
      return;
    }

    // 3. Paused / Game Over state
    if (this.state !== GameState.PLAYING) {
      if (this.player && this.player.mixer) {
        this.player.mixer.update(delta);
      }
      return;
    }

    // 4. Update Player
    this.player.update(delta);

    // 5. Update World tracks & scenery with Zone progression based on distance
    this.world.update(this.speed, delta, this.distance);

    // 6. Update Obstacles
    this.obstacleManager.update(this.speed, delta, true);

    // 7. Update Knowledge Gate (trigger question pause every 175m)
    const gateEvent = this.gateManager.update(this.speed, delta);
    if (gateEvent && gateEvent.type === 'PAUSE_FOR_QUESTION') {
      this.triggerQuestionPause(gateEvent.question);
      return;
    }

    // 8. Audio Footsteps when grounded
    if (this.player.isGrounded && this.player.state === PlayerState.RUNNING) {
      audioManager.playFootstep(delta, this.speed);
    }

    // 9. Check Collisions
    const collision = this.obstacleManager.checkCollision(this.player.box);
    if (collision.hit) {
      this.handleCollision();
      return;
    }

    // 10. Progression & Scoring (only while running)
    this.distance += this.speed * delta;
    this.score += CONFIG.SCORE.DISTANCE_RATE * this.combo * delta;
    this.speed = Math.min(CONFIG.MAX_SPEED, this.speed + CONFIG.ACCELERATION * delta);

    // 11. Update Camera
    this.updateCamera(delta);

    // 12. Update UI HUD
    uiManager.updateHUD(this.score, this.distance, this.combo, this.speed);
  }

  handleCollision() {
    this.state = GameState.GAME_OVER;
    this.player.state = PlayerState.DEAD;

    audioManager.playImpact();
    audioManager.playGameOver();
    uiManager.triggerFlash(false);

    const stats = {
      score: this.score,
      distance: this.distance,
      correctAnswers: this.correctAnswers,
      totalQuestions: this.totalQuestions,
      maxCombo: this.maxCombo
    };

    setTimeout(() => {
      uiManager.showGameOver(stats, () => this.restart());
    }, 600);
  }

  updateCamera(delta) {
    const targetCamX = this.player.position.x * 0.45;
    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      targetCamX,
      CONFIG.CAMERA.LERP_SPEED,
      delta
    );

    const lookTargetX = this.player.position.x * 0.2;
    this.camera.lookAt(lookTargetX, CONFIG.CAMERA.LOOK_Y, CONFIG.CAMERA.LOOK_Z);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    const delta = Math.min(this.clock.getDelta(), 0.05);

    this.update(delta);
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}
