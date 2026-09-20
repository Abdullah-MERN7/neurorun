import * as THREE from 'three';
import { CONFIG } from './config.js';

// Module-level cached geometries and materials for zero GC allocation
const dogBodyGeo = new THREE.BoxGeometry(0.36, 0.42, 0.88);
const dogChestGeo = new THREE.BoxGeometry(0.34, 0.44, 0.42);
const dogHeadGeo = new THREE.BoxGeometry(0.26, 0.28, 0.32);
const dogSnoutGeo = new THREE.BoxGeometry(0.16, 0.16, 0.24);
const dogNoseGeo = new THREE.BoxGeometry(0.08, 0.06, 0.06);
const dogEarGeo = new THREE.ConeGeometry(0.07, 0.18, 4);
const dogCollarGeo = new THREE.CylinderGeometry(0.18, 0.19, 0.08, 8);
const dogLegGeo = new THREE.BoxGeometry(0.10, 0.46, 0.12);
const dogPawGeo = new THREE.BoxGeometry(0.11, 0.08, 0.15);
const dogTailGeo = new THREE.CylinderGeometry(0.03, 0.06, 0.38, 5);

// Natural German Shepherd / Doberman pursuit dog materials
const furCoatMat = new THREE.MeshStandardMaterial({
  color: 0x2b211a, // Dark coat
  roughness: 0.85,
  metalness: 0.1,
  transparent: true,
  opacity: 0.0
});

const furTanMat = new THREE.MeshStandardMaterial({
  color: 0x8a5832, // Tan muzzle, legs, accents
  roughness: 0.85,
  metalness: 0.1,
  transparent: true,
  opacity: 0.0
});

const noseMat = new THREE.MeshStandardMaterial({
  color: 0x111111,
  roughness: 0.5,
  transparent: true,
  opacity: 0.0
});

const collarMat = new THREE.MeshStandardMaterial({
  color: 0xef4444, // High-visibility red collar
  emissive: 0xff2222,
  emissiveIntensity: 0.35,
  roughness: 0.3,
  metalness: 0.2,
  transparent: true,
  opacity: 0.0
});

const dogMaterials = [furCoatMat, furTanMat, noseMat, collarMat];

export class DogChase {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();

    // Distance state machine (Logical gameplay distance: 40m, 20m, 0m)
    this.targetDistance = 40.0;
    this.currentDistance = 40.0;
    this.state = 'SAFE'; // 'SAFE', 'DANGER', 'CAUGHT'
    this.wrongAnswersCount = 0;

    // Animation pivots
    this.legFL = null;
    this.legFR = null;
    this.legBL = null;
    this.legBR = null;
    this.tailPivot = null;
    this.bodyGroup = null;

    this.animTime = 0;

    this.buildDogModel();
    // Slightly larger scale for clear readability from normal camera perspective
    this.mesh.scale.set(1.25, 1.25, 1.25);

