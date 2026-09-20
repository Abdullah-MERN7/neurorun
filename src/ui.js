// UI Manager handling HUD updates, question pause modal, screen overlays, and feedback

export class UIManager {
  constructor() {
    this.elements = {};
    this.highScore = parseInt(localStorage.getItem('neurorun_highscore') || '0', 10);
  }

  init() {
    this.elements = {
      uiRoot: document.getElementById('ui-root'),
      flashOverlay: document.getElementById('flash-overlay'),

      // Loading
      loadingScreen: document.getElementById('loading-screen'),
      loadingBar: document.getElementById('loading-bar'),
      loadingDesc: document.getElementById('loading-desc'),

      // Start Screen
      startScreen: document.getElementById('start-screen'),
      btnStart: document.getElementById('btn-start'),
      btnMute: document.getElementById('btn-mute'),

      // HUD
      hud: document.getElementById('hud'),
      scoreVal: document.getElementById('hud-score'),
      distVal: document.getElementById('hud-distance'),
      coinsVal: document.getElementById('hud-coins'),
      comboBadge: document.getElementById('hud-combo-badge'),
      comboVal: document.getElementById('hud-combo'),
      speedVal: document.getElementById('hud-speed'),

      // Power-up & Dog Threat
      hudPowerup: document.getElementById('hud-powerup'),
      powerupIcon: document.getElementById('powerup-icon'),
      powerupName: document.getElementById('powerup-name'),
      powerupProgressBar: document.getElementById('powerup-progress-bar'),

      hudDogThreat: document.getElementById('hud-dog-threat'),
      dogThreatText: document.getElementById('dog-threat-text'),

      // Question Pause Modal
      questionScreen: document.getElementById('question-screen'),
      modalCategory: document.getElementById('modal-q-category'),
      modalQText: document.getElementById('modal-q-text'),
      optCards: [
        document.getElementById('opt-card-0'),
        document.getElementById('opt-card-1'),
        document.getElementById('opt-card-2'),
        document.getElementById('opt-card-3')
      ],
      optTexts: [
        document.getElementById('opt-text-0'),
        document.getElementById('opt-text-1'),
        document.getElementById('opt-text-2'),
        document.getElementById('opt-text-3')
      ],

      // Pause Screen
      pauseScreen: document.getElementById('pause-screen'),
      btnResume: document.getElementById('btn-resume'),
      btnPauseRestart: document.getElementById('btn-pause-restart'),

      // Game Over Screen
      gameoverScreen: document.getElementById('gameover-screen'),
      goHeading: document.getElementById('go-heading'),
      goSubheading: document.getElementById('go-subheading'),
      goScore: document.getElementById('go-score'),
      goHighscore: document.getElementById('go-highscore'),
      goDistance: document.getElementById('go-distance'),
      goCoins: document.getElementById('go-coins'),
      goCorrect: document.getElementById('go-correct'),
      goAccuracy: document.getElementById('go-accuracy'),
      goCombo: document.getElementById('go-combo'),
      btnRestart: document.getElementById('btn-restart')
    };
  }

  updateLoading(progress, text) {
    if (this.elements.loadingBar) {
      this.elements.loadingBar.style.width = `${Math.floor(progress * 100)}%`;
    }
    if (this.elements.loadingDesc) {
      this.elements.loadingDesc.textContent = text;
    }
  }

  hideLoading() {
    if (this.elements.loadingScreen) {
      this.elements.loadingScreen.style.display = 'none';
    }
  }

  showStartScreen(onStart, onToggleMute) {
    if (this.elements.startScreen) {
      this.elements.startScreen.style.display = 'flex';
      this.elements.btnStart.onclick = () => {
        this.elements.startScreen.style.display = 'none';
        if (onStart) onStart();
      };
      if (this.elements.btnMute) {
        this.elements.btnMute.onclick = () => {
          if (onToggleMute) {
            const muted = onToggleMute();
            this.elements.btnMute.textContent = muted ? 'UNMUTE AUDIO' : 'MUTE AUDIO';
          }
        };
      }
    }
  }

  showHUD() {
    if (this.elements.hud) {
      this.elements.hud.style.display = 'flex';
    }
  }

  hideHUD() {
    if (this.elements.hud) {
      this.elements.hud.style.display = 'none';
    }
  }

  updateHUD(score, distance, coins, combo, speed) {
    if (this.elements.scoreVal) {
      this.elements.scoreVal.textContent = Math.floor(score).toLocaleString();
    }
    if (this.elements.distVal) {
      this.elements.distVal.textContent = `${Math.floor(distance)}m`;
    }
    if (this.elements.coinsVal) {
      this.elements.coinsVal.textContent = Math.floor(coins).toLocaleString();
    }
    if (this.elements.speedVal) {
      this.elements.speedVal.textContent = `${Math.floor(speed * 3.6)} km/h`;
    }

    if (this.elements.comboVal) {
      this.elements.comboVal.textContent = `x${combo}`;
      if (combo > 1) {
        this.elements.comboBadge.classList.add('pulse');
        setTimeout(() => this.elements.comboBadge?.classList.remove('pulse'), 150);
      }
    }
  }

  updatePowerup(powerup) {
    if (!this.elements.hudPowerup) return;
    if (!powerup || powerup.remaining <= 0) {
      this.elements.hudPowerup.style.display = 'none';
      return;
    }

    this.elements.hudPowerup.style.display = 'flex';
    if (this.elements.powerupIcon) {
      this.elements.powerupIcon.textContent = powerup.icon || '⚡';
    }
    if (this.elements.powerupName) {
      this.elements.powerupName.textContent = powerup.name || 'POWER-UP';
    }
    if (this.elements.powerupProgressBar) {
      const ratio = Math.max(0, Math.min(1, powerup.remaining / powerup.duration));
      this.elements.powerupProgressBar.style.width = `${Math.round(ratio * 100)}%`;
    }
  }

