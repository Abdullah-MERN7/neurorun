import * as THREE from 'three';
import { CONFIG } from './config.js';
import { assetLoader } from './assetLoader.js';

export const ZoneType = {
  CITY_ROAD: 'CITY_ROAD',
  TRANSITION_TO_RAIL: 'TRANSITION_TO_RAIL',
  RAILWAY: 'RAILWAY',
  TRANSITION_FROM_RAIL: 'TRANSITION_FROM_RAIL',
  INDUSTRIAL: 'INDUSTRIAL',
  DESERT: 'DESERT',
  COAST: 'COAST',
  GREEN: 'GREEN'
};

// Deterministic progression sequence:
// Exactly 1 short 40m transition segment between Road and Railway
export const ZONE_PROGRESSION = [
  { type: ZoneType.CITY_ROAD, segmentCount: 14 },           // ~560m pure City Road
  { type: ZoneType.TRANSITION_TO_RAIL, segmentCount: 1 },   // exactly 1 short 40m clean transition
  { type: ZoneType.RAILWAY, segmentCount: 14 },             // ~560m dedicated 100% pure Railway
  { type: ZoneType.TRANSITION_FROM_RAIL, segmentCount: 1 }, // exactly 1 short 40m clean transition
  { type: ZoneType.INDUSTRIAL, segmentCount: 13 },          // ~520m Industrial Corridor
  { type: ZoneType.DESERT, segmentCount: 13 },              // ~520m Full Desert Biome
  { type: ZoneType.COAST, segmentCount: 13 },               // ~520m Coastal Highway & Ocean
  { type: ZoneType.GREEN, segmentCount: 13 }                // ~520m Verdant Forest Valley
];

export const TOTAL_LOOP_SEGMENTS = ZONE_PROGRESSION.reduce((sum, s) => sum + s.segmentCount, 0);

// Atmospheric Fog, Sky, and Light colors tailored for each biome
export const ZONE_ATMOSPHERE = {
  [ZoneType.CITY_ROAD]: {
    fog: 0x131a2e,
    sky: 0x131a2e,
    hemiSky: 0xcbe5ff,
    hemiGround: 0x1a2436
  },
  [ZoneType.TRANSITION_TO_RAIL]: {
    fog: 0x181c24,
    sky: 0x181c24,
    hemiSky: 0xb0c0d8,
    hemiGround: 0x222228
  },
  [ZoneType.RAILWAY]: {
    fog: 0x1a1e28,
    sky: 0x1a1e28,
    hemiSky: 0xa8bccd,
    hemiGround: 0x252320
  },
  [ZoneType.TRANSITION_FROM_RAIL]: {
    fog: 0x1e2026,
    sky: 0x1e2026,
    hemiSky: 0xb5c4d0,
    hemiGround: 0x202024
  },
  [ZoneType.INDUSTRIAL]: {
    fog: 0x22201e,
    sky: 0x22201e,
    hemiSky: 0xd0b8a0,
    hemiGround: 0x201e1c
  },
  [ZoneType.DESERT]: {
    fog: 0xd48750, // Warm golden-orange sunlit desert haze
    sky: 0xd48750,
    hemiSky: 0xffe2b8,
    hemiGround: 0x8a4520
  },
  [ZoneType.COAST]: {
    fog: 0x4890ba, // Sunny coastal azure horizon
    sky: 0x4890ba,
    hemiSky: 0xd2edff,
    hemiGround: 0x205570
  },
  [ZoneType.GREEN]: {
    fog: 0x2a4430, // Forest morning mist
    sky: 0x2a4430,
    hemiSky: 0xc4eec8,
    hemiGround: 0x18301b
  }
};

export function getZoneForSegmentIndex(segIdx) {
  let modIdx = ((segIdx % TOTAL_LOOP_SEGMENTS) + TOTAL_LOOP_SEGMENTS) % TOTAL_LOOP_SEGMENTS;
  let accum = 0;
  for (const stage of ZONE_PROGRESSION) {
    accum += stage.segmentCount;
    if (modIdx < accum) {
      return stage.type;
    }
  }
  return ZoneType.CITY_ROAD;
}

// -------------------------------------------------------------
// MODULE-LEVEL SHARED GEOMETRIES AND MATERIALS (ZERO GC ALLOCATION)
// -------------------------------------------------------------
const segLength = CONFIG.SEGMENT_LENGTH;
const halfSeg = -segLength / 2;

