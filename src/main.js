import './style.css';
import { Game } from './game.js';

// Bootstrap NEURO RUN
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.game = game;
  game.init().catch((err) => {
    console.error('[NeuroRun] Fatal initialization error:', err);
  });
});