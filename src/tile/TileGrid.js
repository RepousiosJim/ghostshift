/**
 * TileGrid - Core tile grid module for GhostShift
 * 
 * Phase A: Foundation for tile-locked navigation system.
 * Provides tile queries, world<->tile conversion, and walkability checks.
 * 
 * @module tile/TileGrid
 */

// ==================== CONSTANTS ====================
// Re-export from main.js constants for consistency
// These should match main.js values
export const TILE_SIZE = 48;
export const MAP_WIDTH = 22;  // BASELINE: Default map width (Level 1 overrides to 28)
export const MAP_HEIGHT = 18; // BASELINE: Default map height (Level 1 overrides to 23)

// Tile type identifiers
export const TILE_TYPES = {
  FLOOR: 0,
  WALL: 1,
  OBSTACLE: 2,
  PLAYER_START: 3,
  GUARD_SPAWN: 4,
  ITEM: 5,
  EXIT: 6,
  CAMERA: 7,
  SENSOR: 8,
  LASER: 9,
  DRONE_PATH: 10,
  WATER: 11,      // Optional: special terrain
  VENT: 12,       // Optional: stealth tunnel
  RESTRICTED: 13  // Optional: no-go zone for certain enemies
};

// ==================== WORLD <-> TILE CONVERSION ====================

/**
 * Convert world coordinates (pixels) to tile coordinates
 * @param {number} worldX - World X position in pixels
 * @param {number} worldY - World Y position in pixels
 * @returns {{tx: number, ty: number}} Tile coordinates
 */
export function worldToTile(worldX, worldY) {
  return {
    tx: Math.floor(worldX / TILE_SIZE),
    ty: Math.floor(worldY / TILE_SIZE)
  };
}

/**
 * Convert tile coordinates to world coordinates (center of tile)
 * @param {number} tx - Tile X coordinate
 * @param {number} ty - Tile Y coordinate
 * @returns {{x: number, y: number}} World coordinates (center of tile)
 */
export function tileToWorld(tx, ty) {
  return {
    x: tx * TILE_SIZE + TILE_SIZE / 2,
    y: ty * TILE_SIZE + TILE_SIZE / 2
  };
}

/**
 * Convert tile coordinates to world coordinates (top-left corner)
 * @param {number} tx - Tile X coordinate
 * @param {number} ty - Tile Y coordinate
 * @returns {{x: number, y: number}} World coordinates (top-left)
 */
export function tileToWorldCorner(tx, ty) {
  return {
    x: tx * TILE_SIZE,
    y: ty * TILE_SIZE
  };
}

/**
 * Snap world coordinates to nearest tile center
 * @param {number} worldX - World X position
 * @param {number} worldY - World Y position
 * @returns {{x: number, y: number}} Snapped world coordinates
 */
export function snapToTileCenter(worldX, worldY) {
  const { tx, ty } = worldToTile(worldX, worldY);
  return tileToWorld(tx, ty);
}

/**
 * Check if tile coordinates are within map bounds
 * @param {number} tx - Tile X coordinate
 * @param {number} ty - Tile Y coordinate
 * @returns {boolean} True if in bounds
 */
export function isInBounds(tx, ty) {
  return tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT;
}

/**
 * Get Manhattan distance between two tile positions
 * @param {number} tx1 - First tile X
 * @param {number} ty1 - First tile Y
 * @param {number} tx2 - Second tile X
 * @param {number} ty2 - Second tile Y
 * @returns {number} Manhattan distance
 */
export function manhattanDistance(tx1, ty1, tx2, ty2) {
  return Math.abs(tx2 - tx1) + Math.abs(ty2 - ty1);
}

/**
 * Get Chebyshev distance (for 8-directional movement)
 * @param {number} tx1 - First tile X
 * @param {number} ty1 - First tile Y
 * @param {number} tx2 - Second tile X
 * @param {number} ty2 - Second tile Y
 * @returns {number} Chebyshev distance
 */
export function chebyshevDistance(tx1, ty1, tx2, ty2) {
  return Math.max(Math.abs(tx2 - tx1), Math.abs(ty2 - ty1));
}

/**
 * Get Euclidean distance between tile centers in world space
 * @param {number} tx1 - First tile X
 * @param {number} ty1 - First tile Y
 * @param {number} tx2 - Second tile X
 * @param {number} ty2 - Second tile Y
 * @returns {number} Euclidean distance in pixels
 */
