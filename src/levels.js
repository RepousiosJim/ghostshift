// ==================== LEVEL LAYOUTS ====================
// Phase 15: Rooms-and-Corridors Architecture Refactor
// - All levels redesigned with clear room structures
// - Objectives placed in room interiors (not corridors)
// - Corridors are 2-3 tiles wide for clear traversal
// - Patrol routes follow corridors, check room entrances
// - Multiple routes between objectives for stealth flow

const DEFAULT_LEVEL = {
  name: 'Unnamed',
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

// Map dimensions
const MAP_WIDTH = 22;
const MAP_HEIGHT = 18;

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
  // Level 1: Warehouse V2 - 22x18 map (Relayout 2026-02-24)
  // IMPROVEMENTS: Separated objectives, de-stacked vision cones, 2 staging pockets,
  // tactical laser choices, clear room/corridor distinction
  // Rooms: Spawn Room, Security Office (keycard), Server Room (terminal),
  //        Main Warehouse (staging), Data Core Chamber, Exit Room
  {
    name: 'Warehouse',
    obstacles: mergeObstacles(
      // === DISTINCT ROOMS WITH SEPARATED OBJECTIVES ===
      
      // 1. Spawn Room (bottom-left, 4x4) - player entry point
      createRoomWalls(1, 14, 4, 4, {topDoor: {offset: 1, width: 2}}),

      // 2. Security Office (top-left, 4x4) - KEYCARD location (distinct room)
      // Positioned far from other objectives for clear separation
      createRoomWalls(1, 1, 4, 4, {
        bottomDoor: {offset: 1, width: 2}
      }),

      // 3. Server Room (center-left, 4x4) - TERMINAL location (distinct room)
      // Separate from keycard and datacore
      createRoomWalls(5, 5, 4, 4, {
        leftDoor: {offset: 1, width: 2},
        bottomDoor: {offset: 1, width: 2}
      }),

      // 4. Main Warehouse (center, 6x5) - STAGING AREA (no objectives)
      // Pure traversal zone for timing and stealth planning
      createRoomWalls(9, 6, 6, 5, {
        leftDoor: {offset: 2, width: 2},
        rightDoor: {offset: 2, width: 2}
      }),
      // Light cover crates (not blocking paths)
      [{x: 11, y: 8}, {x: 12, y: 8}],

      // 5. Data Core Chamber (top-right, 4x4) - DATACORE location (distinct room)
      // Final objective, clearly separated from others
      createRoomWalls(17, 1, 4, 4, {
        bottomDoor: {offset: 1, width: 2}
      }),

      // 6. Exit Room (right side, 3x4) - extraction point
      createRoomWalls(19, 12, 3, 4, {leftDoor: {offset: 1, width: 1}}),

      // === CORRIDORS (2-3 tiles wide for clear traversal) ===
      
      // Horizontal main corridor (y=11-13)
      // Top wall with gaps for room entrances and exit path
      [{x: 5, y: 11}, {x: 6, y: 11}, {x: 7, y: 11},
       {x: 13, y: 11}, {x: 14, y: 11},
       {x: 16, y: 11}, {x: 17, y: 11}],
      // Bottom wall with gap for exit room entrance (x=18)
      [{x: 5, y: 13}, {x: 6, y: 13}, {x: 7, y: 13},
       {x: 13, y: 13}, {x: 14, y: 13},
       {x: 16, y: 13}, {x: 17, y: 13}],

      // Vertical corridor to Data Core (x=15-16, y=5-10)
      [{x: 15, y: 5}, {x: 15, y: 6}, {x: 15, y: 7}, {x: 15, y: 8}, {x: 15, y: 9}, {x: 15, y: 10}],
      [{x: 17, y: 5}, {x: 17, y: 6}, {x: 17, y: 7}, {x: 17, y: 8}, {x: 17, y: 9}, {x: 17, y: 10}],

      // Vertical corridor to Security Office (left side, x=5, y=5-10)
      [{x: 5, y: 5}, {x: 5, y: 6}, {x: 5, y: 7}, {x: 5, y: 8}, {x: 5, y: 9}, {x: 5, y: 10}],
      
      // === STAGING POCKET WALLS (create safe alcoves) ===
      // Pocket 1: Bottom corridor alcove (x=6-7, y=14-15)
      [{x: 6, y: 14}, {x: 8, y: 14}],
      
      // Pocket 2: Upper corridor niche (x=10-12, y=4)
      [{x: 10, y: 4}, {x: 11, y: 4}, {x: 12, y: 4}, {x: 13, y: 4}, {x: 14, y: 4}]
    ),

    // === DE-STACKED PATROL (no unfair crossfire overlap) ===
    // Simplified route that doesn't cluster near objectives
    guardPatrol: [
      {x: 7, y: 12},    // Main corridor (avoiding spawn)
      {x: 16, y: 12},   // Corridor right (near exit approach)
      {x: 16, y: 7},    // Vertical corridor mid-point
      {x: 8, y: 7}      // Check server room entrance area
    ],

    // === OBJECTIVES IN DISTINCT ROOMS ===
    playerStart: {x: 2, y: 16},       // Spawn room (centered)
    keyCard: {x: 3, y: 2},            // Security Office (top-left room)
    hackTerminal: {x: 7, y: 7},       // Server Room (center-left room)
    dataCore: {x: 18, y: 2},          // Data Core Chamber (top-right room)
    exitZone: {x: 20, y: 13},         // Exit room (right side)

    // === REPOSITIONED SENSORS (avoid objective clustering) ===
    // Cameras watch corridors, not objective rooms
    cameras: [{x: 8, y: 12}, {x: 16, y: 6}],
    // Motion sensor at warehouse entrance (tactical awareness)
    motionSensors: [{x: 12, y: 9}],
    
    // === TACTICAL LASER CHOICES (not hard tax lanes) ===
    // Two lasers create meaningful route choices:
    // - Upper route avoids both but is longer
    // - Lower route faster but must time both lasers
    laserGrids: [
      {x: 8, y: 5, v: true},   // Blocks direct path to terminal (vertical)
      {x: 14, y: 7, h: true}   // Blocks direct path to data core (horizontal)
    ],

    difficulty: 1
  },

  // Level 2: Labs - 22x18 map
  // Rooms: Spawn, Equipment Lab, Server Room, Exit
  {
    name: 'Labs',
    obstacles: mergeObstacles(
      // Spawn Room (bottom-left, 4x4)
      createRoomWalls(1, 13, 4, 4, {topDoor: {offset: 1, width: 2}}),
      
      // Equipment Lab (left, 5x5) with keyCard
      createRoomWalls(1, 6, 5, 5, {
        bottomDoor: {offset: 2, width: 2},
        rightDoor: {offset: 2, width: 2}
      }),
      
      // Server Room (center-right, 6x5) with dataCore
      createRoomWalls(12, 5, 6, 5, {
        leftDoor: {offset: 2, width: 2},
        bottomDoor: {offset: 2, width: 2}
      }),
      
      // Exit Room (top-right, 3x3)
      createRoomWalls(19, 1, 3, 3, {leftDoor: {offset: 1, width: 1}}),
      
      // Horizontal corridor (main east-west)
      [{x: 5, y: 11}, {x: 6, y: 11}, {x: 7, y: 11}, {x: 8, y: 11}, {x: 9, y: 11},
       {x: 10, y: 11}, {x: 11, y: 11}, {x: 18, y: 11}, {x: 19, y: 11}],
      [{x: 5, y: 13}, {x: 6, y: 13}, {x: 7, y: 13}, {x: 8, y: 13}, {x: 9, y: 13},
       {x: 10, y: 13}, {x: 11, y: 13}, {x: 18, y: 13}, {x: 19, y: 13}],
      
      // Vertical corridor (connecting to exit)
      [{x: 19, y: 4}, {x: 19, y: 5}, {x: 19, y: 6}, {x: 19, y: 7}, {x: 19, y: 8}, {x: 19, y: 9}, {x: 19, y: 10}],
      [{x: 21, y: 4}, {x: 21, y: 5}, {x: 21, y: 6}, {x: 21, y: 7}, {x: 21, y: 8}, {x: 21, y: 9}, {x: 21, y: 10}]
    ),
    
    guardPatrol: [
      {x: 5, y: 12},   // Corridor left
      {x: 18, y: 12},  // Corridor right
      {x: 18, y: 7},   // Check server room
      {x: 5, y: 7}     // Check lab room
    ],
    
    playerStart: {x: 2, y: 15},
    keyCard: {x: 3, y: 8},           // Equipment Lab (centered)
    dataCore: {x: 15, y: 7},         // Server Room
    hackTerminal: {x: 7, y: 8},      // Corridor junction (clear)
    exitZone: {x: 20, y: 2},         // Exit room center

    cameras: [{x: 7, y: 12}, {x: 16, y: 7}],
    motionSensors: [{x: 14, y: 7}],
    laserGrids: [{x: 11, y: 8, v: true}],

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
