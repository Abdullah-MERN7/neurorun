// Calibrated Game Configuration and Real-World Scale Parameters
export const CONFIG = {
  // 3-Lane coordinates along X (Left, Center, Right)
  // Calibrated to 2.6m track spacing (standard railway multi-track clearance)
  LANES: [-2.6, 0.0, 2.6],
  LANE_WIDTH: 2.6,
  LANE_LERP_SPEED: 14.0,

  // Speed and progression (world meters / second)
  INITIAL_SPEED: 18.0,
  MAX_SPEED: 38.0,
  ACCELERATION: 0.12,
  SPEED_BOOST: 5.0,

  // Jump and Slide Physics calibrated to human scale (Remy = 1.75m)
  // v^2 / 2g = (10.8)^2 / (2 * 28) = ~2.08m apex height (clears 1.05m barrier easily)
  JUMP_VELOCITY: 10.8,
  GRAVITY: -28.0,
  SLIDE_DURATION: 0.85,

  // Player bounds (Width, Height, Depth in meters)
  PLAYER_BOUNDS: {
    RUNNING: { width: 0.65, height: 1.75, depth: 0.65 },
    SLIDING: { width: 0.65, height: 0.70, depth: 1.4 }
  },
  // Scale factor: Remy raw height is 378.485. 378.485 * 0.004624 = 1.75m
  PLAYER_SCALE: 0.004624,

  // World Segments & Endless Track
  SEGMENT_LENGTH: 40.0,
  NUM_SEGMENTS: 5,     // 5 segments cover Z = -160 to +40
  RECYCLE_Z: 25.0,

  // Obstacle Spawning
  OBSTACLE_MIN_DIST: 28.0,
  OBSTACLE_SPAWN_Z: -160.0,
  TRAIN_SPEED_OFFSET: 10.0,

  // Knowledge Gate Question Trigger Distance
  GATE_INTERVAL_DISTANCE: 175.0,

  // Camera Settings framed for realistic human perspective
  CAMERA: {
    OFFSET_Y: 3.2,
    OFFSET_Z: 5.6,
    LOOK_Y: 1.3,
    LOOK_Z: -18.0,
    LERP_SPEED: 9.0,
    FOV: 58
  },

  // Scoring and Combos
  SCORE: {
    DISTANCE_RATE: 10,
    GATE_CORRECT: 500,
    MAX_COMBO: 5
  }
};
