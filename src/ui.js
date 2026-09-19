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
      comboBadge: document.getElementById('hud-combo-badge'),
      comboVal: document.getElementById('hud-combo'),
      speedVal: document.getElementById('hud-speed'),

      // Question Pause Modal
      questionScreen: document.getElementById('question-screen'),
      modalCategory: document.getElementById('modal-q-category'),
      modalQText: document.getElementById('modal-q-text'),
      optCards: [
        document.getElementById('opt-card-0'),
        document.getElementById('opt-card-1'),
        document.getElementById('opt-card-2')
      ],
      optTexts: [
        document.getElementById('opt-text-0'),
        document.getElementById('opt-text-1'),
        document.getElementById('opt-text-2')
      ],
      btnSubmitAnswer: document.getElementById('btn-submit-answer'),

      // Pause Screen
      pauseScreen: document.getElementById('pause-screen'),
      btnResume: document.getElementById('btn-resume'),
      btnPauseRestart: document.getElementById('btn-pause-restart'),

      // Game Over Screen
      gameoverScreen: document.getElementById('gameover-screen'),
      goScore: document.getElementById('go-score'),
      goHighscore: document.getElementById('go-highscore'),
      goDistance: document.getElementById('go-distance'),
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

  updateHUD(score, distance, combo, speed) {
    if (this.elements.scoreVal) {
      this.elements.scoreVal.textContent = Math.floor(score).toLocaleString();
    }
    if (this.elements.distVal) {
      this.elements.distVal.textContent = `${Math.floor(distance)}m`;
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

  /**
   * Display the Question Pause Modal while game is frozen.
   */
  showQuestionModal(question, selectedLaneIndex, onSelectLane, onSubmit) {
    if (!this.elements.questionScreen || !question) return;

    this.elements.modalCategory.textContent = question.category || 'KNOWLEDGE GATE';
    this.elements.modalQText.textContent = question.question;

    for (let i = 0; i < 3; i++) {
      if (this.elements.optTexts[i]) {
        this.elements.optTexts[i].textContent = question.options[i];
      }
      const card = this.elements.optCards[i];
      if (card) {
        card.onclick = () => {
          if (onSelectLane) onSelectLane(i);
          if (onSubmit) onSubmit(i);
        };
      }
    }

    this.highlightQuestionChoice(selectedLaneIndex);

    if (this.elements.btnSubmitAnswer) {
      this.elements.btnSubmitAnswer.onclick = () => {
        if (onSubmit) onSubmit();
      };
    }

    this.elements.questionScreen.style.display = 'flex';
  }

  highlightQuestionChoice(index) {
    for (let i = 0; i < 3; i++) {
      const card = this.elements.optCards[i];
      if (card) {
        if (i === index) {
          card.classList.add('active-choice');
        } else {
          card.classList.remove('active-choice');
        }
      }
    }
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

  showGameOver(stats, onRestart) {
    if (!this.elements.gameoverScreen) return;

    this.hideHUD();
    this.hideQuestionModal();

    if (stats.score > this.highScore) {
      this.highScore = Math.floor(stats.score);
      localStorage.setItem('neurorun_highscore', this.highScore.toString());
    }

    this.elements.goScore.textContent = Math.floor(stats.score).toLocaleString();
    this.elements.goHighscore.textContent = this.highScore.toLocaleString();
    this.elements.goDistance.textContent = `${Math.floor(stats.distance)}m`;
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
