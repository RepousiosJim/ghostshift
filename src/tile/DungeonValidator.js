/**
 * DungeonValidator - Hard validators for dungeon maps
 * 
 * Validates:
 * - Connectivity (all walkable tiles reachable)
 * - Walkability constraints (valid paths for player/enemy)
 * - Objective-slot constraints (valid spawn positions)
 * 
 * @module tile/DungeonValidator
 */

import {
  DUNGEON_TILE_TYPES,
  TILE_CATEGORIES,
  isWalkableType,
  isBlockingType,
  isRoomFloor,
  isSlot
} from './DungeonTileTypes.js';

import {
  isInBounds,
  manhattanDistance,
  MAP_WIDTH,
  MAP_HEIGHT
} from './TileGrid.js';

// ==================== VALIDATION RESULT ====================

/**
 * Validation result object
 */
export class ValidationResult {
  constructor() {
    this.valid = true;
    this.errors = [];
    this.warnings = [];
    this.stats = {};
  }
  
  addError(message) {
    this.valid = false;
    this.errors.push(message);
  }
  
  addWarning(message) {
    this.warnings.push(message);
  }
  
  addStat(key, value) {
    this.stats[key] = value;
  }
  
  toSummary() {
    return {
      valid: this.valid,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: this.errors,
      warnings: this.warnings,
      stats: this.stats
    };
  }
}

// ==================== CONNECTIVITY VALIDATOR ====================

/**
 * Validate map connectivity using flood-fill
 * Ensures all walkable tiles are reachable from any other walkable tile
 * 
 * @param {Uint8Array} grid - Tile grid
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @returns {ValidationResult}
 */
