/**
 * ObjectiveSpawner - Room-aware objective spawning system for GhostShift
 * 
 * Phase B: Objective placement system with room interior detection,
 * placement constraints, deterministic scoring, and validation.
 * 
 * @module tile/ObjectiveSpawner
 */

import { 
  TILE_TYPES, 
  isInBounds, 
  manhattanDistance,
  worldToTile,
  tileToWorld,
  MAP_WIDTH,
  MAP_HEIGHT
} from './TileGrid.js';

import { TileGrid } from './TileGrid.js';

// ==================== CONSTANTS ====================

/**
 * Objective types that can be spawned
 */
export const OBJECTIVE_TYPES = {
  DATA_CORE: 'dataCore',
  KEY_CARD: 'keyCard',
  HACK_TERMINAL: 'hackTerminal',
  RELAY_TERMINAL: 'relayTerminal',
  SECURITY_CODE: 'securityCode',
  POWER_CELL: 'powerCell'
};

/**
 * Required objectives that must be present in every level
 */
export const REQUIRED_OBJECTIVES = [
  OBJECTIVE_TYPES.DATA_CORE,
  OBJECTIVE_TYPES.KEY_CARD,
  OBJECTIVE_TYPES.HACK_TERMINAL
];

/**
 * Optional objectives that may or may not be present
 */
export const OPTIONAL_OBJECTIVES = [
  OBJECTIVE_TYPES.RELAY_TERMINAL,
  OBJECTIVE_TYPES.SECURITY_CODE,
  OBJECTIVE_TYPES.POWER_CELL
];

/**
 * Default placement constraints
 */
export const DEFAULT_CONSTRAINTS = {
  minWallClearance: 1,        // Minimum tiles from walls/obstacles
  minObjectiveSpacing: 3,     // Minimum tiles between objectives
  minGuardDistance: 2,        // Minimum tiles from guard spawn points
  minHazardDistance: 1,       // Minimum tiles from laser/sensor hazards
  minPlayerStartDistance: 3,  // Minimum tiles from player start
  minExitDistance: 2          // Minimum tiles from exit zone
};

/**
 * Scoring weights for spawn point selection
 */
export const SCORING_WEIGHTS = {
  roomInterior: 100,          // Must be in room interior
  wallClearance: 10,          // Bonus for wall clearance
  objectiveSpacing: 15,       // Bonus for spacing from other objectives
  guardAvoidance: 5,          // Bonus for distance from guards
  hazardAvoidance: 3,         // Bonus for distance from hazards
  accessibility: 20,          // Bonus for path accessibility
  centrality: 2               // Bonus for central position in room
};

// ==================== ROOM DETECTION ====================

/**
 * Detect room interiors from tile grid
 * Room interior = walkable tiles surrounded by walkable tiles (not adjacent to walls)
 * 
 * @param {TileGrid} grid - The tile grid
 * @returns {Set<string>} Set of "tx,ty" keys for room interior tiles
 */
export function detectRoomInteriors(grid) {
  const interiors = new Set();
  
  for (let ty = 1; ty < grid.height - 1; ty++) {
    for (let tx = 1; tx < grid.width - 1; tx++) {
      if (!grid.isWalkable(tx, ty)) continue;
      
      // Check if all 4 neighbors are also walkable (room interior)
      const neighbors = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
      ];
      
      let isInterior = true;
      for (const { dx, dy } of neighbors) {
        if (!grid.isWalkable(tx + dx, ty + dy)) {
          isInterior = false;
          break;
        }
      }
      
      if (isInterior) {
        interiors.add(`${tx},${ty}`);
      }
    }
  }
  
  return interiors;
}

/**
 * Check if a tile is a room interior tile
 * 
 * @param {TileGrid} grid - The tile grid
 * @param {number} tx - Tile X
 * @param {number} ty - Tile Y
 * @param {Set<string>} interiors - Pre-computed room interiors (optional)
 * @returns {boolean} True if tile is room interior
 */
export function isRoomInterior(grid, tx, ty, interiors = null) {
  if (!grid.isWalkable(tx, ty)) return false;
  
  const cache = interiors || detectRoomInteriors(grid);
  return cache.has(`${tx},${ty}`);
}

/**
 * Get all valid objective spawn tiles (room interior + constraints)
 * 
 * @param {TileGrid} grid - The tile grid
 * @param {Object} layout - Level layout
 * @param {Object} constraints - Placement constraints
 * @returns {Array<{tx: number, ty: number, score: number}>} Valid spawn tiles with scores
 */