export function euclideanDistance(tx1, ty1, tx2, ty2) {
  const w1 = tileToWorld(tx1, ty1);
  const w2 = tileToWorld(tx2, ty2);
  const dx = w2.x - w1.x;
  const dy = w2.y - w1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ==================== TILE GRID CLASS ====================

/**
 * TileGrid - Main class for managing the tile grid
 * Holds the tile type map and provides query methods
 */
export class TileGrid {
  /**
   * Create a new TileGrid
   * @param {Object} levelLayout - Level layout from LEVEL_LAYOUTS
   */
  constructor(levelLayout) {
    this.layout = levelLayout;
    // Use per-level dimensions if available, otherwise fall back to baseline
    this.width = levelLayout.width || MAP_WIDTH;
    this.height = levelLayout.height || MAP_HEIGHT;

    // Tile metadata cache (populated by TileMetadata module) - initialize FIRST
    this._metadataCache = new Map();

    // Initialize tile type map
    this.tiles = new Uint8Array(this.width * this.height);
    this._initializeTiles();
  }
  
  /**
   * Initialize tile type map from level layout
   * @private
   */
  _initializeTiles() {
    // Fill with floor tiles first
    this.tiles.fill(TILE_TYPES.FLOOR);

    // Mark border walls (use per-level dimensions)
    for (let x = 0; x < this.width; x++) {
      this.setTileType(x, 0, TILE_TYPES.WALL);
      this.setTileType(x, this.height - 1, TILE_TYPES.WALL);
    }
    for (let y = 0; y < this.height; y++) {
      this.setTileType(0, y, TILE_TYPES.WALL);
      this.setTileType(this.width - 1, y, TILE_TYPES.WALL);
    }
    
    // Mark obstacles from level layout
    if (this.layout.obstacles) {
      for (const obs of this.layout.obstacles) {
        if (isInBounds(obs.x, obs.y)) {
          this.setTileType(obs.x, obs.y, TILE_TYPES.OBSTACLE);
        }
      }
    }
    
    // Mark special tiles (for reference, not blocking)
    if (this.layout.playerStart) {
      this.setTileType(this.layout.playerStart.x, this.layout.playerStart.y, TILE_TYPES.PLAYER_START);
    }
    
    if (this.layout.exitZone) {
      // Exit zone may span multiple tiles
      const ex = this.layout.exitZone.x;
      const ey = this.layout.exitZone.y;
      this.setTileType(ex, ey, TILE_TYPES.EXIT);
    }
    
    // Items (floor tiles that contain items)
    if (this.layout.dataCore) {
      // Data core tile is still walkable, just marked
    }
    if (this.layout.keyCard) {
      // Key card tile is still walkable, just marked
    }
    if (this.layout.hackTerminal) {
      // Hack terminal tile is still walkable, just marked
    }
  }
  
  /**
   * Get tile index in flat array
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @returns {number} Array index
   */
  _getIndex(tx, ty) {
    return ty * this.width + tx;
  }
  
  /**
   * Get tile type at position
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @returns {number} Tile type (TILE_TYPES constant)
   */
  getTileType(tx, ty) {
    if (!isInBounds(tx, ty)) return TILE_TYPES.WALL; // Out of bounds = wall
    return this.tiles[this._getIndex(tx, ty)];
  }
  
  /**
   * Set tile type at position
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @param {number} type - Tile type (TILE_TYPES constant)
   */
  setTileType(tx, ty, type) {
    if (!isInBounds(tx, ty)) return;
    this.tiles[this._getIndex(tx, ty)] = type;
    // Invalidate metadata cache for this tile
    this._metadataCache.delete(`${tx},${ty}`);
  }
  
  /**
   * Check if a tile is walkable for a given entity type
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @param {string} entityType - 'player', 'enemy', or 'all'
   * @returns {boolean} True if walkable
   */
  isWalkable(tx, ty, entityType = 'all') {
    if (!isInBounds(tx, ty)) return false;
    
    const type = this.getTileType(tx, ty);
    
    // Walls and obstacles are never walkable
    if (type === TILE_TYPES.WALL || type === TILE_TYPES.OBSTACLE) {
      return false;
    }
    
    // Water is only walkable by player with special ability
    if (type === TILE_TYPES.WATER && entityType !== 'player') {
      return false;
    }
    
    // Restricted zones may block certain enemies
    if (type === TILE_TYPES.RESTRICTED && entityType === 'enemy') {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if a tile blocks line of sight
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @returns {boolean} True if blocks LOS
   */
  blocksLOS(tx, ty) {
    if (!isInBounds(tx, ty)) return true;
    
    const type = this.getTileType(tx, ty);
    return type === TILE_TYPES.WALL || type === TILE_TYPES.OBSTACLE;
  }
  
  /**
   * Check if a world position collides with walls
   * @param {number} worldX - World X position
   * @param {number} worldY - World Y position
   * @param {number} radius - Collision radius (default: half tile)
   * @returns {boolean} True if collides
   */
  isCollisionAt(worldX, worldY, radius = TILE_SIZE / 2 - 2) {
    // Check center tile
    const { tx, ty } = worldToTile(worldX, worldY);
    if (!this.isWalkable(tx, ty)) return true;
    
    // Check surrounding tiles based on radius
    const tilesToCheck = Math.ceil(radius / TILE_SIZE);
    for (let dx = -tilesToCheck; dx <= tilesToCheck; dx++) {
      for (let dy = -tilesToCheck; dy <= tilesToCheck; dy++) {
        if (dx === 0 && dy === 0) continue;
        const checkTx = tx + dx;
        const checkTy = ty + dy;
        if (!this.isWalkable(checkTx, checkTy)) {
          // Check actual collision distance
          const tileCenter = tileToWorld(checkTx, checkTy);
          const halfTile = TILE_SIZE / 2;
          if (worldX + radius > tileCenter.x - halfTile &&
              worldX - radius < tileCenter.x + halfTile &&
              worldY + radius > tileCenter.y - halfTile &&
              worldY - radius < tileCenter.y + halfTile) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Get all walkable neighbors of a tile (4-directional)
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @param {string} entityType - Entity type for walkability check
   * @returns {Array<{tx: number, ty: number}>} Walkable neighbors
   */
  getNeighbors4(tx, ty, entityType = 'enemy') {
    const neighbors = [];
    const directions = [
      { dx: 0, dy: -1 }, // Up
      { dx: 0, dy: 1 },  // Down
      { dx: -1, dy: 0 }, // Left
      { dx: 1, dy: 0 }   // Right
    ];
    
    for (const dir of directions) {
      const nx = tx + dir.dx;
      const ny = ty + dir.dy;
      if (this.isWalkable(nx, ny, entityType)) {
        neighbors.push({ tx: nx, ty: ny });
      }
    }
    
    return neighbors;
  }
  
  /**
   * Get all walkable neighbors of a tile (8-directional)
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @param {string} entityType - Entity type for walkability check
   * @returns {Array<{tx: number, ty: number, cost: number}>} Walkable neighbors with cost
   */
  getNeighbors8(tx, ty, entityType = 'enemy') {
    const neighbors = [];
    const directions = [
      { dx: 0, dy: -1, cost: 1 },   // Up
      { dx: 0, dy: 1, cost: 1 },    // Down
      { dx: -1, dy: 0, cost: 1 },   // Left
      { dx: 1, dy: 0, cost: 1 },    // Right
      { dx: -1, dy: -1, cost: 1.414 }, // Up-Left
      { dx: 1, dy: -1, cost: 1.414 },  // Up-Right
      { dx: -1, dy: 1, cost: 1.414 },  // Down-Left
      { dx: 1, dy: 1, cost: 1.414 }    // Down-Right
    ];
    
    for (const dir of directions) {
      const nx = tx + dir.dx;
      const ny = ty + dir.dy;
      
      // For diagonal movement, check that both cardinal directions are walkable
      // This prevents cutting corners through walls
      if (dir.dx !== 0 && dir.dy !== 0) {
        if (!this.isWalkable(tx + dir.dx, ty, entityType) ||
            !this.isWalkable(tx, ty + dir.dy, entityType)) {
          continue;
        }
      }
      
      if (this.isWalkable(nx, ny, entityType)) {
        neighbors.push({ tx: nx, ty: ny, cost: dir.cost });
      }
    }
    
    return neighbors;
  }
  
  /**
   * Get all walkable tiles in the map
   * @param {string} entityType - Entity type for walkability
   * @returns {Array<{tx: number, ty: number}>} All walkable tiles
   */
  getAllWalkableTiles(entityType = 'enemy') {
    const walkable = [];
    for (let ty = 0; ty < this.height; ty++) {
      for (let tx = 0; tx < this.width; tx++) {
        if (this.isWalkable(tx, ty, entityType)) {
          walkable.push({ tx, ty });
        }
      }
    }
    return walkable;
  }
  
  /**
   * Find nearest walkable tile to a world position
   * @param {number} worldX - World X position
   * @param {number} worldY - World Y position
   * @param {string} entityType - Entity type
   * @returns {{tx: number, ty: number}|null} Nearest walkable tile or null
   */
  findNearestWalkable(worldX, worldY, entityType = 'enemy') {
    const { tx, ty } = worldToTile(worldX, worldY);
    
    // Check if current tile is walkable
    if (this.isWalkable(tx, ty, entityType)) {
      return { tx, ty };
    }
    
    // BFS to find nearest walkable tile
    const visited = new Set();
    const queue = [{ tx, ty, dist: 0 }];
    visited.add(`${tx},${ty}`);
    
    while (queue.length > 0) {
      const current = queue.shift();
      
      if (this.isWalkable(current.tx, current.ty, entityType)) {
        return { tx: current.tx, ty: current.ty };
      }
      
      // Expand to neighbors
      for (const neighbor of this.getNeighbors4(current.tx, current.ty, 'all')) {
        const key = `${neighbor.tx},${neighbor.ty}`;
        if (!visited.has(key) && current.dist < 10) {
          visited.add(key);
          queue.push({ tx: neighbor.tx, ty: neighbor.ty, dist: current.dist + 1 });
        }
      }
    }
    
    return null;
  }
  
  /**
   * Debug: Get tile info string
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @returns {string} Tile info
   */
  getTileInfo(tx, ty) {
    const type = this.getTileType(tx, ty);
    const typeName = Object.keys(TILE_TYPES).find(k => TILE_TYPES[k] === type) || 'UNKNOWN';
    return `Tile(${tx},${ty}): ${typeName} [walkable=${this.isWalkable(tx, ty)}]`;
  }
}

// ==================== EXPORTS ====================
export default TileGrid;
