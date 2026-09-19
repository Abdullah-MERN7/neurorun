import './style.css';
import { Game } from './game.js';

// Bootstrap NEURO RUN
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init().catch((err) => {
    console.error('[NeuroRun] Fatal initialization error:', err);
  });
});