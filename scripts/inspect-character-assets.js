import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Box3, Vector3 } from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

globalThis.document = {
  createElementNS: (_namespace, name) => ({
    nodeName: name,
    addEventListener() {},
    removeEventListener() {},
    set src(_value) {}
  })
};

const root = path.resolve('.');
const defaultFiles = [
  'Remy.fbx',
  'Running.fbx',
  'Jumping.fbx',
  'Running Slide.fbx'
];
const args = process.argv.slice(2);
const outputOption = args.find((arg) => arg.startsWith('--output='));
const inputFiles = args.filter((arg) => !arg.startsWith('--output='));
const files = inputFiles.length
  ? inputFiles.map((file) => path.resolve(file))
  : defaultFiles.map((file) => path.join(root, 'public/assets/characters', file));
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
const loaderSource = execFileSync(
  'git',
  ['show', 'HEAD:src/assetLoader.js'],
  { cwd: root, encoding: 'utf8' }
);
const playerSource = execFileSync(
  'git',
  ['show', 'HEAD:src/player.js'],
  { cwd: root, encoding: 'utf8' }
);
const configSource = execFileSync(
  'git',
  ['show', 'HEAD:src/config.js'],
  { cwd: root, encoding: 'utf8' }
);
const loadPaths = new Map(
  [...loaderSource.matchAll(/path: '(\/assets\/characters\/[^']+\.fbx)'/g)]
    .map((match) => [path.basename(match[1]), match[1]])
);
const animationRefs = [...playerSource.matchAll(/getAnimation\('([^']+)'\)/g)]
  .map((match) => match[1]);
const playerScale = Number(configSource.match(/PLAYER_SCALE:\s*([0-9.]+)/)?.[1]);

if (!Number.isFinite(playerScale)) {
  throw new Error('Could not read CONFIG.PLAYER_SCALE from src/config.js');
}

async function loadAsset(file) {
  const buffer = fs.readFileSync(file);
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  if (path.extname(file).toLowerCase() === '.fbx') {
    const object = new FBXLoader().parse(data, `${path.dirname(file)}${path.sep}`);
    return { object, animations: object.animations };
  }
  if (path.extname(file).toLowerCase() === '.glb') {
    return new Promise((resolve, reject) => {
      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(
        data,
        `${path.dirname(file)}${path.sep}`,
        (gltf) => {
          const jointIndices = new Set(
            (gltf.parser.json.skins || []).flatMap((skin) => skin.joints)
          );
          const jointObjects = new Map();
          gltf.scene.traverse((child) => {
            const association = gltf.parser.associations.get(child);
            if (association?.nodes !== undefined && jointIndices.has(association.nodes)) {
              jointObjects.set(association.nodes, child);
            }
          });
          const boneNames = [...jointIndices].map(
            (index) => gltf.parser.json.nodes[index].name
          );
          resolve({
            object: gltf.scene,
            animations: gltf.animations,
            boneNames,
            jointObjects,
            jointIndices
          });
        },
        reject
      );
    });
  }
  throw new Error(`Unsupported character asset format: ${file}`);
}

async function inspect(file, displayName = path.basename(file)) {
  const buffer = fs.readFileSync(file);
  const { object, animations, boneNames: gltfBoneNames, jointObjects } = await loadAsset(file);
  object.updateMatrixWorld(true);

  const bounds = new Box3().setFromObject(object);
  const size = bounds.getSize(new Vector3());
  const boneBounds = new Box3();
  const boneNames = gltfBoneNames || [];
  const meshStats = { meshCount: 0, vertices: 0, triangles: 0 };
  object.traverse((child) => {
    if (child.isBone && !gltfBoneNames) {
      boneNames.push(child.name);
      boneBounds.expandByPoint(child.getWorldPosition(new Vector3()));
    }
    if (!child.isMesh) return;
    meshStats.meshCount++;
    meshStats.vertices += child.geometry.attributes.position?.count || 0;
    meshStats.triangles += child.geometry.index
      ? child.geometry.index.count / 3
      : (child.geometry.attributes.position?.count || 0) / 3;
  });
  if (jointObjects) {
    for (const joint of jointObjects.values()) {
      boneBounds.expandByPoint(joint.getWorldPosition(new Vector3()));
    }
  }
  const boneSize = boneBounds.getSize(new Vector3());

  records.push({
    file: displayName,
    bytes: buffer.length,
    loadedFrom: loadPaths.get(path.basename(file)) || null,
    bounds: meshStats.meshCount ? {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
      size: size.toArray()
    } : null,
    boneBounds: {
      min: boneBounds.min.toArray(),
      max: boneBounds.max.toArray(),
      size: boneSize.toArray()
    },
    fbxRootScale: object.scale.toArray(),
    gameScale: playerScale,
    gameRotationY: Math.PI,
    meshStats,
    boneNames,
    animations: animations.map((clip) => ({
      name: clip.name,
      duration: clip.duration,
      trackCount: clip.tracks.length,
      keyframeCount: clip.tracks.reduce((sum, track) => sum + track.times.length, 0),
      tracks: clip.tracks.map((track) => ({
        name: track.name,
        keyframeCount: track.times.length,
        firstTime: track.times[0] ?? null,
        lastTime: track.times.at(-1) ?? null,
        times: Array.from(track.times),
        values: Array.from(track.values)
      }))
    }))
  });
}

const records = [];
for (const file of files) {
  const displayName = path.relative(root, file).replaceAll('\\', '/');
  await inspect(file, displayName);
}

const result = {
  generatedFrom: files.every((file) => path.extname(file).toLowerCase() === '.fbx')
    ? 'Original FBX files before conversion'
    : 'Character assets inspected for regression comparison',
  application: {
    loaderPath: 'src/assetLoader.js',
    modelLoadType: 'FBXLoader.loadAsync',
    animationClipSelection: 'first FBX animation clip',
    animationNameMapping: {
      anim_run: 'run',
      anim_jump: 'jump',
      anim_slide: 'slide'
    },
    animationApplication: {
      source: 'src/player.js',
      lookupMethod: 'assetLoader.getAnimation',
      lookups: animationRefs,
      mixer: 'THREE.AnimationMixer(this.mesh)',
      runLoop: 'THREE.LoopRepeat (default)',
      jumpLoop: 'THREE.LoopOnce; clampWhenFinished=true',
      slideLoop: 'THREE.LoopOnce; clampWhenFinished=true'
    },
    modelTransform: {
      playerScale,
      rotationY: Math.PI
    }
  },
  files: records
};

const outputPath = outputOption
  ? path.resolve(outputOption.slice('--output='.length))
  : path.join(root, 'baseline.json');
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
