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

    // Neon energy barrier & lane overhead signs
    CONFIG.LANES.forEach((laneX) => {
      const laneGroup = new THREE.Group();
      laneGroup.position.set(laneX, 0, 0);

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;

      const boardMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });

      const boardGeo = new THREE.PlaneGeometry(2.3, 1.1);
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.set(0, 4.2, 0);
      laneGroup.add(board);

      // Glowing vertical lane markers
      const beamGeo = new THREE.CylinderGeometry(0.04, 0.04, 4.5, 8);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.6
      });

      const beamL = new THREE.Mesh(beamGeo, beamMat);
      beamL.position.set(-1.15, 2.25, 0);
      laneGroup.add(beamL);

      const beamR = new THREE.Mesh(beamGeo, beamMat);
      beamR.position.set(1.15, 2.25, 0);
      laneGroup.add(beamR);

      this.group.add(laneGroup);

      this.laneCanvases.push(canvas);
      this.laneTextures.push(texture);
      this.laneBoards.push(board);
    });
  }

  spawnGate() {
    this.currentQuestion = questionBank.getNextQuestion();
    this.isActive = true;
    // Position gate ahead in clear view of the player
    this.group.position.set(0, 0, -22.0);
    this.group.visible = true;

    const laneLabels = ['1. LEFT', '2. CENTER', '3. RIGHT'];
    for (let i = 0; i < 3; i++) {
      const canvas = this.laneCanvases[i];
      const ctx = canvas.getContext('2d');
      const text = this.currentQuestion.options[i];

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(8, 14, 26, 0.92)';
      ctx.fillRect(8, 8, canvas.width - 16, canvas.height - 16);

      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 36px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(laneLabels[i], 32, 58);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, canvas.width / 2, 145);

      this.laneTextures[i].needsUpdate = true;
    }
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