export function getValidSpawnTiles(grid, layout, constraints = DEFAULT_CONSTRAINTS) {
  const interiors = detectRoomInteriors(grid);
  const validTiles = [];
  
  // Pre-compute forbidden positions
  const forbiddenPositions = getForbiddenPositions(layout, constraints);
  
  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      if (!grid.isWalkable(tx, ty)) continue;
      
      const key = `${tx},${ty}`;
      
      // Check room interior requirement
      if (!interiors.has(key)) continue;
      
      // Check forbidden positions
      if (forbiddenPositions.has(key)) continue;
      
      // Calculate score
      const score = calculateSpawnScore(grid, tx, ty, layout, constraints, interiors);
      
      validTiles.push({ tx, ty, score });
    }
  }
  
  // Sort by score descending
  validTiles.sort((a, b) => b.score - a.score);
  
  return validTiles;
}

/**
 * Get forbidden positions based on constraints
 * 
 * @param {Object} layout - Level layout
 * @param {Object} constraints - Placement constraints
 * @returns {Set<string>} Set of forbidden "tx,ty" keys
 */
function getForbiddenPositions(layout, constraints) {
  const forbidden = new Set();
  
  // Mark guard patrol positions as forbidden
  if (layout.guardPatrol) {
    for (const pos of layout.guardPatrol) {
      markRadius(forbidden, pos.x, pos.y, constraints.minGuardDistance);
    }
  }
  
  // Mark player start as forbidden
  if (layout.playerStart) {
    markRadius(forbidden, layout.playerStart.x, layout.playerStart.y, constraints.minPlayerStartDistance);
  }
  
  // Mark exit zone as forbidden
  if (layout.exitZone) {
    markRadius(forbidden, layout.exitZone.x, layout.exitZone.y, constraints.minExitDistance);
  }
  
  // Mark laser grid positions as forbidden
  if (layout.laserGrids) {
    for (const laser of layout.laserGrids) {
      markRadius(forbidden, laser.x, laser.y, constraints.minHazardDistance);
    }
  }
  
  // Mark motion sensor positions as forbidden
  if (layout.motionSensors) {
    for (const sensor of layout.motionSensors) {
      markRadius(forbidden, sensor.x, sensor.y, constraints.minHazardDistance);
    }
  }
  
  // Mark camera positions as forbidden (avoid placing objectives in camera view)
  if (layout.cameras) {
    for (const camera of layout.cameras) {
      markRadius(forbidden, camera.x, camera.y, 1);
    }
  }
  
  return forbidden;
}

/**
 * Mark all positions within a radius as forbidden
 * 
 * @param {Set<string>} forbidden - Set to add positions to
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} radius - Radius in tiles
 */
function markRadius(forbidden, cx, cy, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= radius) {
        forbidden.add(`${cx + dx},${cy + dy}`);
      }
    }
  }
}

/**
 * Calculate spawn score for a tile
 * Higher score = better spawn point
 * 
 * @param {TileGrid} grid - The tile grid
 * @param {number} tx - Tile X
 * @param {number} ty - Tile Y
 * @param {Object} layout - Level layout
 * @param {Object} constraints - Placement constraints
 * @param {Set<string>} interiors - Room interior tiles
 * @returns {number} Spawn score
 */
function calculateSpawnScore(grid, tx, ty, layout, constraints, interiors) {
  let score = 0;
  const weights = SCORING_WEIGHTS;
  
  // Room interior bonus (already validated, but add base score)
  score += weights.roomInterior;
  
  // Wall clearance bonus
  const wallClearance = getWallClearance(grid, tx, ty);
  score += wallClearance * weights.wallClearance;
  
  // Centrality bonus (distance from map edges)
  const centerDist = getCentralityScore(grid, tx, ty);
  score += centerDist * weights.centrality;
  
  // Accessibility bonus (count of walkable neighbors)
  const accessibility = countWalkableNeighbors(grid, tx, ty);
  score += accessibility * weights.accessibility;
  
  return score;
}

/**
 * Get wall clearance for a tile (distance to nearest wall/obstacle)
 * 
 * @param {TileGrid} grid - The tile grid
 * @param {number} tx - Tile X
 * @param {number} ty - Tile Y
 * @returns {number} Wall clearance in tiles
 */
