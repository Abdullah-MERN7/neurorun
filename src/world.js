import * as THREE from 'three';
import { CONFIG } from './config.js';
import { assetLoader } from './assetLoader.js';

export const ZoneType = {
  CITY: 'CITY',
  INDUSTRIAL: 'INDUSTRIAL',
  SUBURBAN: 'SUBURBAN',
  NATURE: 'NATURE'
};

const ZONE_SEQUENCE = [
  ZoneType.CITY,
  ZoneType.INDUSTRIAL,
  ZoneType.SUBURBAN,
  ZoneType.NATURE
];

class WorldSegment {
  constructor(scene, segmentIndex) {
    this.scene = scene;
    this.index = segmentIndex;
    this.group = new THREE.Group();

    // Pre-instantiated static scenery groups for ZERO-ALLOCATION recycling
    this.cityGroup = new THREE.Group();
    this.industrialGroup = new THREE.Group();
    this.suburbanGroup = new THREE.Group();
    this.natureGroup = new THREE.Group();

    this.group.add(this.cityGroup);
    this.group.add(this.industrialGroup);
    this.group.add(this.suburbanGroup);
    this.group.add(this.natureGroup);

    this.initTracksAndLaneMarkers();
    this.prebuildAllScenery();

    this.scene.add(this.group);
  }