// Road deck & Ballast bed (Road is wide 13m solid deck covering full playable corridor; Ballast is 14m bed)
const roadDeckGeo = new THREE.BoxGeometry(13.0, 0.25, segLength);
const roadDeckMat = new THREE.MeshStandardMaterial({
  color: 0x1b1f28,
  roughness: 0.92,
  metalness: 0.08
});

const ballastBedGeo = new THREE.BoxGeometry(14.0, 0.25, segLength);
const ballastBedMat = new THREE.MeshStandardMaterial({
  color: 0x524b42, // Authentic crushed granite railway stone ballast
  roughness: 0.98,
  metalness: 0.04
});

// Half-segments for transitions
const halfRoadGeo = new THREE.BoxGeometry(13.0, 0.25, segLength / 2);
const halfBallastGeo = new THREE.BoxGeometry(14.0, 0.25, segLength / 2);
const halfCurbGeo = new THREE.BoxGeometry(0.4, 0.35, segLength / 2);

// Curbs (ONLY used in Road zones - attached to road shoulder edge at X = ±6.3m)
const curbGeo = new THREE.BoxGeometry(0.4, 0.35, segLength);
const roadCurbMat = new THREE.MeshStandardMaterial({ color: 0x3a404c, roughness: 0.85 });

// Markings (Zig-zag chevrons, guide lines, borders)
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

const borderGeo = new THREE.PlaneGeometry(0.12, 2.4);
const borderMat = new THREE.MeshBasicMaterial({
  color: 0xfacc15,
  transparent: true,
  opacity: 0.75,
  depthWrite: false
});

// Side terrains: 160m width starting exactly at road edge X = ±6.5m (Center offset = ±86.5m, Y = -0.125m)
const sideGroundGeo = new THREE.PlaneGeometry(160, segLength);
const cityGroundMat = new THREE.MeshStandardMaterial({ color: 0x131720, roughness: 0.95 });
const industrialGroundMat = new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.96 });
const desertGroundMat = new THREE.MeshStandardMaterial({ color: 0xd68d54, roughness: 0.98 }); // Warm sand
const coastSandMat = new THREE.MeshStandardMaterial({ color: 0xddc49a, roughness: 0.96 });
const oceanWaterMat = new THREE.MeshStandardMaterial({ color: 0x1d7ea8, roughness: 0.35, metalness: 0.45 });
const greenGrassMat = new THREE.MeshStandardMaterial({ color: 0x2e5e34, roughness: 0.95 });
const railGravelMat = new THREE.MeshStandardMaterial({ color: 0x3d3730, roughness: 0.98 });

// Railway platform & signals
const platformGeo = new THREE.BoxGeometry(3.5, 0.65, segLength);
const platformMat = new THREE.MeshStandardMaterial({ color: 0x323742, roughness: 0.88 });
const platformEdgeGeo = new THREE.BoxGeometry(0.18, 0.02, segLength);
const platformEdgeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

const signalAspectGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
const signalAspectAmberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
const signalLensGeo = new THREE.SphereGeometry(0.2, 8, 8);

// Transition ramp plate
const transitionPlateGeo = new THREE.BoxGeometry(14.0, 0.08, 1.2);
const transitionPlateMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6, metalness: 0.4 });
const IS_MOBILE_DEVICE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

class WorldSegment {
  constructor(scene, segmentIndex) {
    this.scene = scene;
    this.index = segmentIndex;
    this.currentZone = null;
    this.group = new THREE.Group();

    // Containers matching WorldSegment hierarchy:
    // WorldSegment -> surfaceGroup, sceneryGroup
    this.surfaceGroup = new THREE.Group();
    this.sceneryGroup = new THREE.Group();
    this.group.add(this.surfaceGroup);
    this.group.add(this.sceneryGroup);

    // Apply initial zone (builds surface and scenery ONLY for target zone)
    this.setZone(ZoneType.CITY_ROAD);

    this.scene.add(this.group);
  }

  clearGroup(targetGroup) {
    while (targetGroup.children.length > 0) {
      targetGroup.remove(targetGroup.children[0]);
    }
  }