function getWallClearance(grid, tx, ty) {
  let minClearance = Infinity;
  
  // Check in 4 directions
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];
  
  for (const { dx, dy } of directions) {
    let distance = 0;
    let cx = tx + dx;
    let cy = ty + dy;
    
    while (isInBounds(cx, cy) && grid.isWalkable(cx, cy)) {
      distance++;
      cx += dx;
      cy += dy;
    }
    
    minClearance = Math.min(minClearance, distance);
  }
  
  return minClearance === Infinity ? 0 : minClearance;
}

/**
 * Get centrality score (higher = more central)
 * 
 * @param {TileGrid} grid - The tile grid
 * @param {number} tx - Tile X
 * @param {number} ty - Tile Y
 * @returns {number} Centrality score
 */
function getCentralityScore(grid, tx, ty) {
  const centerX = grid.width / 2;
  const centerY = grid.height / 2;
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
  
  const dist = Math.sqrt(
    Math.pow(tx - centerX, 2) + Math.pow(ty - centerY, 2)
  );
  
  // Normalize to 0-1 range and invert (central = high score)
  return Math.max(0, 1 - (dist / maxDist)) * 10;
}

/**
 * Count walkable neighbors for a tile
 * 
 * @param {TileGrid} grid - The tile grid
 * @param {number} tx - Tile X
 * @param {number} ty - Tile Y
 * @returns {number} Count of walkable neighbors
 */
function countWalkableNeighbors(grid, tx, ty) {
  let count = 0;
  
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (grid.isWalkable(tx + dx, ty + dy)) {
        count++;
      }
    }
  }
  
  return count;
}

// ==================== OBJECTIVE PLACEMENT ====================

/**
 * ObjectiveSpawner class for managing objective placement
 */
export class ObjectiveSpawner {
  /**
   * Create a new ObjectiveSpawner
   * @param {TileGrid} grid - The tile grid
   * @param {Object} layout - Level layout
   * @param {Object} options - Configuration options
   */
  constructor(grid, layout, options = {}) {
    this.grid = grid;
    this.layout = layout;
    this.constraints = { ...DEFAULT_CONSTRAINTS, ...options.constraints };
    this.seed = options.seed || 0;
    this.interiors = null;
    this.validSpawns = null;
    this.placedObjectives = new Map();
    this.relocations = [];
  }
  
  /**
   * Initialize the spawner (detect rooms, compute valid spawns)
   */
  initialize() {
    this.interiors = detectRoomInteriors(this.grid);
    this.validSpawns = getValidSpawnTiles(this.grid, this.layout, this.constraints);
    this.placedObjectives.clear();
    this.relocations = [];
  }
  
