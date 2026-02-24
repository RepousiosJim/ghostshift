// ==================== LEVEL LAYOUTS ====================
// Phase 15: Rooms-and-Corridors Architecture Refactor
// - All levels redesigned with clear room structures
// - Objectives placed in room interiors (not corridors)
// - Corridors are 2-3 tiles wide for clear traversal
// - Patrol routes follow corridors, check room entrances
// - Multiple routes between objectives for stealth flow

const DEFAULT_LEVEL = {
  name: 'Unnamed',
  width: null,   // Per-level dimension support (null = use baseline)
  height: null, // Per-level dimension support (null = use baseline)
  obstacles: [],
  guardPatrol: [],
  dataCore: null,
  keyCard: null,
  hackTerminal: null,
  relayTerminal: null,
  playerStart: null,
  exitZone: null,
  cameras: [],
  motionSensors: [],
  laserGrids: [],
  patrolDrones: [],
  securityCode: null,
  powerCell: null,
  difficulty: 1,
  alarmTimer: null
};

// Map dimensions (baseline - individual levels may override)
const MAP_WIDTH = 22;  // BASELINE: Default map width
const MAP_HEIGHT = 18;  // BASELINE: Default map height

// ==================== OBJECTIVE PLACEMENT FALLBACK SYSTEM ====================
// Deterministic fallback for constrained rooms - never fails silently

const OBJECTIVE_FALLBACKS = {
  // Default safe positions for each objective type (used when primary placement fails)
  defaultPositions: {
    playerStart: {x: 2, y: 15},
    exitZone: {x: 20, y: 2},
    dataCore: {x: 10, y: 9},
    keyCard: {x: 5, y: 8},
    hackTerminal: {x: 15, y: 8}
  },

  // Track placement failures for telemetry
  placementFailures: []
};

/**
 * Validate and fallback objective placement
 * @param {Object} level - Level configuration
 * @param {string} objectiveName - Name of objective field
 * @param {Array} obstacles - Obstacle array
 * @returns {Object} Validated/fallback position
 */
function validateObjectivePlacement(level, objectiveName, obstacles) {
  const position = level[objectiveName];

  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    console.warn(`[ObjectivePlacement] ${level.name || 'Unknown'}: ${objectiveName} missing or invalid, using fallback`);
    OBJECTIVE_FALLBACKS.placementFailures.push({
      level: level.name,
      objective: objectiveName,
      reason: 'missing_or_invalid',
      timestamp: new Date().toISOString()
    });
    return {...OBJECTIVE_FALLBACKS.defaultPositions[objectiveName] || {x: 1, y: 1}};
  }

  // Check if position is on an obstacle
  const isBlocked = obstacles.some(obs => obs.x === position.x && obs.y === position.y);

  if (isBlocked) {
    console.warn(`[ObjectivePlacement] ${level.name}: ${objectiveName} at (${position.x}, ${position.y}) is blocked, relocating`);
    OBJECTIVE_FALLBACKS.placementFailures.push({
      level: level.name,
      objective: objectiveName,
      originalPosition: {...position},
      reason: 'blocked_tile',
      timestamp: new Date().toISOString()
    });

    // Spiral search for nearest walkable tile
    for (let radius = 1; radius <= 5; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const newX = position.x + dx;
          const newY = position.y + dy;
          const isWalkable = !obstacles.some(obs => obs.x === newX && obs.y === newY);
          if (isWalkable && newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT) {
            console.log(`[ObjectivePlacement] ${level.name}: ${objectiveName} relocated to (${newX}, ${newY})`);
            return {x: newX, y: newY};
          }
        }
      }
    }

    // Ultimate fallback to default
    console.error(`[ObjectivePlacement] ${level.name}: ${objectiveName} could not find walkable tile, using default`);
    return {...OBJECTIVE_FALLBACKS.defaultPositions[objectiveName] || {x: 1, y: 1}};
  }

  return position;
}

/**
 * Get placement failure telemetry
 * @returns {Array} Array of placement failure records
 */
export function getPlacementFailures() {
  return [...OBJECTIVE_FALLBACKS.placementFailures];
}

/**
 * Clear placement failure telemetry
 */
export function clearPlacementFailures() {
  OBJECTIVE_FALLBACKS.placementFailures = [];
}

// ==================== PATROL POINT VALIDATION SYSTEM ====================
// Prevents patrol points from creating stuck scenarios near objectives/corners

const PATROL_VALIDATION_CONFIG = {
  // Minimum distance from patrol point to any objective (Manhattan distance)
  minObjectiveDistance: 2,
  
  // Minimum wall clearance for patrol points (check radius in tiles)
  wallClearanceRadius: 1,
  
  // Minimum corridor width near patrol points (tiles)
  minCorridorWidth: 2
};

/**
 * Validate and fix patrol points to prevent stuck scenarios
 * @param {Object} level - Level configuration
 * @param {Array} obstacles - Obstacle array
 * @returns {Array} Validated patrol points
 */
