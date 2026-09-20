import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { CONFIG } from './config.js';
import { assetLoader } from './assetLoader.js';
import { Player, PlayerState } from './player.js';
import { World, ZONE_ATMOSPHERE, ZoneType } from './world.js';
import { ObstacleManager, CoinManager } from './obstacles.js';
import { GateManager } from './gate.js';
import { InputManager } from './input.js';
import { uiManager } from './ui.js';
import { audioManager } from './audio.js';
import { DogChase } from './dog.js';

export const GameState = {
  LOADING: 'LOADING',
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  QUESTION: 'QUESTION',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER'
};

const POWER_UPS = [
  { id: 'NEURO_MAGNET', name: 'NEURO MAGNET', icon: '🧲', duration: 8.0 },
  { id: 'NEURAL_RUSH', name: 'NEURAL RUSH', icon: '⚡', duration: 6.0 },
  { id: 'NEURAL_SHIELD', name: 'NEURAL SHIELD', icon: '🛡️', duration: Infinity },
  { id: 'DOUBLE_SCORE', name: 'DOUBLE SCORE', icon: '✖️2', duration: 8.0 }
];

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
    this.coinManager = null;
    this.gateManager = null;
    this.inputManager = null;
    this.dog = null;

    // Mobile & Device Capability Profile
    this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.pixelRatio = this.isMobile
      ? Math.min(window.devicePixelRatio || 1, 1.5)
      : Math.min(window.devicePixelRatio || 1, 2.0);
    this.contextState = 'ACTIVE';
    this.jsErrors = [];
    this.lastWidth = 0;
    this.lastHeight = 0;

    // Listen for uncaught JS errors for telemetry
    window.addEventListener('error', (e) => {
      if (e && e.message) {
        this.jsErrors.push(`${e.message} at ${e.filename || ''}:${e.lineno || ''}`);
        uiManager.updateDiagnostics(this.getDiagnosticInfo());
      }
    });
    window.addEventListener('unhandledrejection', (e) => {
      if (e && e.reason) {
        const msg = e.reason.message || String(e.reason);
        this.jsErrors.push(`Unhandled Rejection: ${msg}`);
        uiManager.updateDiagnostics(this.getDiagnosticInfo());
      }
    });

    // Runtime gameplay state
    this.speed = CONFIG.INITIAL_SPEED;
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.correctAnswers = 0;
    this.totalQuestions = 0;

    this.activeQuestion = null;

    // Power-up state
    this.activePowerup = null;
    this.hasShield = false;
    this.invulnerableTimer = 0;
    this.targetFov = CONFIG.CAMERA.FOV;

    // Dynamic Biome Atmosphere Interpolation
    this.targetFogColor = new THREE.Color(0x131a2e);
    this.targetSkyColor = new THREE.Color(0x131a2e);
    this.targetHemiColor = new THREE.Color(0xcbe5ff);
    this.hemiLight = null;
  }

  getDiagnosticInfo() {
    return {
      webgl2: WebGL.isWebGL2Available(),
      rendererCreated: !!this.renderer,
      isMobile: this.isMobile,
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      effectiveDPR: this.pixelRatio || 1,
      assetsLoaded: assetLoader.loadedCount || 0,
      totalAssets: assetLoader.totalCount || 0,
      failedAssets: assetLoader.failedAssets || [],
      jsErrors: this.jsErrors,
      drawCalls: this.renderer ? this.renderer.info.render.calls : 0,
      triangles: this.renderer ? this.renderer.info.render.triangles : 0,
      geometries: this.renderer ? this.renderer.info.memory.geometries : 0,
      textures: this.renderer ? this.renderer.info.memory.textures : 0,
      contextState: this.contextState
    };
  }

  async init() {
    uiManager.init();
    this.initInput();

    // REQUIREMENT 4: Mandatory WebGL 2 Check
    if (!WebGL.isWebGL2Available()) {
      uiManager.showWebGLError('WebGL 2 is not supported on this device/browser.');
      uiManager.showDiagnostics(this.getDiagnosticInfo());
      return false;
    }

    this.initScene();

    let assetsLoadedSuccessfully = false;
    try {
      await assetLoader.loadAll((progress, text) => {
        uiManager.updateLoading(progress, text);
        uiManager.updateDiagnostics(this.getDiagnosticInfo());
      });
      assetsLoadedSuccessfully = true;
    } catch (err) {
      console.error('[Game] Required asset loading failure:', err);
      this.jsErrors.push(err.message || String(err));
      uiManager.showDiagnostics(this.getDiagnosticInfo());
    }

    if (!assetsLoadedSuccessfully) {
      uiManager.hideLoading();
      uiManager.showDiagnostics(this.getDiagnosticInfo());
      return false;
    }

    this.player = new Player(this.scene);
    this.player.init();

    this.player.onJump = () => audioManager.playJump();
    this.player.onLand = () => audioManager.playLand();
    this.player.onSlide = () => audioManager.playSlide();

    this.world = new World(this.scene);
    this.world.init();

    this.obstacleManager = new ObstacleManager(this.scene);
    this.coinManager = new CoinManager(this.scene);
    this.gateManager = new GateManager(this.scene);
    this.dog = new DogChase(this.scene);

    uiManager.hideLoading();
    this.state = GameState.MENU;
    uiManager.showStartScreen(
      () => this.startRun(),
      () => audioManager.toggleMute()
    );

    window.addEventListener('resize', this.onWindowResize.bind(this));

    // REQUIREMENT 9: Single Animation Loop using setAnimationLoop
    this.renderer.setAnimationLoop(this.animate.bind(this));
    return true;
  }

  initScene() {
    this.scene = new THREE.Scene();

    // Stylized twilight sky with mathematically calculated fog for 9 segments
    this.scene.background = new THREE.Color(0x131a2e);
    this.scene.fog = new THREE.FogExp2(0x131a2e, 0.0095);

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.CAMERA.FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      400
    );
    this.camera.position.set(0, CONFIG.CAMERA.OFFSET_Y, CONFIG.CAMERA.OFFSET_Z);
    this.camera.lookAt(0, CONFIG.CAMERA.LOOK_Y, CONFIG.CAMERA.LOOK_Z);

    // REQUIREMENT 3: Mobile Renderer Settings & Capped DPR
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isMobile,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      logarithmicDepthBuffer: false,
      stencil: false,
      depth: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(this.pixelRatio);

    // REQUIREMENT 7: Mobile Shadows
    if (this.isMobile) {
      this.renderer.shadowMap.enabled = false;
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
    }

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    document.body.appendChild(this.renderer.domElement);

    // REQUIREMENT 5: Context Loss Event Handlers
    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.warn('[Game] WebGL context lost!');
      this.contextState = 'LOST';
      if (this.state === GameState.PLAYING) {
        this.state = GameState.PAUSED;
      }
      uiManager.showDiagnostics(this.getDiagnosticInfo());
    });

    canvas.addEventListener('webglcontextrestored', () => {
      console.log('[Game] WebGL context restored.');
      this.contextState = 'RESTORED';
      uiManager.showDiagnostics(this.getDiagnosticInfo());
    });

    // REQUIREMENT 8: Lightweight Mobile Lighting Setup
    this.hemiLight = new THREE.HemisphereLight(0xcbe5ff, 0x1a2436, 2.2);
    this.scene.add(this.hemiLight);

    const sun = new THREE.DirectionalLight(0xffedd4, 3.2);
    sun.position.set(22, 38, 16);
    if (!this.isMobile) {
      sun.castShadow = true;
      sun.shadow.mapSize.width = 1024;
      sun.shadow.mapSize.height = 1024;
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 120;
      sun.shadow.camera.left = -20;
      sun.shadow.camera.right = 20;
      sun.shadow.camera.top = 25;
      sun.shadow.camera.bottom = -15;
    }
    this.scene.add(sun);
  }

  initInput() {
    this.inputManager = new InputManager();

    this.inputManager.handlers.onLeft = () => {
      audioManager.unlock();
      if (this.state === GameState.PLAYING) {
        this.player.moveLeft();
      }
    };

    this.inputManager.handlers.onRight = () => {
      audioManager.unlock();
      if (this.state === GameState.PLAYING) {
        this.player.moveRight();
      }
    };

    this.inputManager.handlers.onDigit = (idx) => {
      if (this.state === GameState.QUESTION && this.activeQuestion) {
        // Keyboard 1 / 2 / 3 immediately selects and submits
        uiManager.handleAnswerSelection(idx, this.activeQuestion.correctIndex, (selectedIdx, isCorrect) => {
          this.submitQuestionAnswer(selectedIdx, isCorrect);
        });
      }
    };

    this.inputManager.handlers.onConfirm = () => {
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
    this.coins = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.correctAnswers = 0;
    this.totalQuestions = 0;
    this.activeQuestion = null;

    this.activePowerup = null;
    this.hasShield = false;
    this.invulnerableTimer = 0;
    this.targetFov = CONFIG.CAMERA.FOV;
    this.camera.fov = CONFIG.CAMERA.FOV;
    this.camera.updateProjectionMatrix();

    if (this.player) this.player.reset();
    if (this.world) this.world.reset();
    if (this.obstacleManager) this.obstacleManager.reset();
    if (this.coinManager) this.coinManager.reset();
    if (this.gateManager) this.gateManager.reset();
    if (this.dog) this.dog.reset();

    uiManager.hideQuestionModal();
    uiManager.updatePowerup(null);
    uiManager.updateDogThreat('SAFE', 40.0);
    uiManager.updateHUD(0, 0, 0, 1, this.speed);
  }

  triggerQuestionPause(question) {
    this.state = GameState.QUESTION;
    this.player.state = PlayerState.PAUSED_QUESTION;
    this.activeQuestion = question;

    // Show modal: clicking or typing 1/2/3 immediately submits answer
    uiManager.showQuestionModal(question, (selectedIdx, isCorrect) => {
      this.submitQuestionAnswer(selectedIdx, isCorrect);
    });
  }

  submitQuestionAnswer(selectedIndex, isCorrect) {
    if (!this.activeQuestion) return;

    this.totalQuestions++;
    const isDouble = this.activePowerup && this.activePowerup.id === 'DOUBLE_SCORE';

    if (isCorrect) {
      audioManager.playCorrect();
      uiManager.triggerFlash(true);

      this.correctAnswers++;
      const bonusScore = CONFIG.SCORE.GATE_CORRECT * this.combo * (isDouble ? 2 : 1);
      this.score += bonusScore;

      this.combo = Math.min(CONFIG.SCORE.MAX_COMBO, this.combo + 1);
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      // Correct answer ALWAYS resets dog to 40m safe distance!
      this.dog.onCorrectAnswer();

      // Automatically activate ONE random power-up
      this.activateRandomPowerup();
    } else {
      audioManager.playWrong();
      uiManager.triggerFlash(false);

      this.combo = 1;
      this.speed = Math.max(CONFIG.INITIAL_SPEED, this.speed - 3.0);

      // Wrong answer advances dog
      const dogState = this.dog.onWrongAnswer();
      if (dogState === 'CAUGHT') {
        this.activeQuestion = null;
        this.handleCaughtGameOver();
        return;
      } else {
        audioManager.playDogGrowl();
      }
    }

    this.activeQuestion = null;
    this.state = GameState.PLAYING;
    if (this.player) {
      if (this.player.isGrounded) {
        this.player.state = PlayerState.RUNNING;
        this.player.playAnimation('run', 0.1);
      }
    }
  }

  activateRandomPowerup() {
    const picked = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)];

    if (picked.id === 'NEURAL_SHIELD') {
      this.hasShield = true;
      this.player.setShield(true);
      this.activePowerup = {
        id: 'NEURAL_SHIELD',
        name: 'NEURAL SHIELD',
        icon: '🛡️',
        duration: 1,
        remaining: 1
      };
    } else if (picked.id === 'NEURAL_RUSH') {
      this.speed = Math.min(CONFIG.MAX_SPEED + 6.0, this.speed + 7.0);
      this.targetFov = 66.0;
      this.activePowerup = {
        id: 'NEURAL_RUSH',
        name: 'NEURAL RUSH',
        icon: '⚡',
        duration: 6.0,
        remaining: 6.0
      };
    } else if (picked.id === 'NEURO_MAGNET') {
      this.activePowerup = {
        id: 'NEURO_MAGNET',
        name: 'NEURO MAGNET',
        icon: '🧲',
        duration: 8.0,
        remaining: 8.0
      };
    } else if (picked.id === 'DOUBLE_SCORE') {
      this.activePowerup = {
        id: 'DOUBLE_SCORE',
        name: 'DOUBLE SCORE',
        icon: '✖️2',
        duration: 8.0,
        remaining: 8.0
      };
    }

    audioManager.playPowerUp();
    uiManager.updatePowerup(this.activePowerup);
  }

  update(delta) {
    // 1. Cinematic Background during MENU state
    if (this.state === GameState.MENU) {
      this.world.update(5.5, delta);
      if (this.player && this.player.mixer) {
        this.player.mixer.update(delta * 0.85);
      }
      const t = this.clock.getElapsedTime();
      this.camera.position.x = Math.sin(t * 0.5) * 0.35;
      this.camera.position.y = CONFIG.CAMERA.OFFSET_Y + Math.cos(t * 0.6) * 0.08;
      this.camera.lookAt(0, CONFIG.CAMERA.LOOK_Y, CONFIG.CAMERA.LOOK_Z);
      return;
    }

    // 2. Question Pause State: COMPLETE FREEZE of world, player, dog, distance, timers
    if (this.state === GameState.QUESTION) {
      return;
    }

    // 3. Paused or Game Over state
    if (this.state !== GameState.PLAYING) {
      return;
    }

    // 4. Update Invulnerability Window
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= delta;
    }

    // 5. Update Power-up Timers & Camera FOV
    if (this.activePowerup && this.activePowerup.id !== 'NEURAL_SHIELD') {
      this.activePowerup.remaining -= delta;
      if (this.activePowerup.remaining <= 0) {
        if (this.activePowerup.id === 'NEURAL_RUSH') {
          this.targetFov = CONFIG.CAMERA.FOV;
          this.speed = Math.max(CONFIG.INITIAL_SPEED, this.speed - 5.0);
        }
        this.activePowerup = null;
        uiManager.updatePowerup(null);
      } else {
        uiManager.updatePowerup(this.activePowerup);
      }
    }

    // Dynamic FOV interpolation
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, this.targetFov, 4.0, delta);
    this.camera.updateProjectionMatrix();

    // 6. Update Player
    this.player.update(delta);

    // 7. Update World (deterministic zone progression)
    this.world.update(this.speed, delta);

    // Smooth Dynamic Biome Atmosphere (Fog, Sky & Ambient Light)
    const atmo = ZONE_ATMOSPHERE[this.world.currentZone] || ZONE_ATMOSPHERE[ZoneType.CITY_ROAD];
    this.targetFogColor.setHex(atmo.fog);
    this.targetSkyColor.setHex(atmo.sky);
    this.targetHemiColor.setHex(atmo.hemiSky);

    this.scene.fog.color.lerp(this.targetFogColor, delta * 2.5);
    this.scene.background.lerp(this.targetSkyColor, delta * 2.5);
    if (this.hemiLight) {
      this.hemiLight.color.lerp(this.targetHemiColor, delta * 2.5);
    }

    // 8. Update Obstacles with zone awareness (Trains in Railway, Barriers on Roads)
    this.obstacleManager.update(this.speed, delta, true, this.world.currentZone);

    // 9. Update Collectible Coins
    let magnetCollected = 0;
    if (this.activePowerup && this.activePowerup.id === 'NEURO_MAGNET') {
      magnetCollected = this.coinManager.attractToPlayer(this.player.position, 14.0, delta);
    }
    this.coinManager.update(this.speed, delta, true, this.player.position);

    const coinsCollected = this.coinManager.checkCollision(this.player.box, this.player.position) + magnetCollected;
    if (coinsCollected > 0) {
      this.coins += coinsCollected * 10;
      audioManager.playCoinPickup();
      const multiplier = (this.activePowerup?.id === 'DOUBLE_SCORE' ? 2 : 1) * this.combo;
      this.score += coinsCollected * 50 * multiplier;
    }

    // 10. Update Knowledge Gate (trigger question pause every 175m)
    const gateEvent = this.gateManager.update(this.speed, delta);
    if (gateEvent && gateEvent.type === 'PAUSE_FOR_QUESTION') {
      this.triggerQuestionPause(gateEvent.question);
      return;
    }

    // 11. Update Dog Pursuit
    if (this.dog) {
      this.dog.update(this.player.position, this.speed, delta);
      uiManager.updateDogThreat(this.dog.state, this.dog.currentDistance);

      if (this.dog.state === 'CAUGHT' && this.dog.currentDistance <= 1.2) {
        this.handleCaughtGameOver();
        return;
      }
    }

    // 12. Audio Footsteps when grounded
    if (this.player.isGrounded && this.player.state === PlayerState.RUNNING) {
      audioManager.playFootstep(delta, this.speed);
    }

    // 13. Check Collisions (shield protection check)
    if (this.invulnerableTimer <= 0) {
      const collision = this.obstacleManager.checkCollision(this.player.box);
      if (collision.hit) {
        if (this.hasShield) {
          // Neural Shield absorbs one impact!
          this.hasShield = false;
          this.player.setShield(false);
          this.activePowerup = null;
          uiManager.updatePowerup(null);
          this.invulnerableTimer = 1.4;
          audioManager.playShieldBreak();
          uiManager.triggerFlash(false);
        } else {
          this.handleCollision('CRASHED');
          return;
        }
      }
    }

    // 14. Progression & Scoring
    const scoreRate = (this.activePowerup?.id === 'DOUBLE_SCORE' ? 2 : 1) * this.combo;
    this.distance += this.speed * delta;
    this.score += CONFIG.SCORE.DISTANCE_RATE * scoreRate * delta;
    this.speed = Math.min(CONFIG.MAX_SPEED, this.speed + CONFIG.ACCELERATION * delta);

    // 15. Update Camera
    this.updateCamera(delta);

    // 16. Update UI HUD
    uiManager.updateHUD(this.score, this.distance, this.coins, this.combo, this.speed);
  }

  handleCollision(cause = 'CRASHED') {
    this.state = GameState.GAME_OVER;
    this.player.state = PlayerState.DEAD;

    audioManager.playImpact();
    audioManager.playGameOver();
    uiManager.triggerFlash(false);

    const stats = {
      score: this.score,
      distance: this.distance,
      coins: this.coins,
      correctAnswers: this.correctAnswers,
      totalQuestions: this.totalQuestions,
      maxCombo: this.maxCombo
    };

    setTimeout(() => {
      uiManager.showGameOver(stats, () => this.restart(), cause);
    }, 600);
  }

  handleCaughtGameOver() {
    this.state = GameState.GAME_OVER;
    this.player.state = PlayerState.DEAD;

    audioManager.playDogCatch();
    uiManager.triggerFlash(false);

    const stats = {
      score: this.score,
      distance: this.distance,
      coins: this.coins,
      correctAnswers: this.correctAnswers,
      totalQuestions: this.totalQuestions,
      maxCombo: this.maxCombo
    };

    setTimeout(() => {
      uiManager.showGameOver(stats, () => this.restart(), 'CAUGHT');
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
    const delta = Math.min(this.clock.getDelta(), 0.05);

    if (this.contextState !== 'LOST') {
      this.update(delta);
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    }

    uiManager.updateDiagnostics(this.getDiagnosticInfo());
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    if (width === this.lastWidth && height === this.lastHeight) return;

    this.lastWidth = width;
    this.lastHeight = height;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.pixelRatio);
  }

  // Requirement 6: Renderer Context Loss Testing Helpers
  testContextLoss() {
    if (this.renderer) {
      this.renderer.forceContextLoss();
    }
  }

  testContextRestore() {
    if (this.renderer) {
      this.renderer.forceContextRestore();
    }
  }
}