  /**
   * Validate all objectives in the level layout
   * @returns {{valid: boolean, errors: string[], warnings: string[], relocations: Array}}
   */
  validateObjectives() {
    if (!this.interiors) this.initialize();
    
    const errors = [];
    const warnings = [];
    const relocations = [];
    
    // Check required objectives
    for (const type of REQUIRED_OBJECTIVES) {
      const pos = this.layout[type];
      if (!pos) {
        errors.push(`Missing required objective: ${type}`);
        continue;
      }
      
      const validation = this.validateObjectivePlacement(type, pos);
      if (!validation.valid) {
        errors.push(`${type} at (${pos.x}, ${pos.y}): ${validation.reason}`);
        
        // Try to find relocation
        const relocation = this.findRelocation(type, pos);
        if (relocation) {
          relocations.push({
            type,
            from: pos,
            to: relocation,
            reason: validation.reason
          });
        }
      } else if (validation.warnings) {
        warnings.push(...validation.warnings.map(w => `${type}: ${w}`));
      }
    }
    
    // Check optional objectives
    for (const type of OPTIONAL_OBJECTIVES) {
      const pos = this.layout[type];
      if (!pos) continue;
      
      const validation = this.validateObjectivePlacement(type, pos);
      if (!validation.valid) {
        warnings.push(`Optional ${type} at (${pos.x}, ${pos.y}): ${validation.reason}`);
        
        // Try to find relocation
        const relocation = this.findRelocation(type, pos);
        if (relocation) {
          relocations.push({
            type,
            from: pos,
            to: relocation,
            reason: validation.reason
          });
        }
      }
    }
    
    // Check spacing between objectives
    const spacingErrors = this.validateObjectiveSpacing();
    errors.push(...spacingErrors);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      relocations
    };
  }
  
  /**
   * Validate a single objective placement
   * @param {string} type - Objective type
   * @param {{x: number, y: number}} pos - Position
   * @returns {{valid: boolean, reason?: string, warnings?: string[]}}
   */
  validateObjectivePlacement(type, pos) {
    const warnings = [];
    
    // Check bounds
    if (!isInBounds(pos.x, pos.y)) {
      return { valid: false, reason: 'Position out of bounds' };
    }
    
    // Check walkability
    if (!this.grid.isWalkable(pos.x, pos.y)) {
      return { valid: false, reason: 'Position is not walkable (wall/obstacle)' };
    }
    
    // Check room interior
    if (!this.interiors.has(`${pos.x},${pos.y}`)) {
      // This is a warning, not an error - some objectives may be near walls
      warnings.push('Not in room interior (adjacent to wall)');
    }
    
    // Check wall clearance
    const wallClearance = getWallClearance(this.grid, pos.x, pos.y);
    if (wallClearance < this.constraints.minWallClearance) {
      return { 
        valid: false, 
        reason: `Insufficient wall clearance (${wallClearance} < ${this.constraints.minWallClearance})` 
      };
    }
    
    // Check guard distance
    if (this.layout.guardPatrol) {
      for (const guardPos of this.layout.guardPatrol) {
        const dist = manhattanDistance(pos.x, pos.y, guardPos.x, guardPos.y);
        if (dist < this.constraints.minGuardDistance) {
          return { 
            valid: false, 
            reason: `Too close to guard patrol point (${dist} < ${this.constraints.minGuardDistance})` 
          };
        }
      }
    }
    
    // Check hazard distance
    if (this.layout.laserGrids) {
      for (const laser of this.layout.laserGrids) {
        const dist = manhattanDistance(pos.x, pos.y, laser.x, laser.y);
        if (dist < this.constraints.minHazardDistance) {
          return { 
            valid: false, 
            reason: `Too close to laser grid (${dist} < ${this.constraints.minHazardDistance})` 
          };
        }
      }
    }
    
    if (this.layout.motionSensors) {
      for (const sensor of this.layout.motionSensors) {
        const dist = manhattanDistance(pos.x, pos.y, sensor.x, sensor.y);
        if (dist < this.constraints.minHazardDistance) {
          return { 
            valid: false, 
            reason: `Too close to motion sensor (${dist} < ${this.constraints.minHazardDistance})` 
          };
        }
      }
    }
    
    // Check player start distance
    if (this.layout.playerStart) {
      const dist = manhattanDistance(pos.x, pos.y, this.layout.playerStart.x, this.layout.playerStart.y);
      if (dist < this.constraints.minPlayerStartDistance) {
        return { 
          valid: false, 
          reason: `Too close to player start (${dist} < ${this.constraints.minPlayerStartDistance})` 
        };
      }
    }
    
    // Check exit distance
    if (this.layout.exitZone) {
      const dist = manhattanDistance(pos.x, pos.y, this.layout.exitZone.x, this.layout.exitZone.y);
      if (dist < this.constraints.minExitDistance) {
        return { 
          valid: false, 
          reason: `Too close to exit zone (${dist} < ${this.constraints.minExitDistance})` 
        };
      }
    }
    
    return { valid: true, warnings };
  }
  
  /**
   * Validate spacing between all objectives
   * @returns {string[]} Spacing error messages
   */
  validateObjectiveSpacing() {
    const errors = [];
    const objectives = [];
    
    // Collect all objectives
    for (const type of [...REQUIRED_OBJECTIVES, ...OPTIONAL_OBJECTIVES]) {
      const pos = this.layout[type];
      if (pos) {
        objectives.push({ type, pos });
      }
    }
    
    // Check pairwise spacing
    for (let i = 0; i < objectives.length; i++) {
      for (let j = i + 1; j < objectives.length; j++) {
        const a = objectives[i];
        const b = objectives[j];
        const dist = manhattanDistance(a.pos.x, a.pos.y, b.pos.x, b.pos.y);
        
        if (dist < this.constraints.minObjectiveSpacing) {
          errors.push(
            `${a.type} and ${b.type} too close: ${dist} < ${this.constraints.minObjectiveSpacing}`
          );
        }
      }
    }
    
    return errors;
  }
  
  /**
   * Find a valid relocation for an objective
   * @param {string} type - Objective type
   * @param {{x: number, y: number}} currentPos - Current invalid position
   * @returns {{x: number, y: number}|null} Valid relocation or null
   */
  findRelocation(type, currentPos) {
    if (!this.validSpawns) this.initialize();
    
    // Get already placed objectives to check spacing
    const placedPositions = [];
    for (const [placedType, pos] of this.placedObjectives) {
      if (placedType !== type) {
        placedPositions.push(pos);
      }
    }
    
    // Add objectives from layout
    for (const objType of [...REQUIRED_OBJECTIVES, ...OPTIONAL_OBJECTIVES]) {
      if (objType !== type && this.layout[objType]) {
        placedPositions.push(this.layout[objType]);
      }
    }
    
    // Find best valid spawn that satisfies spacing
    for (const spawn of this.validSpawns) {
      // Check spacing from other objectives
      let validSpacing = true;
      for (const placedPos of placedPositions) {
        const dist = manhattanDistance(spawn.tx, spawn.ty, placedPos.x, placedPos.y);
        if (dist < this.constraints.minObjectiveSpacing) {
          validSpacing = false;
          break;
        }
      }
      
      if (validSpacing) {
        return { x: spawn.tx, y: spawn.ty };
      }
    }
    
    // Fallback: find any walkable tile with max clearance
    for (const spawn of this.validSpawns) {
      return { x: spawn.tx, y: spawn.ty };
    }
    
    return null;
  }
  
  /**
   * Apply relocations to the layout
   * @param {Array} relocations - Relocations to apply
   * @returns {Object} Modified layout
   */
  applyRelocations(relocations) {
    const modifiedLayout = { ...this.layout };
    
    for (const relocation of relocations) {
      modifiedLayout[relocation.type] = relocation.to;
      this.relocations.push(relocation);
    }
    
    return modifiedLayout;
  }
  
  /**
   * Get deterministic spawn for an objective type
   * Uses seeded selection for reproducibility
   * @param {string} type - Objective type
   * @returns {{x: number, y: number}|null} Spawn position or null
   */
  getDeterministicSpawn(type) {
    if (!this.validSpawns) this.initialize();
    
    if (this.validSpawns.length === 0) return null;
    
    // Use seed + type hash for deterministic selection
    const typeHash = hashString(type);
    const index = (this.seed + typeHash) % this.validSpawns.length;
    
    const spawn = this.validSpawns[index];
    return { x: spawn.tx, y: spawn.ty };
  }
  
  /**
   * Get spawn statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    if (!this.validSpawns) this.initialize();
    
    return {
      totalWalkable: this.grid.getAllWalkableTiles().length,
      roomInteriors: this.interiors.size,
      validSpawns: this.validSpawns.length,
      relocationsApplied: this.relocations.length,
      constraints: this.constraints
    };
  }
}

/**
 * Simple string hash function for deterministic selection
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate all level layouts for objective placement
 * @param {Array} layouts - Array of level layouts
 * @returns {Object} Validation results
 */