function validatePatrolPoints(level, obstacles) {
  const objectives = [
    level.dataCore,
    level.keyCard,
    level.hackTerminal,
    level.relayTerminal,
    level.playerStart,
    level.exitZone
  ].filter(obj => obj && Number.isFinite(obj.x) && Number.isFinite(obj.y));
  
  const patrolPoints = level.guardPatrol || [];
  const validatedPoints = [];
  const warnings = [];
  
  for (let i = 0; i < patrolPoints.length; i++) {
    const point = patrolPoints[i];
    
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      warnings.push(`Patrol point ${i} invalid, skipping`);
      continue;
    }
    
    // Check if on obstacle
    const isOnObstacle = obstacles.some(obs => obs.x === point.x && obs.y === point.y);
    if (isOnObstacle) {
      warnings.push(`Patrol point ${i} at (${point.x}, ${point.y}) is on obstacle, relocating`);
      const relocated = findNearestWalkable(point, obstacles, objectives, 3);
      if (relocated) {
        validatedPoints.push(relocated);
        console.log(`[PatrolValidation] ${level.name}: patrol[${i}] relocated from (${point.x},${point.y}) to (${relocated.x},${relocated.y})`);
      }
      continue;
    }
    
    // Check distance to objectives
    let tooCloseToObjective = false;
    let nearestObjective = null;
    
    for (const obj of objectives) {
      const dist = Math.abs(point.x - obj.x) + Math.abs(point.y - obj.y);
      if (dist < PATROL_VALIDATION_CONFIG.minObjectiveDistance) {
        tooCloseToObjective = true;
        nearestObjective = obj;
        break;
      }
    }
    
    if (tooCloseToObjective) {
      warnings.push(`Patrol point ${i} at (${point.x}, ${point.y}) too close to objective at (${nearestObjective.x}, ${nearestObjective.y})`);
      const relocated = findNearestWalkable(point, obstacles, objectives, 3);
      if (relocated) {
        validatedPoints.push(relocated);
        console.log(`[PatrolValidation] ${level.name}: patrol[${i}] relocated from (${point.x},${point.y}) to (${relocated.x},${relocated.y}) due to objective proximity`);
      } else {
        // Keep original but log warning
        validatedPoints.push(point);
        console.warn(`[PatrolValidation] ${level.name}: could not relocate patrol[${i}], keeping original`);
      }
      continue;
    }
    
    // Check wall clearance
    const wallClearanceIssue = checkWallClearance(point, obstacles);
    if (wallClearanceIssue) {
      warnings.push(`Patrol point ${i} at (${point.x}, ${point.y}) has wall clearance issue: ${wallClearanceIssue}`);
      // Try to move to better position
      const relocated = findNearestWalkable(point, obstacles, objectives, 2);
      if (relocated) {
        validatedPoints.push(relocated);
        console.log(`[PatrolValidation] ${level.name}: patrol[${i}] relocated from (${point.x},${point.y}) to (${relocated.x},${relocated.y}) due to wall clearance`);
      } else {
        validatedPoints.push(point);
      }
      continue;
    }
    
    // Point is valid
    validatedPoints.push(point);
  }
  
  if (warnings.length > 0 && level.name) {
    console.warn(`[PatrolValidation] ${level.name}: ${warnings.length} patrol point warnings`);
  }
  
  return validatedPoints;
}

/**
 * Find nearest walkable tile away from obstacles and objectives
 * @param {Object} point - Starting point
 * @param {Array} obstacles - Obstacle array
 * @param {Array} objectives - Objectives to avoid
 * @param {number} maxRadius - Maximum search radius
 * @returns {Object|null} New position or null if not found
 */
function findNearestWalkable(point, obstacles, objectives, maxRadius = 3) {
  for (let radius = 1; radius <= maxRadius; radius++) {
    // Check in expanding spiral
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        
        const newX = point.x + dx;
        const newY = point.y + dy;
        
        // Bounds check
        if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) continue;
        
        // Check not on obstacle
        const isWalkable = !obstacles.some(obs => obs.x === newX && obs.y === newY);
        if (!isWalkable) continue;
        
        // Check not too close to objectives
        const tooClose = objectives.some(obj => {
          const dist = Math.abs(newX - obj.x) + Math.abs(newY - obj.y);
          return dist < PATROL_VALIDATION_CONFIG.minObjectiveDistance;
        });
        
        if (tooClose) continue;
        
        // Check wall clearance
        const hasClearance = checkWallClearance({x: newX, y: newY}, obstacles);
        if (!hasClearance) {
          return {x: newX, y: newY};
        }
      }
    }
  }
  
  return null;
}

/**
 * Check if point has adequate wall clearance
 * @param {Object} point - Point to check
 * @param {Array} obstacles - Obstacle array
 * @returns {string|null} Issue description or null if OK
 */
function checkWallClearance(point, obstacles) {
  const radius = PATROL_VALIDATION_CONFIG.wallClearanceRadius;
  let adjacentWalls = 0;
  let wallDirection = null;
  
  // Check 4 cardinal directions
  const directions = [
    {dx: 1, dy: 0, name: 'right'},
    {dx: -1, dy: 0, name: 'left'},
    {dx: 0, dy: 1, name: 'down'},
    {dx: 0, dy: -1, name: 'up'}
  ];
  
  for (const dir of directions) {
    const checkX = point.x + dir.dx;
    const checkY = point.y + dir.dy;
    
    if (obstacles.some(obs => obs.x === checkX && obs.y === checkY)) {
      adjacentWalls++;
      wallDirection = dir.name;
    }
  }
  
  // Corner detection: walls in multiple directions
  if (adjacentWalls >= 2) {
    return `corner (${adjacentWalls} adjacent walls)`;
  }
  
  // Single wall is OK for corridor navigation
  return null;
}

/**
 * Get patrol validation telemetry
 * @returns {Object} Validation stats
 */
export function getPatrolValidationStats() {
  return {
    config: PATROL_VALIDATION_CONFIG,
    timestamp: new Date().toISOString()
  };
}

// Helper function to create room walls
function createRoomWalls(x, y, width, height, doors = {}) {
  const obstacles = [];
  const {
    topDoor = null,      // {offset, width}
    bottomDoor = null,
    leftDoor = null,
    rightDoor = null
  } = doors;

  // Top wall
  for (let dx = 0; dx < width; dx++) {
    if (topDoor && dx >= topDoor.offset && dx < topDoor.offset + topDoor.width) continue;
    obstacles.push({x: x + dx, y: y});
  }

  // Bottom wall
  for (let dx = 0; dx < width; dx++) {
    if (bottomDoor && dx >= bottomDoor.offset && dx < bottomDoor.offset + bottomDoor.width) continue;
    obstacles.push({x: x + dx, y: y + height - 1});
  }

  // Left wall
  for (let dy = 0; dy < height; dy++) {
    if (leftDoor && dy >= leftDoor.offset && dy < leftDoor.offset + leftDoor.width) continue;
    obstacles.push({x: x, y: y + dy});
  }

  // Right wall
  for (let dy = 0; dy < height; dy++) {
    if (rightDoor && dy >= rightDoor.offset && dy < rightDoor.offset + rightDoor.width) continue;
    obstacles.push({x: x + width - 1, y: y + dy});
  }

  return obstacles;
}

