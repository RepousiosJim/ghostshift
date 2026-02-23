// ==================== LEVEL LAYOUTS ====================
// Phase 4: Added Vault and Training Facility levels with improved balancing
// Phase 11: Added Comms Tower (D2) bridge level with relay-hack variant
// Phase 12: Added Penthouse (Level 7) with timed alarm mechanic
// Phase 14: Expanded all maps by +6 tiles (width and height) - new dimensions 22x18

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
  alarmTimer: null  // Seconds until alarm triggers (null = no alarm)
};

// Helper function - no shift (coordinates already valid for 19x15 map)
// Preserve extra properties (e.g., laser grid direction flags)
function shiftBy6(point) {
  if (!point) return point;
  return { ...point, x: point.x, y: point.y };
}

// Helper function - no shift
function shiftArray6(arr) {
  return arr.map(shiftBy6);
}

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

// Level layouts - all coordinates shifted by +6 for expanded 22x18 maps
// Base coordinates designed to fit within 22x18 after +6 shift (max x=15, max y=11)
const RAW_LEVEL_LAYOUTS = [
  // Level 1: Warehouse - 22x18 map
  {
    name: 'Warehouse',
    obstacles: shiftArray6([
      // West storage racks
      {x:2,y:3},{x:3,y:3},{x:2,y:4},{x:3,y:4},{x:2,y:5},{x:3,y:5},{x:2,y:6},{x:3,y:6},
      {x:2,y:10},{x:3,y:10},{x:2,y:11},{x:3,y:11},{x:2,y:12},{x:3,y:12},
      {x:5,y:4},{x:5,y:5},{x:5,y:10},{x:5,y:11},
      // Central container stacks
      {x:8,y:5},{x:9,y:5},{x:8,y:6},{x:9,y:6},
      {x:8,y:9},{x:9,y:9},{x:8,y:10},{x:9,y:10},
      {x:11,y:7},{x:12,y:7},{x:11,y:8},{x:12,y:8},
      {x:11,y:11},{x:12,y:11},{x:11,y:12},{x:12,y:12},
      // East office enclosure (door gap at x=16,y:4)
      {x:15,y:2},{x:16,y:2},{x:17,y:2},
      {x:15,y:3},{x:17,y:3},
      {x:15,y:4},{x:17,y:4},
      {x:15,y:5},{x:17,y:5},
      {x:15,y:6},{x:16,y:6},{x:17,y:6},
      // Loading bay barricades
      {x:13,y:14},{x:17,y:14},{x:13,y:15},{x:17,y:15},
      // Upper-right crates
      {x:19,y:5},{x:19,y:6}
    ]),
    guardPatrol: shiftArray6([
      {x:5,y:7},{x:14,y:7},{x:14,y:12},{x:5,y:12}
    ]),
    dataCore: shiftBy6({x:16,y:4}),
    keyCard: shiftBy6({x:4,y:11}),
    hackTerminal: shiftBy6({x:11,y:9}),
    playerStart: shiftBy6({x:2,y:14}),
    exitZone: shiftBy6({x:20,y:2}),
    cameras: shiftArray6([{x:6,y:2},{x:18,y:10}]),
    motionSensors: shiftArray6([{x:10,y:14}]),
    laserGrids: shiftArray6([{x:12,y:5,h:true},{x:14,y:9,v:true}]),
    patrolDrones: [
      {x:18,y:11,patrol:shiftArray6([{x:14,y:9},{x:18,y:9},{x:18,y:14},{x:14,y:14}])}
    ],
    securityCode: shiftBy6({x:6,y:4}),
    powerCell: shiftBy6({x:18,y:14}),
    difficulty: 1
  },

// Level 2: Labs - 22x18 map
  { name: 'Labs', obstacles: shiftArray6([
      // Lab equipment rows (left side)
      {x:4,y:2},{x:4,y:3},{x:4,y:4},
      // Central work area
      {x:7,y:6},{x:8,y:6},{x:9,y:6},
      {x:7,y:7},{x:9,y:7},
      {x:7,y:8},{x:9,y:8},
      // Right-side storage
      {x:12,y:2},{x:13,y:2},
      // Lower corridor
      {x:2,y:9},{x:3,y:9},{x:4,y:9},
      {x:6,y:11},{x:7,y:11}
    ]),
    guardPatrol:shiftArray6([{x:11,y:4},{x:5,y:4},{x:5,y:11},{x:11,y:11}]),
    dataCore:shiftBy6({x:14,y:3}), keyCard:shiftBy6({x:2,y:2}), hackTerminal:shiftBy6({x:6,y:4}), playerStart:shiftBy6({x:2,y:11}), exitZone:shiftBy6({x:15,y:2}), cameras:shiftArray6([{x:7,y:2},{x:2,y:6},{x:12,y:11}]), motionSensors:shiftArray6([{x:9,y:4},{x:5,y:9}]), laserGrids:shiftArray6([{x:6,y:5,h:true},{x:11,y:7,v:true}]), patrolDrones:[{x:7+6,y:5+6,patrol:shiftArray6([{x:7,y:5},{x:11,y:5},{x:11,y:3},{x:7,y:3}])}], securityCode:shiftBy6({x:5,y:2}), powerCell:shiftBy6({x:13,y:10}), difficulty: 1 },
  
  // Level 3: Server Farm - 22x18 map
  { name: 'Server Farm', obstacles: shiftArray6([{x:3,y:2},{x:4,y:2},{x:7,y:2},{x:8,y:2},{x:3,y:4},{x:8,y:4},{x:3,y:6},{x:4,y:6},{x:7,y:6},{x:8,y:6},{x:5,y:8},{x:6,y:8},{x:3,y:10},{x:5,y:10},{x:9,y:10},{x:13,y:10},{x:2,y:11},{x:3,y:11}]), guardPatrol:shiftArray6([{x:2,y:8},{x:15,y:8},{x:15,y:4},{x:2,y:4}]), dataCore:shiftBy6({x:15,y:11}), keyCard:shiftBy6({x:5,y:2}), hackTerminal:shiftBy6({x:11,y:8}), playerStart:shiftBy6({x:2,y:2}), exitZone:shiftBy6({x:15,y:6}), cameras:shiftArray6([{x:2,y:4},{x:14,y:10},{x:8,y:2}]), motionSensors:shiftArray6([{x:5,y:6},{x:9,y:4}]), laserGrids:shiftArray6([{x:4,y:4,v:true},{x:9,y:8,h:true}]), patrolDrones:[{x:6+6,y:5+6,patrol:shiftArray6([{x:6,y:5},{x:11,y:5},{x:11,y:10},{x:6,y:10}])}], securityCode:shiftBy6({x:1,y:10}), powerCell:shiftBy6({x:15,y:2}), difficulty: 2 },
  
  // Level 4: Comms Tower - 22x18 map
  // Two terminals must be hacked in sequence; dense drone corridor in center
  { name: 'Comms Tower', obstacles: shiftArray6([
      // Upper antenna array (top-left cluster) - expanded
      {x:2,y:1},{x:3,y:1},{x:4,y:1},{x:2,y:2},{x:4,y:2},
      // Central corridor walls - denser
      {x:5,y:3},{x:6,y:3},{x:5,y:4},{x:6,y:4},
      {x:5,y:5},{x:6,y:5},{x:5,y:6},{x:6,y:6},
      // Right-side comms room - expanded further right
      {x:9,y:2},{x:10,y:2},{x:11,y:2},{x:12,y:2},{x:9,y:3},{x:11,y:3},{x:12,y:3},
      // Lower equipment bays - expanded 
      {x:2,y:6},{x:3,y:6},{x:2,y:7},{x:3,y:7},
      {x:9,y:7},{x:10,y:7},{x:11,y:7},{x:12,y:7},
      // Bottom row extensions
      {x:2,y:9},{x:3,y:9},{x:9,y:9},{x:10,y:9}
    ]),
    guardPatrol: shiftArray6([
      {x:4,y:3},{x:8,y:3},{x:8,y:8},{x:4,y:8}
    ]),
    dataCore:shiftBy6({x:12,y:5}),
    keyCard:shiftBy6({x:3,y:10}),
    hackTerminal:shiftBy6({x:3,y:3}),
    relayTerminal:shiftBy6({x:12,y:4}),
    playerStart:shiftBy6({x:2,y:5}),
    exitZone:shiftBy6({x:14,y:5}),
    cameras:shiftArray6([
      {x:4,y:1},{x:10,y:10},{x:12,y:5}
    ]),
    motionSensors:shiftArray6([
      {x:7,y:5},{x:4,y:8},{x:10,y:8}
    ]),
    laserGrids:shiftArray6([
      {x:4,y:5,h:true},{x:10,y:5,v:true}
    ]),
    patrolDrones:[
      {x:7+6,y:4+6,patrol:shiftArray6([{x:7,y:4},{x:7,y:8},{x:4,y:8},{x:4,y:4}])},
      {x:9+6,y:8+6,patrol:shiftArray6([{x:9,y:8},{x:9,y:10},{x:13,y:10},{x:13,y:8}])}
    ],
    securityCode:shiftBy6({x:11,y:10}),
    powerCell:shiftBy6({x:1,y:1}),
    difficulty: 2
  },
  
  // Level 5: The Vault - 22x18 map
  // High security bank vault
  { name: 'The Vault', obstacles: shiftArray6([
      {x:3,y:2},{x:4,y:2},{x:5,y:2},{x:8,y:2},{x:9,y:2},{x:10,y:2},
      {x:3,y:4},{x:10,y:4},{x:3,y:6},{x:10,y:6},
      {x:3,y:8},{x:4,y:8},{x:5,y:8},{x:8,y:8},{x:9,y:8},{x:10,y:8},
      {x:3,y:10},{x:10,y:10},{x:5,y:11}
    ]), 
    guardPatrol: shiftArray6([
      {x:5,y:3},{x:8,y:3},{x:8,y:7},{x:5,y:7},
      {x:2,y:5},{x:14,y:5}
    ]), 
    dataCore:shiftBy6({x:6,y:1}), 
    keyCard:shiftBy6({x:2,y:11}), 
    hackTerminal:shiftBy6({x:12,y:5}), 
    playerStart:shiftBy6({x:2,y:2}), 
    exitZone:shiftBy6({x:15,y:5}), 
    cameras:shiftArray6([
      {x:6,y:1},{x:2,y:9},{x:13,y:9}
    ]), 
    motionSensors:shiftArray6([
      {x:6,y:5},{x:11,y:3},{x:4,y:9}
    ]), 
    laserGrids:shiftArray6([
      {x:6,y:3,h:true},{x:2,y:5,v:true},{x:10,y:5,v:true},{x:6,y:9,h:true}
    ]), 
    patrolDrones:[
      {x:4+6,y:6+6,patrol:shiftArray6([{x:4,y:6},{x:9,y:6},{x:9,y:4},{x:4,y:4}])},
      {x:12+6,y:8+6,patrol:shiftArray6([{x:12,y:8},{x:12,y:2},{x:15,y:2},{x:15,y:8}])}
    ], 
    securityCode:shiftBy6({x:6,y:11}), 
    powerCell:shiftBy6({x:13,y:10}), 
    difficulty: 3 
  },
  
  // Level 6: Training Facility - 22x18 map
  // Open area with multiple threats
  { name: 'Training Facility', obstacles: shiftArray6([
      {x:4,y:2},{x:5,y:2},{x:10,y:2},{x:11,y:2},
      {x:2,y:5},{x:3,y:5},{x:13,y:5},{x:14,y:5},
      {x:4,y:8},{x:5,y:8},{x:10,y:8},{x:11,y:8},
      {x:4,y:11},{x:5,y:11},{x:10,y:11},{x:11,y:11},
      {x:7,y:4},{x:8,y:4}
    ]), 
    guardPatrol: shiftArray6([
      {x:2,y:3},{x:15,y:3},
      {x:2,y:10},{x:15,y:10},
      {x:8,y:1},{x:8,y:12}
    ]), 
    dataCore:shiftBy6({x:8,y:6}), 
    keyCard:shiftBy6({x:2,y:11}), 
    hackTerminal:shiftBy6({x:14,y:6}), 
    playerStart:shiftBy6({x:2,y:2}), 
    exitZone:shiftBy6({x:15,y:2}), 
    cameras:shiftArray6([
      {x:4,y:2},{x:12,y:2},{x:4,y:10},{x:12,y:10}
    ]), 
    motionSensors:shiftArray6([
      {x:8,y:3},{x:8,y:8},{x:4,y:7},{x:12,y:7}
    ]), 
    laserGrids:shiftArray6([
      {x:8,y:2,v:true},{x:8,y:11,v:true},{x:3,y:7,h:true},{x:13,y:7,h:true}
    ]), 
    patrolDrones:[
      {x:6+6,y:3+6,patrol:shiftArray6([{x:6,y:3},{x:10,y:3},{x:10,y:10},{x:6,y:10}])},
      {x:4+6,y:6+6,patrol:shiftArray6([{x:4,y:6},{x:4,y:7},{x:7,y:7},{x:7,y:6}])},
      {x:12+6,y:6+6,patrol:shiftArray6([{x:12,y:6},{x:12,y:8},{x:9,y:8},{x:9,y:6}])}
    ], 
    securityCode:shiftBy6({x:2,y:3}), 
    powerCell:shiftBy6({x:14,y:11}), 
    difficulty: 3 
  },
  
  // Level 7: Penthouse - 22x18 map
  // Alarm triggers after 45 seconds, boosting guard speed and triggering alarm state
  { name: 'Penthouse', obstacles: shiftArray6([
      // Luxury suite furniture clusters
      {x:3,y:2},{x:4,y:2},{x:5,y:2},
      {x:3,y:4},{x:5,y:4},
      {x:3,y:6},{x:4,y:6},{x:5,y:6},
      // Central corridor pillars
      {x:7,y:3},{x:8,y:3},{x:7,y:4},{x:8,y:4},
      {x:7,y:7},{x:8,y:7},{x:7,y:8},{x:8,y:8},
      // Right-side office complex
      {x:10,y:2},{x:11,y:2},{x:12,y:2},
      {x:10,y:4},{x:12,y:4},
      {x:10,y:6},{x:11,y:6},{x:12,y:6},
      // Lower lounge area
      {x:2,y:9},{x:3,y:9},{x:4,y:9},
      {x:10,y:9},{x:11,y:9},{x:12,y:9},
      // VIP exit corridor
      {x:14,y:5},{x:15,y:5}
    ]), 
    guardPatrol: shiftArray6([
      {x:2,y:4},{x:5,y:5},{x:5,y:8},{x:2,y:8},
      {x:9,y:4},{x:14,y:4},{x:14,y:8},{x:9,y:8},
      {x:8,y:1},{x:8,y:11}
    ]), 
    dataCore:shiftBy6({x:15,y:2}), 
    keyCard:shiftBy6({x:2,y:11}), 
    hackTerminal:shiftBy6({x:12,y:5}), 
    playerStart:shiftBy6({x:2,y:2}), 
    exitZone:shiftBy6({x:15,y:7}), 
    cameras:shiftArray6([
      {x:4,y:1},{x:12,y:1},{x:4,y:10},{x:12,y:10},{x:8,y:6}
    ]), 
    motionSensors:shiftArray6([
      {x:6,y:5},{x:10,y:5},{x:8,y:2},{x:8,y:9}
    ]), 
    laserGrids:shiftArray6([
      {x:6,y:2,h:true},{x:10,y:3,h:true},
      {x:6,y:10,h:true},{x:10,y:10,h:true}
    ]), 
    patrolDrones:[
      {x:6+6,y:5+6,patrol:shiftArray6([{x:6,y:5},{x:10,y:5},{x:10,y:7},{x:6,y:7}])},
      {x:9+6,y:5+6,patrol:shiftArray6([{x:9,y:5},{x:9,y:7},{x:6,y:7},{x:6,y:5}])},
      {x:4+6,y:8+6,patrol:shiftArray6([{x:4,y:8},{x:6,y:8},{x:6,y:5},{x:4,y:5}])},
      {x:11+6,y:8+6,patrol:shiftArray6([{x:11,y:8},{x:13,y:8},{x:13,y:5},{x:11,y:5}])}
    ], 
    securityCode:shiftBy6({x:3,y:11}), 
    powerCell:shiftBy6({x:15,y:10}), 
    difficulty: 3,
    alarmTimer: 45  // Alarm triggers after 45 seconds
  }
];

// ==================== LEVEL CONFIGURATION ====================

// Generate the actual level objects by applying transformations
const LEVEL_LAYOUTS = RAW_LEVEL_LAYOUTS.map(raw => {
  return {
    ...DEFAULT_LEVEL,
    ...raw,
    // Ensure obstacles is an array
    obstacles: raw.obstacles || [],
    // Ensure cameras is an array
    cameras: raw.cameras || [],
    // Ensure motionSensors is an array
    motionSensors: raw.motionSensors || [],
    // Ensure laserGrids is an array and normalize directions
    laserGrids: normalizeLaserGrids(raw.laserGrids, raw.name),
    // Ensure guardPatrol is an array
    guardPatrol: raw.guardPatrol || [],
    // Ensure patrolDrones is an array
    patrolDrones: raw.patrolDrones || []
  };
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LEVEL_LAYOUTS, DEFAULT_LEVEL, validateLevelLayouts };
}

// ES Module export
export { LEVEL_LAYOUTS, DEFAULT_LEVEL, validateLevelLayouts };

// Helper functions for validation
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