export function validateConnectivity(grid, width = MAP_WIDTH, height = MAP_HEIGHT) {
  const result = new ValidationResult();
  
  // Find all walkable tiles
  const walkableTiles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isWalkableType(grid[idx])) {
        walkableTiles.push({ x, y });
      }
    }
  }
  
  result.addStat('walkableTiles', walkableTiles.length);
  
  if (walkableTiles.length === 0) {
    result.addError('No walkable tiles found');
    return result;
  }
  
  // Flood fill from first walkable tile
  const visited = new Set();
  const queue = [walkableTiles[0]];
  visited.add(`${walkableTiles[0].x},${walkableTiles[0].y}`);
  
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
  ];
  
  while (queue.length > 0) {
    const current = queue.shift();
    
    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const key = `${nx},${ny}`;
      
      if (!isInBounds(nx, ny)) continue;
      if (visited.has(key)) continue;
      
      const idx = ny * width + nx;
      if (isWalkableType(grid[idx])) {
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  
  result.addStat('connectedTiles', visited.size);
  
  // Check for disconnected regions
  const disconnected = walkableTiles.filter(t => !visited.has(`${t.x},${t.y}`));
  
  if (disconnected.length > 0) {
    result.addError(`Found ${disconnected.length} disconnected walkable tiles`);
    result.addStat('disconnectedTiles', disconnected.length);
    
    // Report first few disconnected tiles
    const sample = disconnected.slice(0, 5);
    for (const tile of sample) {
      result.addWarning(`Disconnected tile at (${tile.x}, ${tile.y})`);
    }
  }
  
  // Calculate connectivity percentage
  const connectivityPercent = (visited.size / walkableTiles.length) * 100;
  result.addStat('connectivityPercent', connectivityPercent.toFixed(2));
  
  return result;
}

// ==================== WALKABILITY VALIDATOR ====================

/**
 * Validate walkability constraints
 * Checks for valid paths between key points
 * 
 * @param {Uint8Array} grid - Tile grid
 * @param {Object} levelData - Level data with key positions
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @returns {ValidationResult}
 */
export function validateWalkability(grid, levelData, width = MAP_WIDTH, height = MAP_HEIGHT) {
  const result = new ValidationResult();
  
  // Check player start is walkable
  if (levelData.playerStart) {
    const idx = levelData.playerStart.y * width + levelData.playerStart.x;
    if (!isWalkableType(grid[idx])) {
      result.addError(`Player start at (${levelData.playerStart.x}, ${levelData.playerStart.y}) is not walkable`);
    }
  }
  
  // Check exit is walkable
  if (levelData.exitZone) {
    const idx = levelData.exitZone.y * width + levelData.exitZone.x;
    if (!isWalkableType(grid[idx])) {
      result.addError(`Exit zone at (${levelData.exitZone.x}, ${levelData.exitZone.y}) is not walkable`);
    }
  }
  
  // Check objectives are walkable
  const objectives = ['dataCore', 'keyCard', 'hackTerminal', 'relayTerminal', 'securityCode', 'powerCell'];
  for (const objName of objectives) {
    const obj = levelData[objName];
    if (obj) {
      const idx = obj.y * width + obj.x;
      if (!isWalkableType(grid[idx])) {
        result.addError(`${objName} at (${obj.x}, ${obj.y}) is not walkable`);
      }
    }
  }
  
  // Check guard spawns are walkable
  if (levelData.guardPatrol) {
    for (let i = 0; i < levelData.guardPatrol.length; i++) {
      const patrol = levelData.guardPatrol[i];
      if (patrol.points && patrol.points.length > 0) {
        for (let j = 0; j < patrol.points.length; j++) {
          const point = patrol.points[j];
          const idx = point.y * width + point.x;
          if (!isWalkableType(grid[idx])) {
            result.addError(`Guard ${i} patrol point ${j} at (${point.x}, ${point.y}) is not walkable`);
          }
        }
      }
    }
  }
  
  // Path validation from player start to exit
  if (levelData.playerStart && levelData.exitZone) {
    const pathResult = validatePath(
      grid,
      levelData.playerStart.x,
      levelData.playerStart.y,
      levelData.exitZone.x,
      levelData.exitZone.y,
      width,
      height
    );
    
    if (!pathResult.valid) {
      result.addError('No valid path from player start to exit');
    }
    
    result.addStat('playerToExitPath', pathResult.valid);
    result.addStat('playerToExitDistance', pathResult.distance);
  }
  
  // Path validation from player start to all objectives
  if (levelData.playerStart) {
    for (const objName of objectives) {
      const obj = levelData[objName];
      if (obj) {
        const pathResult = validatePath(
          grid,
          levelData.playerStart.x,
          levelData.playerStart.y,
          obj.x,
          obj.y,
          width,
          height
        );
        
        if (!pathResult.valid) {
          result.addError(`No valid path from player start to ${objName}`);
        }
        
        result.addStat(`pathTo${objName}`, pathResult.valid);
      }
    }
  }
  
  return result;
}

/**
 * Validate path exists between two points using BFS
 * @param {Uint8Array} grid - Tile grid
 * @param {number} x1 - Start X
 * @param {number} y1 - Start Y
 * @param {number} x2 - End X
 * @param {number} y2 - End Y
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @returns {{valid: boolean, distance: number}}
 */
export function validatePath(grid, x1, y1, x2, y2, width = MAP_WIDTH, height = MAP_HEIGHT) {
  if (!isInBounds(x1, y1) || !isInBounds(x2, y2)) {
    return { valid: false, distance: -1 };
  }
  
  const startIdx = y1 * width + x1;
  const endIdx = y2 * width + x2;
  
  if (!isWalkableType(grid[startIdx]) || !isWalkableType(grid[endIdx])) {
    return { valid: false, distance: -1 };
  }
  
  const visited = new Set();
  const queue = [{ x: x1, y: y1, dist: 0 }];
  visited.add(`${x1},${y1}`);
  
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
  ];
  
  while (queue.length > 0) {
    const current = queue.shift();
    
    if (current.x === x2 && current.y === y2) {
      return { valid: true, distance: current.dist };
    }
    
    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const key = `${nx},${ny}`;
      
      if (!isInBounds(nx, ny)) continue;
      if (visited.has(key)) continue;
      
      const idx = ny * width + nx;
      if (isWalkableType(grid[idx])) {
        visited.add(key);
        queue.push({ x: nx, y: ny, dist: current.dist + 1 });
      }
    }
  }
  
  return { valid: false, distance: -1 };
}

// ==================== OBJECTIVE-SLOT VALIDATOR ====================

/**
 * Validate objective-slot constraints
 * Ensures objective slots are properly placed in room interiors
 * 
 * @param {Uint8Array} grid - Tile grid
 * @param {Object} levelData - Level data with objectives
 * @param {Array} rooms - Room array from dungeon generator
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @returns {ValidationResult}
 */