// Helper to merge obstacle arrays
function mergeObstacles(...arrays) {
  const seen = new Set();
  const merged = [];
  for (const arr of arrays) {
    for (const obs of arr) {
      const key = `${obs.x},${obs.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(obs);
      }
    }
  }
  return merged;
}

// Level layouts with rooms-and-corridors architecture
const RAW_LEVEL_LAYOUTS = [
  // Level 1: Warehouse V5 - 28x23 map (HORIZONTAL EXPANSION 2026-02-24)
  // HORIZONTAL EXPANSION: 22 columns -> 28 columns (27.3% increase)
  // VERTICAL EXPANSION: 18 rows -> 23 rows (27.8% increase, preserved)
  //
  // ARCHITECTURE:
  // - HORIZONTAL PROGRESSION FLOW: Spawn (left) -> Keycard (left-mid) -> Terminal (center) -> Datacore (right-mid) -> Exit (far right)
  // - 2-TILE WIDE EAST-WEST SPINE CORRIDOR (y=15-16)
  // - 5 MAIN ROOMS with branch connectors to spine corridor
  // - Rooms arranged horizontally for clear left-to-right progression
  //
  // STRICT DUNGEON-ROOM RULES:
  // - Each room: 5x5 minimum (3x3 walkable interior)
  // - Rooms fully surrounded by walls
  // - Doors are 2-tile wide gaps for readability (walkable tiles)
  // - 2-tile wide corridors for clear traversal
  // - Objectives in room interiors only
  // - No non-functional hazards (lasers disabled)
  //
  // HORIZONTAL FLOW:
  // Spawn (x=3) -> Keycard (x=9) -> Terminal (x=15) -> Datacore (x=21) -> Exit (x=26)
  // Players move left-to-right through main objectives
  //
  // LAYOUT (28 columns x 23 rows, horizontal expansion):
  // ┌────────────────────────────────────────────────────────────────────┐ y=0
  // │ ██████████████████████████████████████████████████████████████████│ BORDER
  // │ █┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐████████████████████│
  // │ █│Empty│  │Empty│  │Empty│  │Empty│  │Empty│                     │
  // │ █│     │  │     │  │     │  │     │  │     │   TOP BAND (opt)    │ y=2-4
  // │ █└─────┘  └─────┘  └─────┘  └─────┘  └─────┘                     │
  // │ ██████████████████████████████████████████████████████████████████│ y=6
  // │                                                                    │ y=7-8 (upper corridor)
  // │ ██████████████████████████████████████████████████████████████████│ y=9
  // │ █┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                     │
  // │ █│[S] │  │[K] │  │[T] │  │[D] │  │[X] │   MAIN OBJECTIVE BAND   │ y=11
  // │ █│Spawn  │Key │  │Term│  │Core│  │Exit│   HORIZONTAL PROGRESSION│
  // │ █└──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘                     │
  // │ ████▀████████▀████████▀████████▀████████▀████                     │ y=13
  // │        ▀▀    ▀▀    ▀▀    ▀▀    ▀▀                                │
  // │              EAST-WEST SPINE CORRIDOR (2-tile wide)              │ y=15-16
  // │        ▄▄    ▄▄    ▄▄    ▄▄    ▄▄                                │
  // │ ████▄████████▄████████▄████████▄████████▄████                     │
  // │ █┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                     │
  // │ █│Safe │  │Safe │  │Safe │  │Safe │  │Safe │   SAFE STAGING BAND │ y=19
  // │ █│     │  │     │  │     │  │     │  │     │   (guard-free)      │
  // │ █└─────┘  └─────┘  └─────┘  └─────┘  └─────┘                     │
  // │ ██████████████████████████████████████████████████████████████████│ y=22
  // └────────────────────────────────────────────────────────────────────┘
  {
    name: 'Warehouse',
    width: 28,   // HORIZONTAL EXPANSION: 22 -> 28 (27.3% increase)
    height: 23,  // VERTICAL EXPANSION: 18 -> 23 (27.8% increase)
    obstacles: mergeObstacles(
      // ==================== MAP BORDER ====================
      // Level 1 uses expanded dimensions: 28x23
      Array.from({length: 28}, (_, i) => ({x: i, y: 0})),
      Array.from({length: 28}, (_, i) => ({x: i, y: 22})),
      Array.from({length: 23}, (_, i) => ({x: 0, y: i})),
      Array.from({length: 23}, (_, i) => ({x: 27, y: i})),

      // ==================== MAIN OBJECTIVE BAND ROOMS (y=9-13) ====================
      // 5 rooms arranged horizontally with clear progression
      
      // ROOM 1: SPAWN ROOM (5x5)
      // Location: x=1-5, y=9-13 (left)
      // Walkable interior: x=2-4, y=10-12 (3x3)
      // Door: bottom wall with 2-tile wide gap
      createRoomWalls(1, 9, 5, 5, {bottomDoor: {offset: 1, width: 2}}),

      // ROOM 2: KEYCARD ROOM (5x5)
      // Location: x=7-11, y=9-13 (left-mid)
      // Walkable interior: x=8-10, y=10-12 (3x3)
      // Door: bottom wall with 2-tile wide gap
      createRoomWalls(7, 9, 5, 5, {bottomDoor: {offset: 1, width: 2}}),

      // ROOM 3: TERMINAL ROOM (5x5)
      // Location: x=13-17, y=9-13 (center)
      // Walkable interior: x=14-16, y=10-12 (3x3)
      // Door: bottom wall with 2-tile wide gap
      createRoomWalls(13, 9, 5, 5, {bottomDoor: {offset: 1, width: 2}}),

      // ROOM 4: DATACORE ROOM (5x5)
      // Location: x=19-23, y=9-13 (right-mid)
      // Walkable interior: x=20-22, y=10-12 (3x3)
      // Door: bottom wall with 2-tile wide gap
      createRoomWalls(19, 9, 5, 5, {bottomDoor: {offset: 1, width: 2}}),

      // ROOM 5: EXIT ROOM (3x5)
      // Location: x=25-27, y=9-13 (far right)
      // Walkable interior: x=26, y=10-12 (1x3 - smaller room)
      // Door: bottom wall with 2-tile wide gap
      createRoomWalls(25, 9, 3, 5, {bottomDoor: {offset: 0, width: 2}}),

      // ==================== SAFE STAGING BAND ROOMS (y=17-21) ====================
      // 5 safe rooms below main corridor for staging/reset
      
      // SAFE ROOM 1 (below spawn)
      createRoomWalls(1, 17, 5, 5, {topDoor: {offset: 1, width: 2}}),

      // SAFE ROOM 2 (below keycard)
      createRoomWalls(7, 17, 5, 5, {topDoor: {offset: 1, width: 2}}),

      // SAFE ROOM 3 (below terminal)
      createRoomWalls(13, 17, 5, 5, {topDoor: {offset: 1, width: 2}}),

      // SAFE ROOM 4 (below datacore)
      createRoomWalls(19, 17, 5, 5, {topDoor: {offset: 1, width: 2}}),

      // SAFE ROOM 5 (below exit)
      createRoomWalls(25, 17, 3, 5, {topDoor: {offset: 0, width: 2}}),

      // ==================== HORIZONTAL DIVIDERS ====================
      // Divider between objective band and spine corridor (y=14)
      // 2-tile gaps at each room door
      [{x: 1, y: 14}, {x: 4, y: 14}, {x: 5, y: 14},
       {x: 7, y: 14}, {x: 10, y: 14}, {x: 11, y: 14},
       {x: 13, y: 14}, {x: 16, y: 14}, {x: 17, y: 14},
       {x: 19, y: 14}, {x: 22, y: 14}, {x: 23, y: 14},
       {x: 25, y: 14}, {x: 27, y: 14}],

      // ==================== VERTICAL DIVIDERS (between room columns) ====================
      // Dividers in objective band (y=9-13)
      [{x: 6, y: 9}, {x: 6, y: 10}, {x: 6, y: 11}, {x: 6, y: 12}, {x: 6, y: 13}],
      [{x: 12, y: 9}, {x: 12, y: 10}, {x: 12, y: 11}, {x: 12, y: 12}, {x: 12, y: 13}],
      [{x: 18, y: 9}, {x: 18, y: 10}, {x: 18, y: 11}, {x: 18, y: 12}, {x: 18, y: 13}],
      [{x: 24, y: 9}, {x: 24, y: 10}, {x: 24, y: 11}, {x: 24, y: 12}, {x: 24, y: 13}],

      // Dividers in safe staging band (y=17-21)
      [{x: 6, y: 17}, {x: 6, y: 18}, {x: 6, y: 19}, {x: 6, y: 20}, {x: 6, y: 21}],
      [{x: 12, y: 17}, {x: 12, y: 18}, {x: 12, y: 19}, {x: 12, y: 20}, {x: 12, y: 21}],
      [{x: 18, y: 17}, {x: 18, y: 18}, {x: 18, y: 19}, {x: 18, y: 20}, {x: 18, y: 21}],
      [{x: 24, y: 17}, {x: 24, y: 18}, {x: 24, y: 19}, {x: 24, y: 20}, {x: 24, y: 21}]
    ),

    // ==================== OBJECTIVES (room interiors only) ====================
    // HORIZONTAL FLOW: Spawn -> Keycard -> Terminal -> Datacore -> Exit
    playerStart: {x: 3, y: 11},       // Spawn room center (left)
    keyCard: {x: 9, y: 11},           // Keycard room center (left-mid)
    hackTerminal: {x: 15, y: 11},     // Terminal room center (center)
    dataCore: {x: 21, y: 11},         // Data core room center (right-mid)
    exitZone: {x: 26, y: 11},         // Exit room center (far right)

    // ==================== GUARD PATROL (spine corridor only - REDUCED PRESSURE) ====================
    // Patrol in east-west spine corridor (y=15-16)
    // Guards move horizontally, not blocking objective doors
    guardPatrol: [
      {x: 5, y: 15},     // Left corridor
      {x: 14, y: 15},    // Center corridor
      {x: 23, y: 15},    // Right corridor
      {x: 14, y: 16}     // Center corridor lower
    ],

    // ==================== SENSORS (spine corridor only - reduced overlap) ====================
    // Camera positioned to watch spine corridor mid-point
    cameras: [{x: 14, y: 16}],
    motionSensors: [],
    
    // ==================== NO LASERS (disabled) ====================
    laserGrids: [],

    difficulty: 1
  },

  // Level 2: Labs V2 - 22x18 map (Dungeon Relayout 2026-02-24)
  // IMPROVEMENTS: All objectives in room interiors, 2 staging pockets,
  // clear corridor structure, enemies at thresholds only
  // Rooms: Spawn Room, Equipment Lab (keycard), Terminal Room (terminal),
  //        Server Room (datacore), Exit Room
  // Staging: Corridor alcove (x=7-8, y=14), Upper niche (x=8-10, y=4)
  {
    name: 'Labs',
    obstacles: mergeObstacles(
      // === DISTINCT ROOMS WITH SEPARATED OBJECTIVES ===

      // 1. Spawn Room (bottom-left, 4x4) - player entry point
      createRoomWalls(1, 13, 4, 4, {topDoor: {offset: 1, width: 2}}),

      // 2. Equipment Lab (left, 5x5) - KEYCARD location (distinct room)
      createRoomWalls(1, 6, 5, 5, {
        bottomDoor: {offset: 2, width: 2},
        rightDoor: {offset: 2, width: 2}
      }),

      // 3. Terminal Room (center-left, 4x4) - TERMINAL location (NEW distinct room)
      // Dedicated room for hack terminal, separate from other objectives
      createRoomWalls(7, 5, 4, 4, {
        leftDoor: {offset: 1, width: 2},
        bottomDoor: {offset: 1, width: 2}
      }),

      // 4. Server Room (center-right, 6x5) - DATACORE location (distinct room)
      createRoomWalls(12, 5, 6, 5, {
        leftDoor: {offset: 2, width: 2},
        bottomDoor: {offset: 2, width: 2}
      }),

      // 5. Exit Room (top-right, 3x3) - extraction point
      createRoomWalls(19, 1, 3, 3, {leftDoor: {offset: 1, width: 1}}),

      // === CORRIDORS (2-3 tiles wide for clear traversal) ===

      // Horizontal main corridor (y=11-13)
      // Top wall with gaps for room entrances
      [{x: 5, y: 11}, {x: 6, y: 11}, {x: 11, y: 11},
       {x: 18, y: 11}],
      // Bottom wall with gap for spawn entrance
      [{x: 5, y: 13}, {x: 6, y: 13}, {x: 11, y: 13},
       {x: 18, y: 13}],

      // Vertical corridor to Terminal Room (x=6-7, y=5-10)
      [{x: 6, y: 5}, {x: 6, y: 6}, {x: 6, y: 7}, {x: 6, y: 8}, {x: 6, y: 9}, {x: 6, y: 10}],

      // Vertical corridor to Server Room (x=11-12, y=5-10)
      [{x: 11, y: 5}, {x: 11, y: 6}, {x: 11, y: 7}, {x: 11, y: 8}, {x: 11, y: 9}, {x: 11, y: 10}],

      // Vertical corridor to exit (x=18, y=4-10) - leave gap at y=3-4 for exit room door
      [{x: 18, y: 5}, {x: 18, y: 6}, {x: 18, y: 7}, {x: 18, y: 8}, {x: 18, y: 9}, {x: 18, y: 10}],

      // === STAGING POCKET WALLS (create safe alcoves) ===
      // Pocket 1: Bottom corridor alcove (x=7-8, y=14-15)
      [{x: 7, y: 14}, {x: 9, y: 14}],

      // Pocket 2: Upper corridor niche (x=8-10, y=4)
      [{x: 8, y: 4}, {x: 9, y: 4}, {x: 10, y: 4}],
      
      // Pocket 3: Near spawn exit alcove (x=6, y=15)
      [{x: 6, y: 15}]
    ),

    // === DE-STACKED PATROL (no unfair crossfire overlap) ===
    // Route covers corridor thresholds, not objective rooms
    guardPatrol: [
      {x: 7, y: 12},    // Main corridor left (threshold check)
      {x: 17, y: 12},   // Main corridor right (near exit approach)
      {x: 17, y: 7},    // Vertical corridor mid-point
      {x: 7, y: 7}      // Check terminal room entrance area
    ],

    // === OBJECTIVES IN DISTINCT ROOM INTERIORS ===
    playerStart: {x: 2, y: 15},       // Spawn room (centered)
    keyCard: {x: 3, y: 8},            // Equipment Lab (room interior)
    hackTerminal: {x: 9, y: 7},       // Terminal Room (NEW dedicated room interior)
    dataCore: {x: 15, y: 7},          // Server Room (room interior)
    exitZone: {x: 20, y: 2},          // Exit room (center)

    // === REPOSITIONED SENSORS (watch corridors, not objectives) ===
    cameras: [{x: 8, y: 12}, {x: 17, y: 6}],
    // Motion sensor at server room entrance (tactical choice)
    motionSensors: [{x: 12, y: 9}],

    // === TACTICAL LASER (creates route choice) ===
    laserGrids: [
      {x: 12, y: 7, v: true}   // Blocks direct path to data core (tactical timing)
    ],

    difficulty: 1
  },

  // Level 3: Server Farm - 22x18 map (Medium difficulty)
  // Rooms: Spawn, Security Office, Server Hall, Exit
  {
    name: 'Server Farm',
    obstacles: mergeObstacles(
      // Spawn Room (bottom-left, 4x4)
      createRoomWalls(1, 13, 4, 4, {topDoor: {offset: 1, width: 2}}),
      
      // Security Office (left, 4x4) with keyCard
      createRoomWalls(1, 6, 4, 4, {
        bottomDoor: {offset: 1, width: 2},
        rightDoor: {offset: 1, width: 2}
      }),
      
      // Server Hall (center, 8x6) with dataCore - larger room with internal racks
      createRoomWalls(6, 4, 8, 6, {
        leftDoor: {offset: 2, width: 2},
        rightDoor: {offset: 2, width: 2}
      }),
      // Server rack obstacles inside
      [{x: 8, y: 6}, {x: 9, y: 6}, {x: 11, y: 6}, {x: 12, y: 6}],
      
      // Exit Room (top-right, 3x3)
      createRoomWalls(19, 1, 3, 3, {leftDoor: {offset: 1, width: 1}}),
      
      // Corridor walls
      [{x: 5, y: 11}, {x: 14, y: 11}, {x: 15, y: 11}, {x: 16, y: 11}, {x: 17, y: 11}, {x: 18, y: 11}],
      [{x: 5, y: 13}, {x: 14, y: 13}, {x: 15, y: 13}, {x: 16, y: 13}, {x: 17, y: 13}, {x: 18, y: 13}],
      
      // Vertical corridor to exit
      [{x: 19, y: 4}, {x: 19, y: 5}, {x: 19, y: 6}, {x: 19, y: 7}, {x: 19, y: 8}, {x: 19, y: 9}, {x: 19, y: 10}],
      [{x: 21, y: 4}, {x: 21, y: 5}, {x: 21, y: 6}, {x: 21, y: 7}, {x: 21, y: 8}, {x: 21, y: 9}, {x: 21, y: 10}]
    ),
    
    guardPatrol: [
      {x: 5, y: 12},
      {x: 18, y: 12},
      {x: 18, y: 5},
      {x: 5, y: 5}
    ],
    
    playerStart: {x: 2, y: 15},
    keyCard: {x: 3, y: 8},           // Security Office (centered)
    dataCore: {x: 10, y: 8},         // Server Hall center (clear of racks)
    hackTerminal: {x: 7, y: 8},      // Server Hall entrance (clear)
    exitZone: {x: 20, y: 2},         // Exit room center

    cameras: [{x: 5, y: 12}, {x: 10, y: 5}, {x: 18, y: 12}],
    motionSensors: [{x: 10, y: 9}],
    laserGrids: [{x: 14, y: 7, v: true}],
    
    patrolDrones: [
      {x: 10, y: 7, patrol: [{x: 8, y: 5}, {x: 12, y: 5}, {x: 12, y: 8}, {x: 8, y: 8}]}
    ],
    
    difficulty: 2
  },

  // Level 4: Comms Tower - 22x18 map (Medium difficulty)
  // Rooms: Spawn, Equipment Room, Comms Center (with relay), Exit
  {
    name: 'Comms Tower',
    obstacles: mergeObstacles(
      // Spawn Room (bottom-left, 4x4)
      createRoomWalls(1, 13, 4, 4, {topDoor: {offset: 1, width: 2}}),
      
      // Equipment Room (left, 4x5) with keyCard
      createRoomWalls(1, 5, 4, 5, {
        bottomDoor: {offset: 1, width: 2},
        rightDoor: {offset: 2, width: 2}
      }),
      
      // Comms Center (center-right, 7x6) with dataCore and relay
      createRoomWalls(10, 3, 7, 6, {
        leftDoor: {offset: 2, width: 2},
        bottomDoor: {offset: 3, width: 2}
      }),
      
      // Exit Room (top-right, 3x3)
      createRoomWalls(19, 1, 3, 3, {leftDoor: {offset: 1, width: 1}}),
      
      // Main corridor
      [{x: 5, y: 11}, {x: 6, y: 11}, {x: 7, y: 11}, {x: 8, y: 11}, {x: 9, y: 11},
       {x: 17, y: 11}, {x: 18, y: 11}],
      [{x: 5, y: 13}, {x: 6, y: 13}, {x: 7, y: 13}, {x: 8, y: 13}, {x: 9, y: 13},
       {x: 17, y: 13}, {x: 18, y: 13}],
      
      // Vertical corridor to exit
      [{x: 19, y: 4}, {x: 19, y: 5}, {x: 19, y: 6}, {x: 19, y: 7}, {x: 19, y: 8}, {x: 19, y: 9}, {x: 19, y: 10}],
      [{x: 21, y: 4}, {x: 21, y: 5}, {x: 21, y: 6}, {x: 21, y: 7}, {x: 21, y: 8}, {x: 21, y: 9}, {x: 21, y: 10}]
    ),
    
    guardPatrol: [
      {x: 5, y: 12},
      {x: 18, y: 12},
      {x: 18, y: 6},
      {x: 5, y: 6}
    ],
    
    playerStart: {x: 2, y: 15},
    keyCard: {x: 3, y: 8},           // Equipment Room (centered)
    dataCore: {x: 14, y: 6},         // Comms Center
    hackTerminal: {x: 11, y: 7},     // Comms Center entrance (clear)
    relayTerminal: {x: 15, y: 7},    // Comms Center (relay variant, clear of wall)
    exitZone: {x: 20, y: 2},         // Exit room center

    cameras: [{x: 6, y: 12}, {x: 14, y: 4}, {x: 18, y: 12}],
    motionSensors: [{x: 13, y: 6}],
    laserGrids: [{x: 9, y: 6, v: true}],
    
    patrolDrones: [
      {x: 13, y: 6, patrol: [{x: 11, y: 5}, {x: 15, y: 5}, {x: 15, y: 7}, {x: 11, y: 7}]}
    ],
    
    difficulty: 2
  },

  // Level 5: The Vault - 22x18 map (Hard difficulty)
  // Rooms: Spawn, Security Checkpoint, Vault Chamber, Exit
  {
    name: 'The Vault',
    obstacles: mergeObstacles(
      // Spawn Room (bottom-left, 4x4)
      createRoomWalls(1, 13, 4, 4, {topDoor: {offset: 1, width: 2}}),
      
      // Security Checkpoint (left, 4x5) with keyCard
      createRoomWalls(1, 5, 4, 5, {
        bottomDoor: {offset: 1, width: 2},
        rightDoor: {offset: 2, width: 2}
      }),
      
      // Vault Chamber (center-right, 8x6) with dataCore
      createRoomWalls(10, 3, 8, 6, {
        leftDoor: {offset: 2, width: 2},
        bottomDoor: {offset: 3, width: 2}
      }),
      // Internal vault pillars
      [{x: 12, y: 5}, {x: 15, y: 5}, {x: 12, y: 6}, {x: 15, y: 6}],
      
      // Exit Room (top-right, 3x3)
      createRoomWalls(19, 1, 3, 3, {leftDoor: {offset: 1, width: 1}}),
      
      // Main corridor with security checkpoints
      [{x: 5, y: 11}, {x: 6, y: 11}, {x: 7, y: 11}, {x: 8, y: 11}, {x: 9, y: 11},
       {x: 18, y: 11}],
      [{x: 5, y: 13}, {x: 6, y: 13}, {x: 7, y: 13}, {x: 8, y: 13}, {x: 9, y: 13},
       {x: 18, y: 13}],
      
      // Vertical corridor to exit
      [{x: 19, y: 4}, {x: 19, y: 5}, {x: 19, y: 6}, {x: 19, y: 7}, {x: 19, y: 8}, {x: 19, y: 9}, {x: 19, y: 10}],
      [{x: 21, y: 4}, {x: 21, y: 5}, {x: 21, y: 6}, {x: 21, y: 7}, {x: 21, y: 8}, {x: 21, y: 9}, {x: 21, y: 10}],
      
      // Additional corridor walls for multi-route
      [{x: 5, y: 2}, {x: 5, y: 3}, {x: 5, y: 4}],
      [{x: 7, y: 2}, {x: 7, y: 3}, {x: 7, y: 4}],
      [{x: 8, y: 2}, {x: 9, y: 2}]
    ),
    
    guardPatrol: [
      {x: 5, y: 12},
      {x: 18, y: 12},
      {x: 18, y: 5},
      {x: 5, y: 5},
      {x: 5, y: 3},  // Patrol upper corridor
      {x: 8, y: 3}
    ],
    
    playerStart: {x: 2, y: 15},
    keyCard: {x: 3, y: 8},           // Security Checkpoint (centered)
    dataCore: {x: 14, y: 7},         // Vault Chamber center (clear of pillars)
    hackTerminal: {x: 11, y: 7},     // Vault entrance (clear)
    exitZone: {x: 20, y: 2},         // Exit room center

    cameras: [{x: 6, y: 12}, {x: 14, y: 4}, {x: 18, y: 12}, {x: 6, y: 3}],
    motionSensors: [{x: 13, y: 7}, {x: 6, y: 3}],
    laserGrids: [{x: 9, y: 5, v: true}, {x: 6, y: 9, h: true}],
    
    patrolDrones: [
      {x: 14, y: 6, patrol: [{x: 12, y: 5}, {x: 16, y: 5}, {x: 16, y: 7}, {x: 12, y: 7}]}
    ],
    
    difficulty: 3
  },

  // Level 6: Training Facility - 22x18 map (Hard difficulty)
  // Rooms: Spawn, Training Hall, Control Room, Exit
  {
    name: 'Training Facility',
    obstacles: mergeObstacles(
      // Spawn Room (bottom-left, 4x4)
      createRoomWalls(1, 13, 4, 4, {topDoor: {offset: 1, width: 2}}),
      
      // Training Hall (center-left, 6x6) with obstacles
      createRoomWalls(1, 5, 6, 6, {
        bottomDoor: {offset: 2, width: 2},
        rightDoor: {offset: 2, width: 2}
      }),
      // Training obstacles
      [{x: 3, y: 7}, {x: 4, y: 7}, {x: 3, y: 8}, {x: 4, y: 8}],
      
      // Control Room (right, 6x5) with dataCore
      createRoomWalls(12, 4, 6, 5, {
        leftDoor: {offset: 2, width: 2},
        bottomDoor: {offset: 2, width: 2}
      }),
      
      // Exit Room (top-right, 3x3)
      createRoomWalls(19, 1, 3, 3, {leftDoor: {offset: 1, width: 1}}),
      
      // Main corridor
      [{x: 7, y: 11}, {x: 8, y: 11}, {x: 9, y: 11}, {x: 10, y: 11}, {x: 11, y: 11},
       {x: 18, y: 11}],
      [{x: 7, y: 13}, {x: 8, y: 13}, {x: 9, y: 13}, {x: 10, y: 13}, {x: 11, y: 13},
       {x: 18, y: 13}],
      
      // Vertical corridor to exit
      [{x: 19, y: 4}, {x: 19, y: 5}, {x: 19, y: 6}, {x: 19, y: 7}, {x: 19, y: 8}, {x: 19, y: 9}, {x: 19, y: 10}],
      [{x: 21, y: 4}, {x: 21, y: 5}, {x: 21, y: 6}, {x: 21, y: 7}, {x: 21, y: 8}, {x: 21, y: 9}, {x: 21, y: 10}],
      
      // Secondary corridor (upper)
      [{x: 7, y: 2}, {x: 7, y: 3}, {x: 8, y: 3}, {x: 9, y: 3}],
      [{x: 11, y: 2}, {x: 11, y: 3}]
    ),
    
    guardPatrol: [
      {x: 7, y: 12},
      {x: 18, y: 12},
      {x: 18, y: 6},
      {x: 7, y: 6},
      {x: 7, y: 3},  // Upper route
      {x: 10, y: 3}
    ],
    
    playerStart: {x: 2, y: 15},
    keyCard: {x: 2, y: 6},           // Training Hall (clear of obstacles)
    dataCore: {x: 15, y: 6},         // Control Room
    hackTerminal: {x: 13, y: 7},     // Control Room entrance (clear)
    exitZone: {x: 20, y: 2},         // Exit room center

    cameras: [{x: 8, y: 12}, {x: 15, y: 5}, {x: 18, y: 12}],
    motionSensors: [{x: 14, y: 6}, {x: 9, y: 3}],
    laserGrids: [{x: 11, y: 6, v: true}, {x: 8, y: 9, h: true}],
    
    patrolDrones: [
      {x: 15, y: 6, patrol: [{x: 13, y: 5}, {x: 17, y: 5}, {x: 17, y: 7}, {x: 13, y: 7}]}
    ],
    
    difficulty: 3
  },

  // Level 7: Penthouse - 22x18 map (Hard difficulty)
  // Rooms: Spawn, Lounge, VIP Suite, Exit
  {
    name: 'Penthouse',
    obstacles: mergeObstacles(
      // Spawn Room (bottom-left, 4x4)
      createRoomWalls(1, 13, 4, 4, {topDoor: {offset: 1, width: 2}}),
      
      // Lounge (left-center, 5x5) with keyCard
      createRoomWalls(1, 6, 5, 5, {
        bottomDoor: {offset: 2, width: 2},
        rightDoor: {offset: 2, width: 2}
      }),
      // Lounge furniture
      [{x: 3, y: 8}, {x: 3, y: 9}],
      
      // VIP Suite (center-right, 7x6) with dataCore
      createRoomWalls(10, 3, 7, 6, {
        leftDoor: {offset: 2, width: 2},
        bottomDoor: {offset: 3, width: 2}
      }),
      // VIP furniture
      [{x: 13, y: 5}, {x: 14, y: 5}],
      
      // Exit Room (top-right, 3x3)
      createRoomWalls(19, 1, 3, 3, {leftDoor: {offset: 1, width: 1}}),
      
      // Main corridor
      [{x: 6, y: 11}, {x: 7, y: 11}, {x: 8, y: 11}, {x: 9, y: 11},
       {x: 17, y: 11}, {x: 18, y: 11}],
      [{x: 6, y: 13}, {x: 7, y: 13}, {x: 8, y: 13}, {x: 9, y: 13},
       {x: 17, y: 13}, {x: 18, y: 13}],
      
      // Vertical corridor to exit
      [{x: 19, y: 4}, {x: 19, y: 5}, {x: 19, y: 6}, {x: 19, y: 7}, {x: 19, y: 8}, {x: 19, y: 9}, {x: 19, y: 10}],
      [{x: 21, y: 4}, {x: 21, y: 5}, {x: 21, y: 6}, {x: 21, y: 7}, {x: 21, y: 8}, {x: 21, y: 9}, {x: 21, y: 10}],
      
      // Upper corridor (alternative route)
      [{x: 6, y: 2}, {x: 6, y: 3}, {x: 6, y: 4}, {x: 7, y: 4}, {x: 8, y: 4}],
      [{x: 9, y: 2}]
    ),
    
    guardPatrol: [
      {x: 6, y: 12},
      {x: 18, y: 12},
      {x: 18, y: 5},
      {x: 6, y: 5},
      {x: 6, y: 3},  // Upper route
      {x: 8, y: 3}
    ],
    
    playerStart: {x: 2, y: 15},
    keyCard: {x: 4, y: 8},           // Lounge (clear of furniture)
    dataCore: {x: 14, y: 7},         // VIP Suite (clear of furniture)
    hackTerminal: {x: 11, y: 7},     // VIP entrance (clear)
    exitZone: {x: 20, y: 2},         // Exit room center

    cameras: [{x: 7, y: 12}, {x: 14, y: 4}, {x: 18, y: 12}, {x: 7, y: 3}],
    motionSensors: [{x: 13, y: 7}, {x: 7, y: 3}],
    laserGrids: [{x: 9, y: 6, v: true}, {x: 6, y: 9, h: true}],
    
    patrolDrones: [
      {x: 14, y: 6, patrol: [{x: 12, y: 5}, {x: 16, y: 5}, {x: 16, y: 7}, {x: 12, y: 7}]}
    ],
    
    difficulty: 3,
    alarmTimer: 45  // Alarm triggers after 45 seconds
  }
];

// ==================== LEVEL CONFIGURATION ====================

// Helper functions for normalization
function normalizeLaserGrid(grid) {
  if (!grid || typeof grid !== 'object') return null;
  if (!Number.isFinite(grid.x) || !Number.isFinite(grid.y)) return null;
  if (grid.h || grid.v) return grid;
  const direction = grid.direction ?? grid.dir ?? grid.orientation;
  if (direction) {
    const dir = String(direction).toLowerCase();
    if (dir === 'h' || dir === 'horizontal') return { ...grid, h: true };
    if (dir === 'v' || dir === 'vertical') return { ...grid, v: true };
  }
  return null;
}

function normalizeLaserGrids(laserGrids, levelName) {
  const grids = Array.isArray(laserGrids) ? laserGrids : [];
  const normalized = [];
  grids.forEach((grid, idx) => {
    const cleaned = normalizeLaserGrid(grid);
    if (cleaned) {
      normalized.push(cleaned);
    } else {
      console.warn(`[LevelValidation] ${levelName ?? 'Unknown'}: laserGrids[${idx}] missing direction or invalid; skipping.`);
    }
  });
  return normalized;
}

// Generate the actual level objects with objective placement validation
const LEVEL_LAYOUTS = RAW_LEVEL_LAYOUTS.map(raw => {
  const level = {
    ...DEFAULT_LEVEL,
    ...raw,
    obstacles: raw.obstacles || [],
    cameras: raw.cameras || [],
    motionSensors: raw.motionSensors || [],
    laserGrids: normalizeLaserGrids(raw.laserGrids, raw.name),
    guardPatrol: raw.guardPatrol || [],
    patrolDrones: raw.patrolDrones || []
  };

  // Validate and apply fallbacks for critical objectives
  level.playerStart = validateObjectivePlacement(level, 'playerStart', level.obstacles);
  level.exitZone = validateObjectivePlacement(level, 'exitZone', level.obstacles);
  level.dataCore = validateObjectivePlacement(level, 'dataCore', level.obstacles);
  level.keyCard = validateObjectivePlacement(level, 'keyCard', level.obstacles);
  level.hackTerminal = validateObjectivePlacement(level, 'hackTerminal', level.obstacles);

  if (level.relayTerminal) {
    level.relayTerminal = validateObjectivePlacement(level, 'relayTerminal', level.obstacles);
  }

  // Validate patrol points to prevent stuck scenarios
  level.guardPatrol = validatePatrolPoints(level, level.obstacles);

  return level;
});

// Validation helper functions
function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPoint(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function validatePointArray(levelIndex, field, points, errors) {
  if (!Array.isArray(points)) {
    errors.push(`Level ${levelIndex + 1}: ${field} must be an array.`);
    return;
  }
  for (const [idx, point] of points.entries()) {
    if (!isPoint(point)) {
      errors.push(`Level ${levelIndex + 1}: ${field}[${idx}] must be {x,y}.`);
    }
  }
}

function validateLevelLayouts(levels) {
  const errors = [];
  if (!Array.isArray(levels) || levels.length === 0) {
    errors.push('Level layouts must be a non-empty array.');
    return { ok: false, errors };
  }

  levels.forEach((level, index) => {
    if (!level || typeof level !== 'object') {
      errors.push(`Level ${index + 1}: level config must be an object.`);
      return;
    }

    if (!level.name || typeof level.name !== 'string') {
      errors.push(`Level ${index + 1}: name must be a string.`);
    }

    validatePointArray(index, 'obstacles', level.obstacles, errors);
    validatePointArray(index, 'guardPatrol', level.guardPatrol, errors);
    validatePointArray(index, 'cameras', level.cameras, errors);
    validatePointArray(index, 'motionSensors', level.motionSensors, errors);
    validatePointArray(index, 'laserGrids', level.laserGrids, errors);

    if (!level.guardPatrol || level.guardPatrol.length === 0) {
      errors.push(`Level ${index + 1}: guardPatrol must have at least 1 point.`);
    }

    if (!isPoint(level.dataCore)) errors.push(`Level ${index + 1}: dataCore must be {x,y}.`);
    if (!isPoint(level.keyCard)) errors.push(`Level ${index + 1}: keyCard must be {x,y}.`);
    if (!isPoint(level.hackTerminal)) errors.push(`Level ${index + 1}: hackTerminal must be {x,y}.`);
    if (!isPoint(level.playerStart)) errors.push(`Level ${index + 1}: playerStart must be {x,y}.`);
    if (!isPoint(level.exitZone)) errors.push(`Level ${index + 1}: exitZone must be {x,y}.`);

    if (level.securityCode && !isPoint(level.securityCode)) {
      errors.push(`Level ${index + 1}: securityCode must be {x,y} when set.`);
    }
    if (level.powerCell && !isPoint(level.powerCell)) {
      errors.push(`Level ${index + 1}: powerCell must be {x,y} when set.`);
    }

    if (typeof level.difficulty !== 'number' || Number.isNaN(level.difficulty)) {
      errors.push(`Level ${index + 1}: difficulty must be a number.`);
    }

    if (level.patrolDrones && Array.isArray(level.patrolDrones)) {
      level.patrolDrones.forEach((drone, idx) => {
        if (!isPoint(drone)) {
          errors.push(`Level ${index + 1}: patrolDrones[${idx}] must include x/y.`);
        }
        if (!Array.isArray(drone.patrol) || drone.patrol.length === 0) {
          errors.push(`Level ${index + 1}: patrolDrones[${idx}].patrol must be a non-empty array.`);
          return;
        }
        drone.patrol.forEach((point, pIdx) => {
          if (!isPoint(point)) {
            errors.push(`Level ${index + 1}: patrolDrones[${idx}].patrol[${pIdx}] must be {x,y}.`);
          }
        });
      });
    }
  });

  return { ok: errors.length === 0, errors };
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LEVEL_LAYOUTS,
    DEFAULT_LEVEL,
    validateLevelLayouts,
    getPlacementFailures,
    clearPlacementFailures
  };
}

export { LEVEL_LAYOUTS, DEFAULT_LEVEL, validateLevelLayouts };