  // -------------------------------------------------------------
  // ROAD SURFACE (Solid 13m Asphalt deck, lane dashes, curbs)
  // -------------------------------------------------------------
  buildRoadSurface(targetGroup) {
    // 1. Solid 13m Wide Asphalt Deck
    const asphalt = new THREE.Mesh(roadDeckGeo, roadDeckMat);
    asphalt.position.set(0, -0.125, 0);
    asphalt.receiveShadow = !IS_MOBILE_DEVICE;
    targetGroup.add(asphalt);

    // 2. Concrete Road Curbs at X = ±6.3m
    const curbL = new THREE.Mesh(curbGeo, roadCurbMat);
    curbL.position.set(-6.3, 0.075, 0);
    curbL.receiveShadow = !IS_MOBILE_DEVICE;
    targetGroup.add(curbL);

    const curbR = new THREE.Mesh(curbGeo, roadCurbMat);
    curbR.position.set(6.3, 0.075, 0);
    curbR.receiveShadow = !IS_MOBILE_DEVICE;
    targetGroup.add(curbR);

    // 3. Road Lane Markings (Chevrons between lanes)
    // Step size calibrated for mobile stability (6.0m step) vs desktop (2.5m step)
    const stepZ = IS_MOBILE_DEVICE ? 6.0 : 2.5;
    const boundaryDividers = [-1.3, 1.3];

    boundaryDividers.forEach((divX) => {
      for (let z = 18.0; z >= -18.0; z -= stepZ) {
        const dash = new THREE.Mesh(guideLineGeo, guideLineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(divX, 0.015, z);
        targetGroup.add(dash);

        const wingL = new THREE.Mesh(chevronWingGeo, chevronMat);
        wingL.rotation.x = -Math.PI / 2;
        wingL.rotation.z = -0.65;
        wingL.position.set(divX - 0.16, 0.016, z - 0.12);
        targetGroup.add(wingL);

        const wingR = new THREE.Mesh(chevronWingGeo, chevronMat);
        wingR.rotation.x = -Math.PI / 2;
        wingR.rotation.z = 0.65;
        wingR.position.set(divX + 0.16, 0.016, z - 0.12);
        targetGroup.add(wingR);
      }
    });

    // 4. Yellow Road Hazard Edge Stripes at X = ±6.0
    const edgeStepZ = IS_MOBILE_DEVICE ? 8.0 : 3.8;
    [-6.0, 6.0].forEach((edgeX) => {
      for (let z = 16.0; z >= -16.0; z -= edgeStepZ) {
        const stripe = new THREE.Mesh(borderGeo, borderMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(edgeX, 0.016, z);
        targetGroup.add(stripe);
      }
    });
  }

  // -------------------------------------------------------------
  // RAILWAY SURFACE (100% Ballast, 3 Tracks, Catenary, Signals)
  // -------------------------------------------------------------
  buildRailSurface(targetGroup) {
    const ballast = new THREE.Mesh(ballastBedGeo, ballastBedMat);
    ballast.position.set(0, -0.125, 0);
    ballast.receiveShadow = !IS_MOBILE_DEVICE;
    targetGroup.add(ballast);

    const sideL = new THREE.Mesh(sideGroundGeo, railGravelMat);
    sideL.rotation.x = -Math.PI / 2;
    sideL.position.set(-87.0, -0.125, 0);
    sideL.receiveShadow = !IS_MOBILE_DEVICE;
    targetGroup.add(sideL);

    const sideR = new THREE.Mesh(sideGroundGeo, railGravelMat);
    sideR.rotation.x = -Math.PI / 2;
    sideR.position.set(87.0, -0.125, 0);
    sideR.receiveShadow = !IS_MOBILE_DEVICE;
    targetGroup.add(sideR);

    const pieceLength = 4.0;
    const piecesPerSegment = Math.round(segLength / pieceLength);

    CONFIG.LANES.forEach((laneX) => {
      for (let i = 0; i < piecesPerSegment; i++) {
        const trackPiece = assetLoader.getModelClone('track_rail');
        trackPiece.scale.set(1.5, 1.2, 1.0);
        trackPiece.position.set(laneX, 0.02, 18.0 - i * pieceLength);
        targetGroup.add(trackPiece);
      }
    });

    const catenary = assetLoader.getModelClone('overhead_gantry');
    catenary.position.set(0, 0, 0);
    catenary.scale.set(14.0, 14.0, 14.0);
    targetGroup.add(catenary);

    const sigR = assetLoader.getModelClone('prop_signal');
    sigR.position.set(6.2, 0, -4);
    sigR.scale.set(6.0, 6.0, 6.0);
    sigR.rotation.y = Math.PI;
    targetGroup.add(sigR);

    const aspectMesh = new THREE.Mesh(signalLensGeo, signalAspectGreenMat);
    aspectMesh.position.set(6.2, 3.2, -3.8);
    targetGroup.add(aspectMesh);

    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.set(-8.5, 0.28, 0);
    platform.receiveShadow = !IS_MOBILE_DEVICE;
    targetGroup.add(platform);

    const platformEdge = new THREE.Mesh(platformEdgeGeo, platformEdgeMat);
    platformEdge.position.set(-6.68, 0.61, 0);
    targetGroup.add(platformEdge);
  }

  buildTransitionInSurface(targetGroup) {
    const roadHalf = new THREE.Mesh(halfRoadGeo, roadDeckMat);
    roadHalf.position.set(0, -0.125, segLength / 4);
    roadHalf.receiveShadow = !IS_MOBILE_DEVICE;
    targetGroup.add(roadHalf);

    const curbL1 = new THREE.Mesh(halfCurbGeo, roadCurbMat);
    curbL1.position.set(-6.3, 0.075, segLength / 4);
    targetGroup.add(curbL1);

    const curbR1 = new THREE.Mesh(halfCurbGeo, roadCurbMat);
    curbR1.position.set(6.3, 0.075, segLength / 4);
    targetGroup.add(curbR1);

    const ballastHalf = new THREE.Mesh(halfBallastGeo, ballastBedMat);
    ballastHalf.position.set(0, -0.125, -segLength / 4);
    ballastHalf.receiveShadow = !IS_MOBILE_DEVICE;
    targetGroup.add(ballastHalf);

    const sideL = new THREE.Mesh(sideGroundGeo, railGravelMat);
    sideL.rotation.x = -Math.PI / 2;
    sideL.position.set(-86.5, -0.125, 0);
    targetGroup.add(sideL);

    const sideR = new THREE.Mesh(sideGroundGeo, railGravelMat);
    sideR.rotation.x = -Math.PI / 2;
    sideR.position.set(86.5, -0.125, 0);
    targetGroup.add(sideR);

    const plate = new THREE.Mesh(transitionPlateGeo, transitionPlateMat);
    plate.position.set(0, 0.01, 0);
    targetGroup.add(plate);

    const pieceLength = 4.0;
    CONFIG.LANES.forEach((laneX) => {
      for (let i = 0; i < 5; i++) {
        const trackPiece = assetLoader.getModelClone('track_rail');
        trackPiece.scale.set(1.5, 1.2, 1.0);
        trackPiece.position.set(laneX, 0.02, -2.0 - i * pieceLength);
        targetGroup.add(trackPiece);
      }
    });

    const entranceGantry = assetLoader.getModelClone('overhead_gantry');
    entranceGantry.position.set(0, 0, 2.0);
    entranceGantry.scale.set(14.0, 14.0, 14.0);
    targetGroup.add(entranceGantry);

    const sigWarn = assetLoader.getModelClone('prop_signal');
    sigWarn.position.set(6.2, 0, 2.0);
    sigWarn.scale.set(6.0, 6.0, 6.0);
    sigWarn.rotation.y = Math.PI;
    targetGroup.add(sigWarn);

    const amberAspect = new THREE.Mesh(signalLensGeo, signalAspectAmberMat);
    amberAspect.position.set(6.2, 3.2, 2.2);
    targetGroup.add(amberAspect);
  }

  buildTransitionOutSurface(targetGroup) {
    const ballastHalf = new THREE.Mesh(halfBallastGeo, ballastBedMat);
    ballastHalf.position.set(0, -0.125, segLength / 4);
    ballastHalf.receiveShadow = !IS_MOBILE_DEVICE;
    targetGroup.add(ballastHalf);

    const sideL = new THREE.Mesh(sideGroundGeo, railGravelMat);
    sideL.rotation.x = -Math.PI / 2;
    sideL.position.set(-86.5, -0.125, 0);
    targetGroup.add(sideL);

    const sideR = new THREE.Mesh(sideGroundGeo, railGravelMat);
    sideR.rotation.x = -Math.PI / 2;
    sideR.position.set(86.5, -0.125, 0);
    targetGroup.add(sideR);

    const roadHalf = new THREE.Mesh(halfRoadGeo, roadDeckMat);
    roadHalf.position.set(0, -0.125, -segLength / 4);
    roadHalf.receiveShadow = !IS_MOBILE_DEVICE;
    targetGroup.add(roadHalf);

    const curbL2 = new THREE.Mesh(halfCurbGeo, roadCurbMat);
    curbL2.position.set(-6.3, 0.075, -segLength / 4);
    targetGroup.add(curbL2);

    const curbR2 = new THREE.Mesh(halfCurbGeo, roadCurbMat);
    curbR2.position.set(6.3, 0.075, -segLength / 4);
    targetGroup.add(curbR2);

    const plate = new THREE.Mesh(transitionPlateGeo, transitionPlateMat);
    plate.position.set(0, 0.01, 0);
    targetGroup.add(plate);

    const pieceLength = 4.0;
    CONFIG.LANES.forEach((laneX) => {
      for (let i = 0; i < 5; i++) {
        const trackPiece = assetLoader.getModelClone('track_rail');
        trackPiece.scale.set(1.5, 1.2, 1.0);
        trackPiece.position.set(laneX, 0.02, 18.0 - i * pieceLength);
        targetGroup.add(trackPiece);
      }
    });

    const exitGantry = assetLoader.getModelClone('overhead_gantry');
    exitGantry.position.set(0, 0, 2.0);
    exitGantry.scale.set(14.0, 14.0, 14.0);
    targetGroup.add(exitGantry);
  }

  // -------------------------------------------------------------
  // BIOME SCENERY BUILDERS (Built on demand per zone)
  // -------------------------------------------------------------
  buildCityScenery(targetGroup) {
    const segZ = 0.0;
    const sideX = 86.5;

    const cityGroundL = new THREE.Mesh(sideGroundGeo, cityGroundMat);
    cityGroundL.rotation.x = -Math.PI / 2;
    cityGroundL.position.set(-sideX, -0.125, segZ);
    targetGroup.add(cityGroundL);

    const cityGroundR = new THREE.Mesh(sideGroundGeo, cityGroundMat);
    cityGroundR.rotation.x = -Math.PI / 2;
    cityGroundR.position.set(sideX, -0.125, segZ);
    targetGroup.add(cityGroundR);

    const bldgNearL = assetLoader.getModelClone('bldg_standard');
    bldgNearL.position.set(-9.5, 0, segZ + 7);
    bldgNearL.scale.set(13.0, 16.0, 13.0);
    targetGroup.add(bldgNearL);

    const bldgLowL = assetLoader.getModelClone('bldg_low');
    bldgLowL.position.set(-10.0, 0, segZ - 11);
    bldgLowL.scale.set(18.0, 18.0, 18.0);
    targetGroup.add(bldgLowL);

    const skyL = assetLoader.getModelClone('bldg_skyscraper');
    skyL.position.set(-24.0, 0, segZ);
    skyL.scale.set(18.0, 22.0, 18.0);
    targetGroup.add(skyL);

    const bldgNearR = assetLoader.getModelClone('bldg_low');
    bldgNearR.position.set(9.5, 0, segZ - 6);
    bldgNearR.scale.set(18.0, 16.0, 18.0);
    targetGroup.add(bldgNearR);

    const bldgStandardR = assetLoader.getModelClone('bldg_standard');
    bldgStandardR.position.set(10.2, 0, segZ + 11);
    bldgStandardR.scale.set(13.0, 15.0, 13.0);
    targetGroup.add(bldgStandardR);

    const skyR = assetLoader.getModelClone('bldg_skyscraper');
    skyR.position.set(24.0, 0, segZ + 5);
    skyR.scale.set(18.0, 24.0, 18.0);
    targetGroup.add(skyR);

    const poleCityL = assetLoader.getModelClone('prop_pole');
    poleCityL.position.set(-9.8, 0, segZ);
    poleCityL.rotation.y = Math.PI / 2;
    poleCityL.scale.setScalar(14.0);
    targetGroup.add(poleCityL);

    const poleCityR = assetLoader.getModelClone('prop_pole');
    poleCityR.position.set(9.8, 0, segZ - 12);
    poleCityR.rotation.y = Math.PI / 2;
    poleCityR.scale.setScalar(14.0);
    targetGroup.add(poleCityR);
  }

  buildRailScenery(targetGroup) {
    const segZ = 0.0;
    const parkedCarL = assetLoader.getModelClone('train_carriage');
    parkedCarL.position.set(-10.5, 0.15, segZ + 6);
    parkedCarL.scale.set(2.4, 2.5, 2.4);
    targetGroup.add(parkedCarL);

    const poleRailR = assetLoader.getModelClone('prop_pole');
    poleRailR.position.set(10.5, 0, segZ - 10);
    poleRailR.rotation.y = Math.PI / 2;
    poleRailR.scale.setScalar(14.0);
    targetGroup.add(poleRailR);
  }

  buildIndustrialScenery(targetGroup) {
    const segZ = 0.0;
    const sideX = 86.5;

    const indGroundL = new THREE.Mesh(sideGroundGeo, industrialGroundMat);
    indGroundL.rotation.x = -Math.PI / 2;
    indGroundL.position.set(-sideX, -0.125, segZ);
    targetGroup.add(indGroundL);

    const indGroundR = new THREE.Mesh(sideGroundGeo, industrialGroundMat);
    indGroundR.rotation.x = -Math.PI / 2;
    indGroundR.position.set(sideX, -0.125, segZ);
    targetGroup.add(indGroundR);

    const waterTower = assetLoader.getModelClone('prop_watertower');
    waterTower.position.set(-14.0, 0, segZ + 6);
    waterTower.scale.setScalar(9.0);
    targetGroup.add(waterTower);

    const contIndL1 = assetLoader.getModelClone('container');
    contIndL1.position.set(-9.2, 0, segZ - 8);
    contIndL1.scale.set(7.2, 7.2, 7.2);
    targetGroup.add(contIndL1);

    const contIndL2 = assetLoader.getModelClone('container');
    contIndL2.position.set(-9.2, 2.5, segZ - 8);
    contIndL2.scale.set(7.2, 7.2, 7.2);
    targetGroup.add(contIndL2);

    const chimney = assetLoader.getModelClone('prop_chimney');
    chimney.position.set(14.5, 0, segZ - 4);
    chimney.scale.set(9.0, 13.0, 9.0);
    targetGroup.add(chimney);

    const contIndR = assetLoader.getModelClone('container');
    contIndR.position.set(9.2, 0, segZ + 8);
    contIndR.scale.set(7.2, 7.2, 7.2);
    targetGroup.add(contIndR);

    const warehouseR = assetLoader.getModelClone('bldg_low');
    warehouseR.position.set(20.0, 0, segZ + 2);
    warehouseR.scale.set(18.0, 10.0, 22.0);
    targetGroup.add(warehouseR);
  }

  buildDesertScenery(targetGroup) {
    const segZ = 0.0;
    const sideX = 86.5;

    const desertL = new THREE.Mesh(sideGroundGeo, desertGroundMat);
    desertL.rotation.x = -Math.PI / 2;
    desertL.position.set(-sideX, -0.125, segZ);
    targetGroup.add(desertL);

    const desertR = new THREE.Mesh(sideGroundGeo, desertGroundMat);
    desertR.rotation.x = -Math.PI / 2;
    desertR.position.set(sideX, -0.125, segZ);
    targetGroup.add(desertR);

    [-14, -7, 0, 7, 14].forEach((zOff, idx) => {
      const rockL = assetLoader.getModelClone('rock_desert');
      const scaleL = 6.5 + (idx % 3) * 1.2;
      rockL.position.set(-9.5 - Math.abs(zOff) * 0.25, 0, segZ + zOff);
      rockL.scale.setScalar(scaleL);
      rockL.rotation.y = (zOff * 0.45);
      targetGroup.add(rockL);

      if (idx % 2 === 0) {
        const mesaL = assetLoader.getModelClone('rock_desert');
        mesaL.position.set(-22.0 - idx * 2.0, 0, segZ + zOff + 2);
        mesaL.scale.set(11.0, 14.0, 11.0);
        mesaL.rotation.y = zOff * 0.3;
        targetGroup.add(mesaL);
      }

      const rockR = assetLoader.getModelClone('rock_desert');
      const scaleR = 6.0 + ((idx + 1) % 3) * 1.3;
      rockR.position.set(9.5 + Math.abs(zOff) * 0.25, 0, segZ + zOff + 3);
      rockR.scale.setScalar(scaleR);
      rockR.rotation.y = -(zOff * 0.4);
      targetGroup.add(rockR);

      if (idx % 2 === 1) {
        const mesaR = assetLoader.getModelClone('rock_desert');
        mesaR.position.set(22.0 + idx * 2.0, 0, segZ + zOff - 2);
        mesaR.scale.set(12.0, 15.0, 12.0);
        mesaR.rotation.y = -zOff * 0.3;
        targetGroup.add(mesaR);
      }
    });
  }

  buildCoastScenery(targetGroup) {
    const segZ = 0.0;
    const sideX = 86.5;

    const beachL = new THREE.Mesh(sideGroundGeo, coastSandMat);
    beachL.rotation.x = -Math.PI / 2;
    beachL.position.set(-sideX, -0.125, segZ);
    targetGroup.add(beachL);

    const coastBufferGeo = new THREE.PlaneGeometry(14.0, segLength);
    const coastBufferR = new THREE.Mesh(coastBufferGeo, coastSandMat);
    coastBufferR.rotation.x = -Math.PI / 2;
    coastBufferR.position.set(13.5, -0.125, segZ);
    targetGroup.add(coastBufferR);

    const oceanWaterGeo = new THREE.PlaneGeometry(146.0, segLength);
    const oceanR = new THREE.Mesh(oceanWaterGeo, oceanWaterMat);
    oceanR.rotation.x = -Math.PI / 2;
    oceanR.position.set(93.5, -0.28, segZ);
    targetGroup.add(oceanR);

    [-14, -6, 2, 10].forEach((zOff, idx) => {
      const palmL = assetLoader.getModelClone('tree_palm');
      palmL.position.set(-9.5, 0, segZ + zOff);
      palmL.scale.setScalar(6.0);
      targetGroup.add(palmL);

      const palmL2 = assetLoader.getModelClone('tree_palm');
      palmL2.position.set(-17.0, 0, segZ + zOff + 3);
      palmL2.scale.setScalar(7.5);
      targetGroup.add(palmL2);

      const coastalRock = assetLoader.getModelClone('rock_desert');
      coastalRock.position.set(13.5 + (idx % 2) * 1.5, -0.1, segZ + zOff + 1);
      coastalRock.scale.set(4.5, 3.5, 4.5);
      targetGroup.add(coastalRock);
    });
  }

  buildGreenScenery(targetGroup) {
    const segZ = 0.0;
    const sideX = 86.5;

    const greenL = new THREE.Mesh(sideGroundGeo, greenGrassMat);
    greenL.rotation.x = -Math.PI / 2;
    greenL.position.set(-sideX, -0.125, segZ);
    targetGroup.add(greenL);

    const greenR = new THREE.Mesh(sideGroundGeo, greenGrassMat);
    greenR.rotation.x = -Math.PI / 2;
    greenR.position.set(sideX, -0.125, segZ);
    targetGroup.add(greenR);

    [-14, -6, 2, 10].forEach((zOff) => {
      const treeL = assetLoader.getModelClone('tree_default');
      treeL.position.set(-9.5 + (zOff % 3) * 0.8, 0, segZ + zOff);
      treeL.scale.setScalar(5.5 + Math.abs(zOff) * 0.1);
      targetGroup.add(treeL);

      const bushL = assetLoader.getModelClone('plant_bush');
      bushL.position.set(-7.4, 0, segZ + zOff + 2);
      bushL.scale.setScalar(3.8);
      targetGroup.add(bushL);

      const treeR = assetLoader.getModelClone('tree_default');
      treeR.position.set(9.5 - (zOff % 3) * 0.8, 0, segZ + zOff);
      treeR.scale.setScalar(5.5 + Math.abs(zOff) * 0.1);
      targetGroup.add(treeR);

      const bushR = assetLoader.getModelClone('plant_bush');
      bushR.position.set(7.4, 0, segZ + zOff - 2);
      bushR.scale.setScalar(3.8);
      targetGroup.add(bushR);
    });
  }

  setZone(nextZone) {
    if (this.currentZone === nextZone && this.surfaceGroup.children.length > 0) {
      return;
    }

    this.currentZone = nextZone;
    this.clearGroup(this.surfaceGroup);
    this.clearGroup(this.sceneryGroup);

    if (nextZone === ZoneType.RAILWAY) {
      this.buildRailSurface(this.surfaceGroup);
      this.buildRailScenery(this.sceneryGroup);
    } else if (nextZone === ZoneType.TRANSITION_TO_RAIL) {
      this.buildTransitionInSurface(this.surfaceGroup);
      this.buildRailScenery(this.sceneryGroup);
    } else if (nextZone === ZoneType.TRANSITION_FROM_RAIL) {
      this.buildTransitionOutSurface(this.surfaceGroup);
    } else {
      this.buildRoadSurface(this.surfaceGroup);

      if (nextZone === ZoneType.CITY_ROAD) {
        this.buildCityScenery(this.sceneryGroup);
      } else if (nextZone === ZoneType.INDUSTRIAL) {
        this.buildIndustrialScenery(this.sceneryGroup);
      } else if (nextZone === ZoneType.DESERT) {
        this.buildDesertScenery(this.sceneryGroup);
      } else if (nextZone === ZoneType.COAST) {
        this.buildCoastScenery(this.sceneryGroup);
      } else if (nextZone === ZoneType.GREEN) {
        this.buildGreenScenery(this.sceneryGroup);
      }
    }
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
    this.currentGlobalSegmentIndex = 0;
    this.currentZone = ZoneType.CITY_ROAD;
    this.debugTimer = 0;
  }

  init() {
    this.segments = [];
    // Place segments from Z = 0 to -320 (Player starts at Z = 0)
    // All initial 9 segments are 100% pure CITY_ROAD
    for (let i = 0; i < CONFIG.NUM_SEGMENTS; i++) {
      const segment = new WorldSegment(this.scene, i);
      const zPos = -i * CONFIG.SEGMENT_LENGTH;
      segment.setPositionZ(zPos);

      const zone = getZoneForSegmentIndex(i);
      segment.setZone(zone);

      this.segments.push(segment);
    }

    this.currentGlobalSegmentIndex = CONFIG.NUM_SEGMENTS - 1;
    this.currentZone = this.segments[0].currentZone;
    this.debugTimer = 0;

    console.log('[WORLD INIT] Initialized 9 segments from Z=0 to Z=-320m. CurrentZone:', this.currentZone);
  }

  update(speed, delta) {
    const moveDistance = speed * delta;

    // 1. Find the current furthest Z among all segments
    let furthestZ = 0;
    for (let i = 0; i < this.segments.length; i++) {
      const z = this.segments[i].getPositionZ();
      if (z < furthestZ) furthestZ = z;
    }

    // 2. Move and recycle segments
    for (const segment of this.segments) {
      segment.setPositionZ(segment.getPositionZ() + moveDistance);

      // When segment passes behind camera, recycle to the deep horizon
      if (segment.getPositionZ() > CONFIG.RECYCLE_Z) {
        // EXACT mathematical placement without cumulative drift
        segment.setPositionZ(furthestZ - CONFIG.SEGMENT_LENGTH);
        furthestZ = segment.getPositionZ();

        // Advance global segment progression
        this.currentGlobalSegmentIndex++;
        const nextZone = getZoneForSegmentIndex(this.currentGlobalSegmentIndex);
        const oldZone = segment.currentZone;

        // Reconstruct visuals for the new zone
        segment.setZone(nextZone);

        const isRailActive = (
          nextZone === ZoneType.RAILWAY ||
          nextZone === ZoneType.TRANSITION_TO_RAIL ||
          nextZone === ZoneType.TRANSITION_FROM_RAIL
        );

        console.log(`[SEGMENT RECYCLE] Segment ${segment.index} (global #${this.currentGlobalSegmentIndex}): ${oldZone} → ${nextZone} (railActive = ${isRailActive}, z = ${segment.getPositionZ().toFixed(1)}m)`);
      }
    }

    // 3. Current zone at player position (closest segment around Z = 0)
    let closestSeg = this.segments[0];
    let closestDist = Math.abs(closestSeg.getPositionZ());
    for (let i = 1; i < this.segments.length; i++) {
      const dist = Math.abs(this.segments[i].getPositionZ());
      if (dist < closestDist) {
        closestDist = dist;
        closestSeg = this.segments[i];
      }
    }
    this.currentZone = closestSeg.currentZone;

    // 4. Debug print active segment order every 4 seconds
    this.debugTimer += delta;
    if (this.debugTimer >= 4.0) {
      this.debugTimer = 0;
      const sorted = [...this.segments].sort((a, b) => b.getPositionZ() - a.getPositionZ());
      const order = sorted.map(s => `${s.currentZone} (z=${s.getPositionZ().toFixed(0)}m)`);
      console.log('[ACTIVE SEGMENT ORDER from near to far]:\n', JSON.stringify(order, null, 2));
    }
  }

  reset() {
    this.currentGlobalSegmentIndex = 0;
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      const zPos = -i * CONFIG.SEGMENT_LENGTH;
      segment.setPositionZ(zPos);

      const zone = getZoneForSegmentIndex(i);
      segment.setZone(zone);
    }
    this.currentGlobalSegmentIndex = CONFIG.NUM_SEGMENTS - 1;
    this.currentZone = ZoneType.CITY_ROAD;
    this.debugTimer = 0;
    console.log('[WORLD RESET] Reset world to initial pure CITY_ROAD state.');
  }
}
