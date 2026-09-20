import * as THREE from 'three';
import { CONFIG } from './config.js';
import { assetLoader } from './assetLoader.js';
import { questionBank } from './questions.js';

export class GateManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    this.isActive = false;
    this.currentQuestion = null;
    this.distanceSinceLastGate = 0;

    this.laneCanvases = [];
    this.laneTextures = [];
    this.laneBoards = [];

    this.initGateStructure();
    this.scene.add(this.group);
    this.group.visible = false;
  }

  initGateStructure() {
    // Highway gantry sign truss scaled to span 3 railway tracks (width ~8.8m, clearance ~5.5m)
    this.truss = assetLoader.getModelClone('gate_truss');
    // Align gantry legs on the outer ballast edges
    this.truss.scale.set(8.5, 7.8, 8.5);
    this.truss.position.set(0, 0, 0);
    this.group.add(this.truss);

    // Glowing Knowledge Gate overhead cyber sign
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10, 16, 32, 0.95)';
    ctx.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 54px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ KNOWLEDGE GATE ⚡', canvas.width / 2, 95);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px "Segoe UI", sans-serif';
    ctx.fillText('PAUSE & ANSWER TO ACCELERATE', canvas.width / 2, 175);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const boardMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });

    const boardGeo = new THREE.PlaneGeometry(7.2, 1.8);
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 4.4, 0);
    this.group.add(board);

    // Glowing neon energy portal arch
    const beamGeo = new THREE.CylinderGeometry(0.06, 0.06, 5.0, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.75
    });

    [-4.3, 4.3].forEach((x) => {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(x, 2.5, 0);
      this.group.add(beam);
    });
  }

  spawnGate() {
    this.currentQuestion = questionBank.getNextQuestion();
    this.isActive = true;
    // Position gate ahead in clear view of the player
    this.group.position.set(0, 0, -20.0);
    this.group.visible = true;
  }

  update(worldSpeed, delta) {
    if (!this.isActive) {
      this.distanceSinceLastGate += worldSpeed * delta;
      if (this.distanceSinceLastGate >= CONFIG.GATE_INTERVAL_DISTANCE) {
        this.distanceSinceLastGate = 0;
        this.spawnGate();
        return {
          type: 'PAUSE_FOR_QUESTION',
          question: this.currentQuestion
        };
      }
      return null;
    }

    // When running after resume, gate moves past player
    this.group.position.z += worldSpeed * delta;
    if (this.group.position.z > 25.0) {
      this.isActive = false;
      this.group.visible = false;
    }

    return null;
  }

  reset() {
    this.isActive = false;
    this.currentQuestion = null;
    this.distanceSinceLastGate = 0;
    this.group.visible = false;
  }
}