  updateDogThreat(state, distance) {
    if (!this.elements.hudDogThreat) return;

    this.elements.hudDogThreat.className = 'dog-threat-pill';

    if (state === 'CAUGHT') {
      this.elements.hudDogThreat.classList.add('dog-caught');
      this.elements.dogThreatText.textContent = 'CAUGHT!';
    } else if (state === 'DANGER' || distance <= 25.0) {
      this.elements.hudDogThreat.classList.add('dog-danger');
      this.elements.dogThreatText.textContent = `DOG: ${Math.round(distance)}m DANGER`;
    } else {
      this.elements.hudDogThreat.classList.add('dog-safe');
      this.elements.dogThreatText.textContent = `DOG: ${Math.round(distance)}m SAFE`;
    }
  }

  /**
   * Display the Question Pause Modal while game is frozen.
   * Clicking an answer or keyboard 1/2/3 immediately submits it.
   */
  showQuestionModal(question, onSubmitAnswer) {
    if (!this.elements.questionScreen || !question) return;

    this.elements.modalCategory.textContent = question.category || 'KNOWLEDGE GATE';
    this.elements.modalQText.textContent = question.question;

    let answered = false;
    const numOpts = question.options ? question.options.length : 4;

    for (let i = 0; i < this.elements.optCards.length; i++) {
      const card = this.elements.optCards[i];
      if (!card) continue;

      if (i < numOpts) {
        card.style.display = 'flex';
        card.className = 'answer-option-btn';
        card.disabled = false;

        if (this.elements.optTexts[i]) {
          this.elements.optTexts[i].textContent = question.options[i];
        }

        card.onclick = () => {
          if (answered) return;
          answered = true;
          this.handleAnswerSelection(i, question.correctIndex, onSubmitAnswer);
        };
      } else {
        card.style.display = 'none';
      }
    }

    this.elements.questionScreen.style.display = 'flex';
  }

  handleAnswerSelection(selectedIndex, correctIndex, callback) {
    const isCorrect = selectedIndex === correctIndex;

    // Visual feedback on the chosen card
    for (let i = 0; i < this.elements.optCards.length; i++) {
      const card = this.elements.optCards[i];
      if (!card) continue;
      card.disabled = true;
      if (i === selectedIndex) {
        card.classList.add(isCorrect ? 'correct-choice' : 'wrong-choice');
      } else if (i === correctIndex && !isCorrect) {
        card.classList.add('correct-choice');
      }
    }

    // Give player brief visual feedback before auto resuming
    setTimeout(() => {
      this.hideQuestionModal();
      if (callback) callback(selectedIndex, isCorrect);
    }, 450);
  }

  hideQuestionModal() {
    if (this.elements.questionScreen) {
      this.elements.questionScreen.style.display = 'none';
    }
  }

  triggerFlash(isCorrect) {
    if (!this.elements.flashOverlay) return;
    const cls = isCorrect ? 'flash-correct' : 'flash-wrong';
    this.elements.flashOverlay.className = cls;
    setTimeout(() => {
      this.elements.flashOverlay.className = '';
    }, 350);
  }

  showPause(onResume, onRestart) {
    if (this.elements.pauseScreen) {
      this.elements.pauseScreen.style.display = 'flex';
      this.elements.btnResume.onclick = () => {
        this.elements.pauseScreen.style.display = 'none';
        if (onResume) onResume();
      };
      this.elements.btnPauseRestart.onclick = () => {
        this.elements.pauseScreen.style.display = 'none';
        if (onRestart) onRestart();
      };
    }
  }

  hidePause() {
    if (this.elements.pauseScreen) {
      this.elements.pauseScreen.style.display = 'none';
    }
  }

  showGameOver(stats, onRestart, cause = 'CRASHED') {
    if (!this.elements.gameoverScreen) return;

    this.hideHUD();
    this.hideQuestionModal();

    if (this.elements.goHeading) {
      this.elements.goHeading.textContent = cause === 'CAUGHT' ? 'CAUGHT!' : 'CRASHED!';
      this.elements.goHeading.style.color = cause === 'CAUGHT' ? '#ef4444' : '#ff4444';
    }

    if (this.elements.goSubheading) {
      this.elements.goSubheading.textContent = cause === 'CAUGHT'
        ? 'PURSUIT DOG CAUGHT REMY'
        : 'RUN ANALYTICS';
    }

    if (stats.score > this.highScore) {
      this.highScore = Math.floor(stats.score);
      localStorage.setItem('neurorun_highscore', this.highScore.toString());
    }

    this.elements.goScore.textContent = Math.floor(stats.score).toLocaleString();
    this.elements.goHighscore.textContent = this.highScore.toLocaleString();
    this.elements.goDistance.textContent = `${Math.floor(stats.distance)}m`;
    if (this.elements.goCoins) {
      this.elements.goCoins.textContent = Math.floor(stats.coins || 0).toLocaleString();
    }
    this.elements.goCorrect.textContent = `${stats.correctAnswers} / ${stats.totalQuestions}`;

    const acc = stats.totalQuestions > 0
      ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
      : 100;
    this.elements.goAccuracy.textContent = `${acc}%`;
    this.elements.goCombo.textContent = `x${stats.maxCombo}`;

    this.elements.gameoverScreen.style.display = 'flex';

    this.elements.btnRestart.onclick = () => {
      this.elements.gameoverScreen.style.display = 'none';
      if (onRestart) onRestart();
    };
  }

  hideGameOver() {
    if (this.elements.gameoverScreen) {
      this.elements.gameoverScreen.style.display = 'none';
    }
  }
}

export const uiManager = new UIManager();
