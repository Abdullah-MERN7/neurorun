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
    // 1. Dual side vertical clearance support pillars placed safely outside the 3-lane corridor at X = +-4.8m
    const pillarGeo = new THREE.CylinderGeometry(0.18, 0.22, 5.4, 12);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.8,
      emissive: 0x0f172a
    });

    const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
    pillarL.position.set(-4.8, 2.7, 0);
    this.group.add(pillarL);

    const pillarR = new THREE.Mesh(pillarGeo, pillarMat);
    pillarR.position.set(4.8, 2.7, 0);
    this.group.add(pillarR);

    // Overhead truss crossbar spanning between pillars at Y = 5.3m
    const trussBarGeo = new THREE.BoxGeometry(10.2, 0.35, 0.35);
    const trussBarMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.7
    });
    const trussBar = new THREE.Mesh(trussBarGeo, trussBarMat);
    trussBar.position.set(0, 5.3, 0);
    this.group.add(trussBar);

    // 2. Glowing Knowledge Gate overhead cyber sign banner
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

    const boardGeo = new THREE.PlaneGeometry(8.2, 2.0);
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 4.4, 0);
    this.group.add(board);

    // 3. Glowing cyan neon side portal trim lines at X = +-4.75m
    const beamGeo = new THREE.CylinderGeometry(0.05, 0.05, 5.0, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.85
    });

    [-4.75, 4.75].forEach((x) => {
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