export function validateObjectiveSlots(grid, levelData, rooms = [], width = MAP_WIDTH, height = MAP_HEIGHT) {
  const result = new ValidationResult();
  
  // Count objective slots
  let objectiveSlots = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (grid[idx] === DUNGEON_TILE_TYPES.OBJECTIVE_SLOT) {
        objectiveSlots++;
      }
    }
  }
  
  result.addStat('objectiveSlots', objectiveSlots);
  
  // Check required objectives are in valid positions
  const requiredObjectives = ['dataCore', 'keyCard', 'hackTerminal'];
  
  for (const objName of requiredObjectives) {
    const obj = levelData[objName];
    
    if (!obj) {
      result.addWarning(`Required objective ${objName} is missing`);
      continue;
    }
    
    const idx = obj.y * width + obj.x;
    const tileType = grid[idx];
    
    // Must be walkable
    if (!isWalkableType(tileType)) {
      result.addError(`${objName} at (${obj.x}, ${obj.y}) is on non-walkable tile`);
    }
    
    // Should be in room interior (if rooms defined)
    if (rooms.length > 0) {
      const inRoom = rooms.some(room => room.contains(obj.x, obj.y));
      if (!inRoom) {
        result.addWarning(`${objName} at (${obj.x}, ${obj.y}) is not inside any room`);
      }
    }
    
    // Should have clearance from walls
    const hasClearance = checkWallClearance(grid, obj.x, obj.y, 1, width, height);
    if (!hasClearance) {
      result.addWarning(`${objName} at (${obj.x}, ${obj.y}) is adjacent to wall`);
    }
  }
  
  // Check minimum objective spacing
  const objectives = [levelData.dataCore, levelData.keyCard, levelData.hackTerminal]
    .filter(o => o);
  
  for (let i = 0; i < objectives.length; i++) {
    for (let j = i + 1; j < objectives.length; j++) {
      const dist = manhattanDistance(
        objectives[i].x,
        objectives[i].y,
        objectives[j].x,
        objectives[j].y
      );
      
      if (dist < 3) {
        result.addWarning(
          `Objectives too close: ${dist} tiles between (${objectives[i].x},${objectives[i].y}) and (${objectives[j].x},${objectives[j].y})`
        );
      }
    }
  }
  
  return result;
}

/**
 * Check if position has wall clearance
 * @param {Uint8Array} grid - Tile grid
 * @param {number} x - Tile X
 * @param {number} y - Tile Y
 * @param {number} clearance - Required clearance
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @returns {boolean}
 */
function checkWallClearance(grid, x, y, clearance, width, height) {
  for (let dy = -clearance; dy <= clearance; dy++) {
    for (let dx = -clearance; dx <= clearance; dx++) {
      if (dx === 0 && dy === 0) continue;
      
      const nx = x + dx;
      const ny = y + dy;
      
      if (!isInBounds(nx, ny)) continue;
      
      const idx = ny * width + nx;
      if (isBlockingType(grid[idx])) {
        return false;
      }
    }
  }
  return true;
}

// ==================== COMPOSITE VALIDATOR ====================

/**
 * Run all validators on dungeon layout
 * @param {Uint8Array} grid - Tile grid
 * @param {Object} levelData - Level data
 * @param {Object} options - Validation options
 * @returns {ValidationResult}
 */
export function validateDungeon(grid, levelData, options = {}) {
  const result = new ValidationResult();
  
  // Run connectivity validator
  const connectivity = validateConnectivity(
    grid,
    options.width || MAP_WIDTH,
    options.height || MAP_HEIGHT
  );
  
  if (!connectivity.valid) {
    result.errors.push(...connectivity.errors);
    result.valid = false;
  }
  result.warnings.push(...connectivity.warnings);
  Object.assign(result.stats, connectivity.stats);
  
  // Run walkability validator
  const walkability = validateWalkability(
    grid,
    levelData,
    options.width || MAP_WIDTH,
    options.height || MAP_HEIGHT
  );
  
  if (!walkability.valid) {
    result.errors.push(...walkability.errors);
    result.valid = false;
  }
  result.warnings.push(...walkability.warnings);
  Object.assign(result.stats, walkability.stats);
  
  // Run objective-slot validator
  const objectives = validateObjectiveSlots(
    grid,
    levelData,
    options.rooms || [],
    options.width || MAP_WIDTH,
    options.height || MAP_HEIGHT
  );
  
  if (!objectives.valid) {
    result.errors.push(...objectives.errors);
    result.valid = false;
  }
  result.warnings.push(...objectives.warnings);
  Object.assign(result.stats, objectives.stats);
  
  return result;
}

// ==================== EXPORTS ====================
export default {
  ValidationResult,
  validateConnectivity,
  validateWalkability,
  validatePath,
  validateObjectiveSlots,
  validateDungeon
};
