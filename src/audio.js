// Audio Manager using Kenney OGG audio files with Web Audio API synthesis fallback

class AudioManager {
  constructor() {
    this.audioContext = null;
    this.isMuted = false;
    this.isUnlocked = false;

    // Cache HTML5 Audio objects
    this.sounds = {};
    this.footstepTimer = 0;

    this.initAudioList();
  }

  initAudioList() {
    this.soundManifest = {
      footsteps: [
        '/assets/sounds/Audio/footstep_concrete_000.ogg',
        '/assets/sounds/Audio/footstep_concrete_001.ogg',
        '/assets/sounds/Audio/footstep_concrete_002.ogg',
        '/assets/sounds/Audio/footstep_concrete_003.ogg',
        '/assets/sounds/Audio/footstep_concrete_004.ogg'
      ],
      jump: '/assets/sounds/Audio/impactWood_medium_000.ogg',
      land: '/assets/sounds/Audio/impactPlank_medium_000.ogg',
      slide: '/assets/sounds/Audio/footstep_carpet_001.ogg',
      impact: '/assets/sounds/Audio/impactMetal_heavy_000.ogg',
      correct: '/assets/sounds/Audio/impactBell_heavy_000.ogg',
      wrong: '/assets/sounds/Audio/impactTin_medium_000.ogg',
      gameOver: '/assets/sounds/Audio/impactMetal_heavy_002.ogg'
    };

    // Preload audio elements
    Object.keys(this.soundManifest).forEach((key) => {
      const entry = this.soundManifest[key];
      if (Array.isArray(entry)) {
        this.sounds[key] = entry.map(src => this.createAudioElement(src));
      } else {
        this.sounds[key] = this.createAudioElement(entry);
      }
    });
  }

  createAudioElement(src) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    return audio;
  }

  /**
   * Unlock Web Audio & HTML5 Audio on first user interaction.
   */
  unlock() {
    if (this.isUnlocked) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      this.isUnlocked = true;
    } catch (e) {
      console.warn('Audio unlock warning:', e);
    }
  }

  play(name, volume = 0.7) {
    if (this.isMuted) return;

    try {
      const item = this.sounds[name];
      if (!item) return;

      let soundToPlay = item;
      if (Array.isArray(item)) {
        soundToPlay = item[Math.floor(Math.random() * item.length)];
      }

      // Clone or reset time so rapid triggers overlap cleanly
      soundToPlay.currentTime = 0;
      soundToPlay.volume = Math.max(0, Math.min(1, volume));
      soundToPlay.play().catch(() => {
        // Fallback to Web Audio synth if HTML5 audio gets restricted
        this.playSynthFallback(name);
      });
    } catch {
      this.playSynthFallback(name);
    }
  }

  playFootstep(delta, speed) {
    if (this.isMuted) return;
    this.footstepTimer += delta;

    // Footstep pacing proportional to running speed
    const stepInterval = Math.max(0.24, 0.45 - (speed - 18) * 0.008);
    if (this.footstepTimer >= stepInterval) {
      this.footstepTimer = 0;
      this.play('footsteps', 0.35);
    }
  }

  playJump() {
    this.play('jump', 0.6);
  }

  playLand() {
    this.play('land', 0.55);
  }

  playSlide() {
    this.play('slide', 0.65);
  }

  playImpact() {
    this.play('impact', 0.85);
  }

  playCorrect() {
    this.play('correct', 0.8);
  }

  playWrong() {
    this.play('wrong', 0.75);
  }

  playGameOver() {
    this.play('gameOver', 0.9);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Lightweight synthetic sound fallback via Web Audio API.
   */
  playSynthFallback(type) {
    if (!this.audioContext || this.isMuted) return;
    try {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      const now = this.audioContext.currentTime;

      if (type === 'correct') {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.2); // A5
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220.0, now);
        osc.frequency.exponentialRampToValueAtTime(110.0, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'jump') {
        osc.frequency.setValueAtTime(250.0, now);
        osc.frequency.exponentialRampToValueAtTime(450.0, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch {}
  }
}

export const audioManager = new AudioManager();