    this.scene.add(this.mesh);
    this.mesh.visible = false;
  }

  buildDogModel() {
    this.bodyGroup = new THREE.Group();

    // 1. Torso
    const torso = new THREE.Mesh(dogBodyGeo, furCoatMat);
    torso.position.set(0, 0.58, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.bodyGroup.add(torso);

    // 2. Chest & Neck
    const chest = new THREE.Mesh(dogChestGeo, furTanMat);
    chest.position.set(0, 0.72, -0.36);
    chest.rotation.x = 0.35;
    chest.castShadow = true;
    this.bodyGroup.add(chest);

    // 3. Collar
    const collar = new THREE.Mesh(dogCollarGeo, collarMat);
    collar.position.set(0, 0.82, -0.46);
    collar.rotation.x = 0.35;
    this.bodyGroup.add(collar);

    // 4. Head
    const head = new THREE.Mesh(dogHeadGeo, furCoatMat);
    head.position.set(0, 0.94, -0.58);
    head.castShadow = true;
    this.bodyGroup.add(head);

    // 5. Snout & Nose
    const snout = new THREE.Mesh(dogSnoutGeo, furTanMat);
    snout.position.set(0, 0.88, -0.78);
    this.bodyGroup.add(snout);

    const nose = new THREE.Mesh(dogNoseGeo, noseMat);
    nose.position.set(0, 0.92, -0.91);
    this.bodyGroup.add(nose);

    // 6. Upright Alert Ears
    const earL = new THREE.Mesh(dogEarGeo, furCoatMat);
    earL.position.set(-0.10, 1.14, -0.55);
    earL.rotation.z = -0.15;
    this.bodyGroup.add(earL);

    const earR = new THREE.Mesh(dogEarGeo, furCoatMat);
    earR.position.set(0.10, 1.14, -0.55);
    earR.rotation.z = 0.15;
    this.bodyGroup.add(earR);

    // 7. Tail with pivot
    this.tailPivot = new THREE.Group();
    this.tailPivot.position.set(0, 0.70, 0.44);
    const tail = new THREE.Mesh(dogTailGeo, furCoatMat);
    tail.position.set(0, 0.16, 0.12);
    tail.rotation.x = 0.85;
    this.tailPivot.add(tail);
    this.bodyGroup.add(this.tailPivot);

    this.mesh.add(this.bodyGroup);

    // 8. Four Running Legs with upper pivots
    const createLeg = (x, z) => {
      const legPivot = new THREE.Group();
      legPivot.position.set(x, 0.46, z);

      const leg = new THREE.Mesh(dogLegGeo, furTanMat);
      leg.position.set(0, -0.21, 0);
      leg.castShadow = true;
      legPivot.add(leg);

      const paw = new THREE.Mesh(dogPawGeo, furCoatMat);
      paw.position.set(0, -0.42, -0.04);
      legPivot.add(paw);

      this.mesh.add(legPivot);
      return legPivot;
    };

    this.legFL = createLeg(-0.16, -0.32);
    this.legFR = createLeg(0.16, -0.32);
    this.legBL = createLeg(-0.16, 0.30);
    this.legBR = createLeg(0.16, 0.30);
  }

  onCorrectAnswer() {
    // Correct answer ALWAYS resets dog to 40m safe distance!
    this.wrongAnswersCount = 0;
    this.state = 'SAFE';
    this.targetDistance = 40.0;
  }

  onWrongAnswer() {
    this.wrongAnswersCount++;
    if (this.wrongAnswersCount === 1) {
      // Wrong answer #1: moves from 40m to 20m danger zone
      this.state = 'DANGER';
      this.targetDistance = 20.0;
      return 'DANGER';
    } else {
      // Wrong answer #2 while already close: catches player!
      this.state = 'CAUGHT';
      this.targetDistance = 0.0;
      return 'CAUGHT';
    }
  }

  setOpacity(val) {
    for (const mat of dogMaterials) {
      mat.opacity = val;
    }
  }

  update(playerPos, speed, delta) {
    // Smoothly damp current distance toward target distance
    const lerpRate = this.state === 'CAUGHT' ? 14.0 : 6.0;
    this.currentDistance = THREE.MathUtils.damp(
      this.currentDistance,
      this.targetDistance,
      lerpRate,
      delta
    );

    // ==============================================================
    // VISIBILITY RULES:
    // >= 30m: completely hidden / subtle
    // 28m: begin smooth reveal
    // 28m -> 20m: smooth opacity transition (0.0 -> 1.0)
    // 20m: clearly visible and readable threat
    // ==============================================================
    if (this.currentDistance >= 30.0) {
      this.mesh.visible = false;
      this.setOpacity(0.0);
      return;
    }

    this.mesh.visible = true;

    // Smooth opacity reveal between 28m and 20m
    const revealAlpha = Math.max(0, Math.min(1, (28.0 - this.currentDistance) / 8.0));
    this.setOpacity(revealAlpha);

    // Visual Z approach:
    // 28m -> 20m: approaches from 5.2m to 3.6m behind Remy
    // 20m -> 0m: approaches from 3.6m to 0.5m (catches player)
    let visualZ;
    if (this.currentDistance >= 20.0) {
      const ratio = (this.currentDistance - 20.0) / 8.0; // 1 at 28m, 0 at 20m
      visualZ = THREE.MathUtils.lerp(3.6, 5.2, ratio);
    } else {
      const ratio = Math.max(0, this.currentDistance / 20.0); // 1 at 20m, 0 at 0m
      visualZ = THREE.MathUtils.lerp(0.5, 3.6, ratio);
    }

    this.mesh.position.z = playerPos.z + visualZ;

    // CRITICAL: Dog Y MUST ALWAYS remain at ground level (0.0)!
    // Jumping Remy must NEVER make the dog float or follow player Y!
    this.mesh.position.y = 0.0;

    // Dog tracks player's horizontal lane smoothly directly behind player
    this.mesh.position.x = THREE.MathUtils.damp(
      this.mesh.position.x,
      playerPos.x,
      12.0,
      delta
    );

    // Animate running gait proportional to world speed
    this.animTime += delta * Math.max(12.0, speed * 0.9);
    const stride = Math.sin(this.animTime);

    // Opposite diagonal legs sync for natural canine trot/gallop
    this.legFL.rotation.x = stride * 0.75;
    this.legBR.rotation.x = stride * 0.65;
    this.legFR.rotation.x = -stride * 0.75;
    this.legBL.rotation.x = -stride * 0.65;

    // Torso subtle vertical bounce and pitch
    this.bodyGroup.position.y = Math.abs(Math.sin(this.animTime * 2)) * 0.08;
    this.bodyGroup.rotation.x = -stride * 0.06;

    // Tail wag/balance
    this.tailPivot.rotation.z = Math.sin(this.animTime * 1.5) * 0.25;
  }

  reset() {
    this.wrongAnswersCount = 0;
    this.state = 'SAFE';
    this.targetDistance = 40.0;
    this.currentDistance = 40.0;
    this.mesh.position.set(0, 0, 40.0);
    this.mesh.visible = false;
    this.setOpacity(0.0);
  }
}
