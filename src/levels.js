// ==================== LEVEL LAYOUTS ====================
// Phase 4: Added Vault and Training Facility levels with improved balancing
// Phase 11: Added Comms Tower (D2) bridge level with relay-hack variant
// Phase 12: Added Penthouse (Level 7) with timed alarm mechanic

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

const RAW_LEVEL_LAYOUTS = [
  { name: 'Warehouse', obstacles: [{x:8,y:4},{x:9,y:4},{x:10,y:4},{x:8,y:5},{x:10,y:5},{x:8,y:6},{x:10,y:6},{x:3,y:10},{x:4,y:10},{x:14,y:8},{x:15,y:8},{x:12,y:3},{x:13,y:3},{x:6,y:8},{x:7,y:8}], guardPatrol:[{x:15,y:7},{x:5,y:7},{x:5,y:12},{x:15,y:12}], dataCore:{x:16,y:3}, keyCard:{x:3,y:12}, hackTerminal:{x:10,y:7}, playerStart:{x:2,y:2}, exitZone:{x:19,y:7}, cameras:[{x:5,y:2},{x:15,y:12}], motionSensors:[{x:8,y:7},{x:12,y:10}], laserGrids:[{x:10,y:9,h:true},{x:6,y:3,v:true}], patrolDrones:[{x:12,y:6,patrol:[{x:12,y:6},{x:16,y:6},{x:16,y:10},{x:12,y:10}]}], securityCode:{x:4,y:8}, powerCell:{x:14,y:4}, difficulty: 1 },
  { name: 'Labs', obstacles: [{x:5,y:3},{x:5,y:4},{x:5,y:5},{x:5,y:6},{x:10,y:8},{x:11,y:8},{x:12,y:8},{x:10,y:9},{x:12,y:9},{x:10,y:10},{x:11,y:10},{x:12,y:10},{x:15,y:3},{x:16,y:3},{x:17,y:3},{x:3,y:11},{x:4,y:11},{x:5,y:11},{x:8,y:13},{x:9,y:13}], guardPatrol:[{x:14,y:5},{x:6,y:5},{x:6,y:13},{x:14,y:13}], dataCore:{x:17,y:2}, keyCard:{x:2,y:3}, hackTerminal:{x:8,y:5}, playerStart:{x:2,y:13}, exitZone:{x:19,y:3}, cameras:[{x:10,y:2},{x:3,y:8}], motionSensors:[{x:12,y:6},{x:7,y:11}], laserGrids:[{x:8,y:7,h:true},{x:14,y:9,v:true}], patrolDrones:[{x:10,y:10,patrol:[{x:10,y:10},{x:14,y:10},{x:14,y:4},{x:10,y:4}]}], securityCode:{x:6,y:2}, powerCell:{x:16,y:12}, difficulty: 1 },
  { name: 'Server Farm', obstacles: [{x:4,y:3},{x:5,y:3},{x:9,y:3},{x:10,y:3},{x:4,y:5},{x:10,y:5},{x:4,y:7},{x:5,y:7},{x:9,y:7},{x:10,y:7},{x:7,y:9},{x:8,y:9},{x:3,y:11},{x:7,y:11},{x:12,y:11},{x:16,y:11},{x:3,y:13},{x:4,y:13},{x:15,y:13},{x:16,y:13}], guardPatrol:[{x:2,y:9},{x:18,y:9},{x:18,y:5},{x:2,y:5}], dataCore:{x:18,y:13}, keyCard:{x:7,y:3}, hackTerminal:{x:14,y:9}, playerStart:{x:2,y:2}, exitZone:{x:19,y:7}, cameras:[{x:2,y:5},{x:17,y:11}], motionSensors:[{x:7,y:7},{x:12,y:5}], laserGrids:[{x:6,y:5,v:true},{x:12,y:9,h:true}], patrolDrones:[{x:8,y:6,patrol:[{x:8,y:6},{x:14,y:6},{x:14,y:12},{x:8,y:12}]}], securityCode:{x:2,y:12}, powerCell:{x:18,y:3}, difficulty: 2 },
  // Phase 11: New Level 4 - Comms Tower (D2 bridge with relay-hack variant)
  // Two terminals must be hacked in sequence; dense drone corridor in center
  { name: 'Comms Tower', obstacles: [
      // Upper antenna array (top-left cluster)
      {x:3,y:2},{x:4,y:2},{x:5,y:2},{x:3,y:3},{x:5,y:3},
      // Central server rack corridor walls
      {x:7,y:4},{x:8,y:4},{x:7,y:5},{x:8,y:5},
      {x:7,y:7},{x:8,y:7},{x:7,y:8},{x:8,y:8},
      // Right-side comms room
      {x:12,y:3},{x:13,y:3},{x:14,y:3},{x:12,y:4},{x:14,y:4},
      // Lower equipment bays
      {x:3,y:8},{x:4,y:8},{x:3,y:9},{x:4,y:9},
      {x:12,y:9},{x:13,y:9},{x:14,y:9}
    ],
    guardPatrol: [
      {x:6,y:3},{x:10,y:3},{x:10,y:9},{x:6,y:9}
    ],
    dataCore:{x:13,y:7},
    keyCard:{x:4,y:10},
    hackTerminal:{x:4,y:4},
    relayTerminal:{x:13,y:5},
    playerStart:{x:2,y:6},
    exitZone:{x:15,y:7},
    cameras:[
      {x:6,y:2},{x:10,y:10},{x:14,y:6}
    ],
    motionSensors:[
      {x:9,y:6},{x:5,y:7}
    ],
    laserGrids:[
      {x:6,y:6,h:true},{x:10,y:6,h:true}
    ],
    patrolDrones:[
      {x:9,y:4,patrol:[{x:9,y:4},{x:9,y:8},{x:6,y:8},{x:6,y:4}]},
      {x:11,y:5,patrol:[{x:11,y:5},{x:11,y:9},{x:14,y:9},{x:14,y:5}]}
    ],
    securityCode:{x:14,y:10},
    powerCell:{x:2,y:2},
    difficulty: 2
  },
  // Phase 4: New Level 4 - The Vault (high security bank vault)
  { name: 'The Vault', obstacles: [
      {x:4,y:3},{x:5,y:3},{x:6,y:3},{x:10,y:3},{x:11,y:3},{x:12,y:3},
      {x:4,y:5},{x:12,y:5},{x:4,y:7},{x:12,y:7},
      {x:4,y:9},{x:5,y:9},{x:6,y:9},{x:10,y:9},{x:11,y:9},{x:12,y:9},
      {x:4,y:11},{x:12,y:11},{x:7,y:12},{x:8,y:12}
    ], 
    guardPatrol: [
      {x:7,y:4},{x:10,y:4},{x:10,y:8},{x:7,y:8},
      {x:2,y:6},{x:17,y:6}
    ], 
    dataCore:{x:8,y:2}, 
    keyCard:{x:2,y:13}, 
    hackTerminal:{x:15,y:6}, 
    playerStart:{x:2,y:2}, 
    exitZone:{x:18,y:7}, 
    cameras:[
      {x:8,y:1},{x:2,y:10},{x:16,y:10}
    ], 
    motionSensors:[
      {x:8,y:6},{x:14,y:4},{x:5,y:10}
    ], 
    laserGrids:[
      {x:8,y:4,h:true},{x:3,y:6,v:true},{x:13,y:6,v:true},{x:8,y:10,h:true}
    ], 
    patrolDrones:[
      {x:5,y:7,patrol:[{x:5,y:7},{x:11,y:7},{x:11,y:5},{x:5,y:5}]},
      {x:15,y:9,patrol:[{x:15,y:9},{x:15,y:3},{x:18,y:3},{x:18,y:9}]}
    ], 
    securityCode:{x:6,y:13}, 
    powerCell:{x:16,y:12}, 
    difficulty: 3 
  },
  // Phase 4: New Level 5 - Training Facility (open area with multiple threats)
  { name: 'Training Facility', obstacles: [
      {x:6,y:3},{x:7,y:3},{x:13,y:3},{x:14,y:3},
      {x:3,y:6},{x:4,y:6},{x:16,y:6},{x:17,y:6},
      {x:6,y:9},{x:7,y:9},{x:13,y:9},{x:14,y:9},
      {x:6,y:12},{x:7,y:12},{x:13,y:12},{x:14,y:12},
      {x:9,y:5},{x:10,y:5},{x:9,y:10},{x:10,y:10}
    ], 
    guardPatrol: [
      {x:2,y:4},{x:18,y:4},
      {x:2,y:11},{x:18,y:11},
      {x:10,y:2},{x:10,y:13}
    ], 
    dataCore:{x:10,y:7}, 
    keyCard:{x:2,y:13}, 
    hackTerminal:{x:17,y:7}, 
    playerStart:{x:2,y:2}, 
    exitZone:{x:18,y:2}, 
    cameras:[
      {x:5,y:2},{x:15,y:2},{x:5,y:13},{x:15,y:13}
    ], 
    motionSensors:[
      {x:10,y:4},{x:10,y:10},{x:5,y:8},{x:15,y:8}
    ], 
    laserGrids:[
      {x:10,y:3,v:true},{x:10,y:12,v:true},{x:4,y:8,h:true},{x:16,y:8,h:true}
    ], 
    patrolDrones:[
      {x:8,y:4,patrol:[{x:8,y:4},{x:12,y:4},{x:12,y:11},{x:8,y:11}]},
      {x:5,y:7,patrol:[{x:5,y:7},{x:5,y:10},{x:8,y:10},{x:8,y:7}]},
      {x:15,y:7,patrol:[{x:15,y:7},{x:15,y:10},{x:12,y:10},{x:12,y:7}]}
    ], 
    securityCode:{x:3,y:4}, 
    powerCell:{x:17,y:12}, 
    difficulty: 3 
  },
  // Phase 12: New Level 7 - Penthouse (timed alarm mechanic)
  // Alarm triggers after 45 seconds, boosting guard speed and triggering alarm state
  { name: 'Penthouse', obstacles: [
      // Luxury suite furniture clusters
      {x:4,y:3},{x:5,y:3},{x:6,y:3},
      {x:4,y:5},{x:6,y:5},
      {x:4,y:7},{x:5,y:7},{x:6,y:7},
      // Central corridor pillars
      {x:9,y:4},{x:10,y:4},{x:9,y:5},{x:10,y:5},
      {x:9,y:8},{x:10,y:8},{x:9,y:9},{x:10,y:9},
      // Right-side office complex
      {x:13,y:3},{x:14,y:3},{x:15,y:3},
      {x:13,y:5},{x:15,y:5},
      {x:13,y:7},{x:14,y:7},{x:15,y:7},
      // Lower lounge area
      {x:3,y:10},{x:4,y:10},{x:5,y:10},
      {x:13,y:10},{x:14,y:10},{x:15,y:10},
      // VIP exit corridor
      {x:17,y:6},{x:18,y:6},{x:17,y:7},{x:18,y:7}
    ], 
    guardPatrol: [
      {x:2,y:5},{x:7,y:5},{x:7,y:9},{x:2,y:9},
      {x:12,y:5},{x:17,y:5},{x:17,y:9},{x:12,y:9},
      {x:10,y:2},{x:10,y:12}
    ], 
    dataCore:{x:18,y:3}, 
    keyCard:{x:2,y:12}, 
    hackTerminal:{x:15,y:6}, 
    playerStart:{x:2,y:2}, 
    exitZone:{x:19,y:7}, 
    cameras:[
      {x:5,y:2},{x:15,y:2},{x:5,y:11},{x:15,y:11},{x:10,y:7}
    ], 
    motionSensors:[
      {x:8,y:6},{x:12,y:6},{x:10,y:4},{x:10,y:10}
    ], 
    laserGrids:[
      {x:8,y:3,h:true},{x:12,y:3,h:true},
      {x:8,y:11,h:true},{x:12,y:11,h:true}
    ], 
    patrolDrones:[
      {x:8,y:6,patrol:[{x:8,y:6},{x:12,y:6},{x:12,y:8},{x:8,y:8}]},
      {x:11,y:6,patrol:[{x:11,y:6},{x:11,y:8},{x:8,y:8},{x:8,y:6}]},
      {x:5,y:9,patrol:[{x:5,y:9},{x:7,y:9},{x:7,y:7},{x:5,y:7}]},
      {x:14,y:9,patrol:[{x:14,y:9},{x:16,y:9},{x:16,y:7},{x:14,y:7}]}
    ], 
    securityCode:{x:4,y:12}, 
    powerCell:{x:18,y:11}, 
    difficulty: 3,
    alarmTimer: 45  // Alarm triggers after 45 seconds
  }
];

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeLevelConfig(level) {
  return {
    ...DEFAULT_LEVEL,
    ...level,
    obstacles: ensureArray(level.obstacles),
    guardPatrol: ensureArray(level.guardPatrol),
    cameras: ensureArray(level.cameras),
    motionSensors: ensureArray(level.motionSensors),
    laserGrids: ensureArray(level.laserGrids),
    patrolDrones: ensureArray(level.patrolDrones)
  };
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

export function validateLevelLayouts(levels) {
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

export const LEVEL_LAYOUTS = RAW_LEVEL_LAYOUTS.map(normalizeLevelConfig);