export function validateAllLayouts(layouts) {
  const results = {
    valid: true,
    levels: [],
    totalErrors: 0,
    totalWarnings: 0,
    totalRelocations: 0
  };
  
  for (let i = 0; i < layouts.length; i++) {
    const layout = layouts[i];
    const grid = new TileGrid(layout);
    const spawner = new ObjectiveSpawner(grid, layout);
    const validation = spawner.validateObjectives();
    
    results.levels.push({
      index: i,
      name: layout.name,
      ...validation,
      stats: spawner.getStats()
    });
    
    if (!validation.valid) {
      results.valid = false;
    }
    
    results.totalErrors += validation.errors.length;
    results.totalWarnings += validation.warnings.length;
    results.totalRelocations += validation.relocations.length;
  }
  
  return results;
}

/**
 * Quick check if a position is valid for objective placement
 * @param {TileGrid} grid - The tile grid
 * @param {Object} layout - Level layout
 * @param {number} x - Tile X
 * @param {number} y - Tile Y
 * @returns {boolean} True if valid
 */
export function isValidObjectivePosition(grid, layout, x, y) {
  const spawner = new ObjectiveSpawner(grid, layout);
  spawner.initialize();
  
  const validation = spawner.validateObjectivePlacement('test', { x, y });
  return validation.valid;
}

// ==================== EXPORTS ====================
export default ObjectiveSpawner;
