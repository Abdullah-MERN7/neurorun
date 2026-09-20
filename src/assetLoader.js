import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

class AssetLoader {
  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXLoader();

    this.cache = new Map();
    this.animations = new Map();
    this.character = null;
  }

  /**
   * Load all core and environment assets with progress reporting.
   * @param {function(number, string)} onProgress - (progress 0..1, currentTask)
   */
  async loadAll(onProgress = () => {}) {
    this.failedAssets = [];
    this.loadedCount = 0;
    this.totalCount = 0;

    const assetManifest = [
      // 1. Character & Animations (FBX) - REQUIRED
      { id: 'remy', type: 'fbx', path: '/assets/characters/Remy.fbx', desc: 'Character Model', required: true },
      { id: 'anim_run', type: 'fbx', path: '/assets/characters/Running.fbx', desc: 'Running Animation', required: true },
      { id: 'anim_jump', type: 'fbx', path: '/assets/characters/Jumping.fbx', desc: 'Jumping Animation', required: true },
      { id: 'anim_slide', type: 'fbx', path: '/assets/characters/Running Slide.fbx', desc: 'Slide Animation', required: true },

      // 2. Track GLB - REQUIRED
      { id: 'track_rail', type: 'gltf', path: '/assets/trains/Models/GLB format/railroad-straight.glb', desc: 'Railway Track', required: true },

      // 3. Train GLBs - OPTIONAL (fallback to group if missing)
      { id: 'train_diesel', type: 'gltf', path: '/assets/trains/Models/GLB format/train-diesel-a.glb', desc: 'Diesel Locomotive', required: false },
      { id: 'train_bullet', type: 'gltf', path: '/assets/trains/Models/GLB format/train-electric-bullet-a.glb', desc: 'Bullet Train', required: false },
      { id: 'train_carriage', type: 'gltf', path: '/assets/trains/Models/GLB format/train-carriage-container-blue.glb', desc: 'Train Carriage', required: false },

      // 4. Obstacle GLBs
      { id: 'barrier', type: 'gltf', path: '/assets/environment/Models/GLB format/construction-barrier.glb', desc: 'Road Barrier', required: true },
      { id: 'container', type: 'gltf', path: '/assets/environment/Models/GLB format/shipping-container-a.glb', desc: 'Cargo Container', required: false },
      { id: 'fence', type: 'gltf', path: '/assets/environment/Models/GLB format/construction-fence.glb', desc: 'Security Fence', required: false },

      // 5. Knowledge Gate Truss
      { id: 'gate_truss', type: 'gltf', path: '/assets/environment/Models/GLB format/sign-highway.glb', desc: 'Highway Sign Gantry', required: false },

      // 6. City Scenery GLBs
      { id: 'bldg_skyscraper', type: 'gltf', path: '/assets/buildings/Models/GLB format/building-skyscraper-a.glb', desc: 'Skyscraper', required: false },
      { id: 'bldg_low', type: 'gltf', path: '/assets/buildings/Models/GLB format/low-detail-building-a.glb', desc: 'Commercial Building', required: false },
      { id: 'bldg_standard', type: 'gltf', path: '/assets/buildings/Models/GLB format/building-a.glb', desc: 'City Building', required: false },

      // 7. Industrial & Railway Infrastructure Scenery GLBs
      { id: 'prop_watertower', type: 'gltf', path: '/assets/environment/Models/GLB format/water-tower.glb', desc: 'Water Tower', required: false },
      { id: 'prop_pole', type: 'gltf', path: '/assets/environment/Models/GLB format/electricity-pole.glb', desc: 'Utility Pole', required: false },
      { id: 'prop_chimney', type: 'gltf', path: '/assets/environment/Models/GLB format/chimney-basic.glb', desc: 'Factory Chimney', required: false },
      { id: 'overhead_gantry', type: 'gltf', path: '/assets/environment/Models/GLB format/electricity-pole-wide.glb', desc: 'Railway Catenary Gantry', required: false },
      { id: 'prop_signal', type: 'gltf', path: '/assets/environment/Models/GLB format/traffic-light.glb', desc: 'Railway Signal', required: false },

      // 8. Nature & Biome Scenery GLBs
      { id: 'tree_default', type: 'gltf', path: '/assets/environment/Models/GLTF format/tree_default.glb', desc: 'Pine Tree', required: false },
      { id: 'plant_bush', type: 'gltf', path: '/assets/environment/Models/GLTF format/plant_bush.glb', desc: 'Foliage Bush', required: false },
      { id: 'rock_desert', type: 'gltf', path: '/assets/environment/Models/GLTF format/stone_tallA.glb', desc: 'Desert Rock', required: false },
      { id: 'tree_palm', type: 'gltf', path: '/assets/environment/Models/GLTF format/tree_palm.glb', desc: 'Coastal Palm', required: false }
    ];

    this.totalCount = assetManifest.length;
    this.loadedCount = 0;
    this.failedAssets = [];

    for (const item of assetManifest) {
      onProgress((this.loadedCount / this.totalCount), `Loading ${item.desc}...`);
      try {
        if (item.type === 'fbx') {
          const fbx = await this.fbxLoader.loadAsync(item.path);
          if (item.id === 'remy') {
            this.character = fbx;
            this.optimizeModel(this.character);
          } else if (item.id.startsWith('anim_')) {
            const clip = fbx.animations && fbx.animations[0];
            if (clip) {
              const name = item.id.replace('anim_', '');
              clip.name = name;
              this.stripRootMotion(clip);
              this.animations.set(name, clip);
            }
          }
          this.cache.set(item.id, fbx);
        } else if (item.type === 'gltf') {
          const gltf = await this.gltfLoader.loadAsync(item.path);
          this.optimizeModel(gltf.scene);
          this.cache.set(item.id, gltf.scene);
        }
        this.loadedCount++;
      } catch (err) {
        console.warn(`[AssetLoader] Failed asset (${item.required ? 'REQUIRED' : 'OPTIONAL'}): ${item.path}`, err);
        this.failedAssets.push(item.path);
        if (item.required) {
          throw new Error(`REQUIRED asset failed: ${item.path}`);
        }
      }
      onProgress((this.loadedCount / this.totalCount), `Loaded ${item.desc}`);
    }

    onProgress(1.0, 'All assets loaded successfully!');
  }

  /**
   * Set up shadows and materials for Three.js rendering.
   */
  optimizeModel(object) {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = !isMobile;
        child.receiveShadow = !isMobile;
        if (child.material) {
          child.material.side = THREE.FrontSide;
          // Soften overly harsh specular highlights
          if (child.material.roughness !== undefined) {
            child.material.roughness = Math.max(0.4, child.material.roughness);
          }
        }
      }
    });
  }

  /**
   * Get a cached clone of a 3D model.
   * @param {string} id
   * @returns {THREE.Object3D}
   */
  getModelClone(id) {
    const original = this.cache.get(id);
    if (!original) {
      console.warn(`[AssetLoader] Asset "${id}" not found in cache!`);
      return new THREE.Group();
    }
    return original.clone(true);
  }

  /**
   * Get character original model.
   */
  getCharacter() {
    return this.character;
  }

  /**
   * Get animation clip by name ('run', 'jump', 'slide').
   * @param {string} name
   * @returns {THREE.AnimationClip|null}
   */
  getAnimation(name) {
    return this.animations.get(name) || null;
  }

  /**
   * Neutralize unwanted root motion (forward/backward Z displacement)
   * while strictly preserving authentic leg/arm swings, torso rotations,
   * and natural vertical hip bounce/crouch (Y).
   */
  stripRootMotion(clip) {
    if (!clip || !clip.tracks) return;

    clip.tracks.forEach((track) => {
      // Root bone translation track (mixamorigHips.position)
      if (track.name.endsWith('.position')) {
        const initX = track.values[0];
        const initZ = track.values[2];
        const count = track.values.length / 3;

        for (let i = 0; i < count; i++) {
          // Lock X and Z to eliminate forward-backward jerk and sideways sliding
          track.values[i * 3 + 0] = initX;
          track.values[i * 3 + 2] = initZ;
          // track.values[i * 3 + 1] (Y) is preserved for natural running bounce & crouch!
        }
      }
    });
  }
}

export const assetLoader = new AssetLoader();