  initTracksAndLaneMarkers() {
    const segLength = CONFIG.SEGMENT_LENGTH;
    const halfSeg = -segLength / 2;

    // 1. Dark Crushed-Stone Ballast Bed
    const ballastGeo = new THREE.BoxGeometry(8.8, 0.25, segLength);
    const ballastMat = new THREE.MeshStandardMaterial({
      color: 0x1f232b,
      roughness: 0.96,
      metalness: 0.04
    });
    const ballast = new THREE.Mesh(ballastGeo, ballastMat);
    ballast.position.set(0, 0.05, halfSeg);
    ballast.receiveShadow = true;
    this.group.add(ballast);

    // 2. Concrete Railway Boundary Drainage Curbs
    const curbGeo = new THREE.BoxGeometry(0.35, 0.45, segLength);
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x3d434e,
      roughness: 0.85
    });

    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.position.set(-4.45, 0.2, halfSeg);
    leftCurb.receiveShadow = true;
    this.group.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeo, curbMat);
    rightCurb.position.set(4.45, 0.2, halfSeg);
    rightCurb.receiveShadow = true;
    this.group.add(rightCurb);

    // 3. Side Ground Terrain flanking the railway
    const sideGroundGeo = new THREE.PlaneGeometry(60, segLength);
    const sideGroundMat = new THREE.MeshStandardMaterial({
      color: 0x11151c,
      roughness: 0.95
    });

    const leftGround = new THREE.Mesh(sideGroundGeo, sideGroundMat);
    leftGround.rotation.x = -Math.PI / 2;
    leftGround.position.set(-34.5, 0, halfSeg);
    leftGround.receiveShadow = true;
    this.group.add(leftGround);

    const rightGround = new THREE.Mesh(sideGroundGeo, sideGroundMat);
    rightGround.rotation.x = -Math.PI / 2;
    rightGround.position.set(34.5, 0, halfSeg);
    rightGround.receiveShadow = true;
    this.group.add(rightGround);

    // 4. Three Continuous Parallel Railway Tracks (tiled seamlessly)
    const pieceLength = 4.0;
    const piecesPerSegment = Math.round(segLength / pieceLength);

    CONFIG.LANES.forEach((laneX) => {
      for (let i = 0; i < piecesPerSegment; i++) {
        const trackPiece = assetLoader.getModelClone('track_rail');
        trackPiece.scale.set(1.5, 1.2, 1.0);
        trackPiece.position.set(laneX, 0.15, -i * pieceLength);
        this.group.add(trackPiece);
      }
    });

    // 5. Stylized High-Tech 3-Lane Railway Marking System
    // Two Strong Angled / Chevron Lane Boundary Markings at X = -1.3 and X = +1.3
    const chevronWingGeo = new THREE.PlaneGeometry(0.14, 0.55);
    const chevronMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });

    const guideLineGeo = new THREE.PlaneGeometry(0.04, 1.4);
    const guideLineMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });

    const boundaryDividers = [-1.3, 1.3];
    boundaryDividers.forEach((divX) => {
      for (let z = -1.0; z > -segLength; z -= 2.5) {
        // Continuous subtle center dash
        const dash = new THREE.Mesh(guideLineGeo, guideLineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(divX, 0.21, z);
        this.group.add(dash);

        // Paired forward-pointing chevrons (Left wing / and Right wing \)
        const wingL = new THREE.Mesh(chevronWingGeo, chevronMat);
        wingL.rotation.x = -Math.PI / 2;
        wingL.rotation.z = -0.65; // ~37 degrees forward
        wingL.position.set(divX - 0.16, 0.22, z - 0.12);
        this.group.add(wingL);

        const wingR = new THREE.Mesh(chevronWingGeo, chevronMat);
        wingR.rotation.x = -Math.PI / 2;
        wingR.rotation.z = 0.65; // ~37 degrees forward
        wingR.position.set(divX + 0.16, 0.22, z - 0.12);
        this.group.add(wingR);
      }
    });

    // Outer Track Perimeter Boundary Strips (Amber Hazard Borders at X = ±4.3)
    const borderGeo = new THREE.PlaneGeometry(0.12, 2.4);
    const borderMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });

    [-4.3, 4.3].forEach((edgeX) => {
      for (let z = -2; z > -segLength; z -= 3.8) {
        const borderStripe = new THREE.Mesh(borderGeo, borderMat);
        borderStripe.rotation.x = -Math.PI / 2;
        borderStripe.position.set(edgeX, 0.22, z);
        this.group.add(borderStripe);
      }
    });
  }

  prebuildAllScenery() {
    const segZ = -CONFIG.SEGMENT_LENGTH / 2;

    // --- 1. ZONE: CITY (Dense multi-story skyline + street poles) ---
    const bldgNearL = assetLoader.getModelClone('bldg_standard');
    bldgNearL.position.set(-9.5, 0, segZ + 7);
    bldgNearL.scale.set(13.0, 16.0, 13.0);
    this.cityGroup.add(bldgNearL);

    const bldgLowL = assetLoader.getModelClone('bldg_low');
    bldgLowL.position.set(-10.0, 0, segZ - 11);
    bldgLowL.scale.set(18.0, 18.0, 18.0);
    this.cityGroup.add(bldgLowL);

    const skyL = assetLoader.getModelClone('bldg_skyscraper');
    skyL.position.set(-22.0, 0, segZ);
    skyL.scale.set(17.0, 20.0, 17.0);
    this.cityGroup.add(skyL);

    const bldgNearR = assetLoader.getModelClone('bldg_low');
    bldgNearR.position.set(9.5, 0, segZ - 6);
    bldgNearR.scale.set(18.0, 16.0, 18.0);
    this.cityGroup.add(bldgNearR);

    const bldgStandardR = assetLoader.getModelClone('bldg_standard');
    bldgStandardR.position.set(10.2, 0, segZ + 11);
    bldgStandardR.scale.set(13.0, 15.0, 13.0);
    this.cityGroup.add(bldgStandardR);

    const skyR = assetLoader.getModelClone('bldg_skyscraper');
    skyR.position.set(23.0, 0, segZ + 5);
    skyR.scale.set(17.0, 22.0, 17.0);
    this.cityGroup.add(skyR);

    // Decorative utility poles: placed at safe clearance |X| = 9.8m and rotated parallel to tracks (Math.PI / 2) so cross-arms NEVER reach into tracks!
    const poleCityL = assetLoader.getModelClone('prop_pole');
    poleCityL.position.set(-9.8, 0, segZ);
    poleCityL.rotation.y = Math.PI / 2;
    poleCityL.scale.setScalar(14.0);
    this.cityGroup.add(poleCityL);

    const poleCityR = assetLoader.getModelClone('prop_pole');
    poleCityR.position.set(9.8, 0, segZ - 12);
    poleCityR.rotation.y = Math.PI / 2;
    poleCityR.scale.setScalar(14.0);
    this.cityGroup.add(poleCityR);

    // --- 2. ZONE: INDUSTRIAL (Water towers, chimneys, container sidings) ---
    const waterTower = assetLoader.getModelClone('prop_watertower');
    waterTower.position.set(-13.0, 0, segZ + 6);
    waterTower.scale.setScalar(8.5);
    this.industrialGroup.add(waterTower);

    const contIndL1 = assetLoader.getModelClone('container');
    contIndL1.position.set(-8.8, 0, segZ - 8);
    contIndL1.scale.set(7.2, 7.2, 7.2);
    this.industrialGroup.add(contIndL1);

    const contIndL2 = assetLoader.getModelClone('container');
    contIndL2.position.set(-8.8, 2.5, segZ - 8);
    contIndL2.scale.set(7.2, 7.2, 7.2);
    this.industrialGroup.add(contIndL2);

    const chimney = assetLoader.getModelClone('prop_chimney');
    chimney.position.set(13.5, 0, segZ - 4);
    chimney.scale.set(9.0, 12.0, 9.0);
    this.industrialGroup.add(chimney);

    const contIndR = assetLoader.getModelClone('container');
    contIndR.position.set(8.8, 0, segZ + 8);
    contIndR.scale.set(7.2, 7.2, 7.2);
    this.industrialGroup.add(contIndR);

    const warehouseR = assetLoader.getModelClone('bldg_low');
    warehouseR.position.set(18.0, 0, segZ + 2);
    warehouseR.scale.set(16.0, 10.0, 20.0);
    this.industrialGroup.add(warehouseR);

    const poleIndL = assetLoader.getModelClone('prop_pole');
    poleIndL.position.set(-9.8, 0, segZ - 4);
    poleIndL.rotation.y = Math.PI / 2;
    poleIndL.scale.setScalar(14.0);
    this.industrialGroup.add(poleIndL);

    // --- 3. ZONE: SUBURBAN / OUTSKIRTS (Transition mix of low buildings + trees) ---
    const subBldgL = assetLoader.getModelClone('bldg_standard');
    subBldgL.position.set(-10.5, 0, segZ + 10);
    subBldgL.scale.set(11.0, 11.0, 11.0);
    this.suburbanGroup.add(subBldgL);

    const subTreeL = assetLoader.getModelClone('tree_default');
    subTreeL.position.set(-8.5, 0, segZ - 8);
    subTreeL.scale.setScalar(5.5);
    this.suburbanGroup.add(subTreeL);

    const subBushL = assetLoader.getModelClone('plant_bush');
    subBushL.position.set(-6.8, 0, segZ - 3);
    subBushL.scale.setScalar(3.5);
    this.suburbanGroup.add(subBushL);

    const subBldgR = assetLoader.getModelClone('bldg_low');
    subBldgR.position.set(10.5, 0, segZ - 10);
    subBldgR.scale.set(12.0, 10.0, 12.0);
    this.suburbanGroup.add(subBldgR);

    const subTreeR = assetLoader.getModelClone('tree_default');
    subTreeR.position.set(8.8, 0, segZ + 8);
    subTreeR.scale.setScalar(5.5);
    this.suburbanGroup.add(subTreeR);

    // --- 4. ZONE: NATURE (Clusters of pine trees and foliage bushes) ---
    [-14, -6, 2, 10].forEach((zOff) => {
      const treeL = assetLoader.getModelClone('tree_default');
      treeL.position.set(-8.5 + (zOff % 3) * 0.8, 0, segZ + zOff);
      treeL.scale.setScalar(5.0 + Math.abs(zOff) * 0.1);
      this.natureGroup.add(treeL);

      const bushL = assetLoader.getModelClone('plant_bush');
      bushL.position.set(-6.2, 0, segZ + zOff + 2);
      bushL.scale.setScalar(3.5);
      this.natureGroup.add(bushL);

      const treeR = assetLoader.getModelClone('tree_default');
      treeR.position.set(8.5 - (zOff % 3) * 0.8, 0, segZ + zOff);
      treeR.scale.setScalar(5.0 + Math.abs(zOff) * 0.1);
      this.natureGroup.add(treeR);

      const bushR = assetLoader.getModelClone('plant_bush');
      bushR.position.set(6.2, 0, segZ + zOff - 2);
      bushR.scale.setScalar(3.5);
      this.natureGroup.add(bushR);
    });

    // Default to City
    this.setZone(ZoneType.CITY);
  }

  setZone(zone) {
    this.cityGroup.visible = (zone === ZoneType.CITY);
    this.industrialGroup.visible = (zone === ZoneType.INDUSTRIAL);
    this.suburbanGroup.visible = (zone === ZoneType.SUBURBAN);
    this.natureGroup.visible = (zone === ZoneType.NATURE);
  }

  setPositionZ(z) {
    this.group.position.z = z;
  }

  getPositionZ() {
    return this.group.position.z;
  }
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this.currentZone = ZoneType.CITY;
  }

  init() {
    for (let i = 0; i < CONFIG.NUM_SEGMENTS; i++) {
      const segment = new WorldSegment(this.scene, i);
      const zPos = -i * CONFIG.SEGMENT_LENGTH + CONFIG.SEGMENT_LENGTH;
      segment.setPositionZ(zPos);
      segment.setZone(this.currentZone);
      this.segments.push(segment);
    }
  }

  update(speed, delta, distanceTravelled = 0) {
    const moveDistance = speed * delta;

    // Determine current progression zone every ~450 meters
    const zoneIndex = Math.floor(distanceTravelled / 450) % ZONE_SEQUENCE.length;
    this.currentZone = ZONE_SEQUENCE[zoneIndex];

    let furthestZ = 0;
    this.segments.forEach(seg => {
      furthestZ = Math.min(furthestZ, seg.getPositionZ());
    });

    for (const segment of this.segments) {
      segment.setPositionZ(segment.getPositionZ() + moveDistance);

      // When segment passes behind camera, reposition to back
      if (segment.getPositionZ() > CONFIG.RECYCLE_Z) {
        segment.setPositionZ(furthestZ - CONFIG.SEGMENT_LENGTH + 0.1);
        furthestZ = segment.getPositionZ();

        // Switch active zone with ZERO allocation
        segment.setZone(this.currentZone);
      }
    }
  }

  reset() {
    this.currentZone = ZoneType.CITY;

    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      const zPos = -i * CONFIG.SEGMENT_LENGTH + CONFIG.SEGMENT_LENGTH;
      segment.setPositionZ(zPos);
      segment.setZone(this.currentZone);
    }
  }
}
