/**
 * TileMetadata - Tile metadata contract for GhostShift
 * 
 * Phase A: Defines tile metadata properties for navigation.
 * 
 * Metadata Contract:
 * - walk_player: boolean - Can player walk on this tile?
 * - walk_enemy: boolean - Can enemy walk on this tile?
 * - blocks_los: boolean - Does this tile block line of sight?
 * - cost_enemy: number - Movement cost for enemies (default 1.0)
 * 
 * @module tile/TileMetadata
 */

import { TILE_TYPES, isInBounds } from './TileGrid.js';

// ==================== DEFAULT METADATA ====================

/**
 * Default tile metadata for each tile type
 * This defines the base properties that can be overridden per-tile
 */
export const DEFAULT_TILE_METADATA = {
  [TILE_TYPES.FLOOR]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 1.0
  },
  [TILE_TYPES.WALL]: {
    walk_player: false,
    walk_enemy: false,
    blocks_los: true,
    cost_enemy: Infinity
  },
  [TILE_TYPES.OBSTACLE]: {
    walk_player: false,
    walk_enemy: false,
    blocks_los: true,
    cost_enemy: Infinity
  },
  [TILE_TYPES.PLAYER_START]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 1.0
  },
  [TILE_TYPES.GUARD_SPAWN]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 1.0
  },
  [TILE_TYPES.ITEM]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 1.0
  },
  [TILE_TYPES.EXIT]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 1.0
  },
  [TILE_TYPES.CAMERA]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 1.0
  },
  [TILE_TYPES.SENSOR]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 1.0
  },
  [TILE_TYPES.LASER]: {
    walk_player: true,  // Can walk through but triggers detection
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 1.0
  },
  [TILE_TYPES.DRONE_PATH]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 1.0
  },
  [TILE_TYPES.WATER]: {
    walk_player: false,  // Player needs special ability
    walk_enemy: false,
    blocks_los: false,
    cost_enemy: Infinity
  },
  [TILE_TYPES.VENT]: {
    walk_player: true,   // Player stealth tunnel
    walk_enemy: false,   // Enemies can't enter
    blocks_los: true,    // Blocks vision
    cost_enemy: Infinity
  },
  [TILE_TYPES.RESTRICTED]: {
    walk_player: true,
    walk_enemy: false,   // Certain enemies avoid
    blocks_los: false,
    cost_enemy: Infinity
  }
};

// ==================== TILE METADATA CLASS ====================

/**
 * TileMetadata - Manages per-tile metadata
 * Allows runtime modification of tile properties
 */
export class TileMetadata {
  /**
   * Create a new TileMetadata manager
   * @param {TileGrid} tileGrid - Reference to the tile grid
   */
  constructor(tileGrid) {
    this.grid = tileGrid;
    
    // Override storage - stores tiles with modified metadata
    // Key: "tx,ty", Value: Partial<TileMetadata>
    this._overrides = new Map();
    
    // Dynamic modifier storage - applies to entire tile types
    // Key: tileType, Value: Partial<TileMetadata>
    this._typeModifiers = new Map();
  }
  
  /**
   * Get full metadata for a tile
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @returns {Object} Tile metadata object
   */
  getMetadata(tx, ty) {
    if (!isInBounds(tx, ty)) {
      // Out of bounds returns wall properties
      return { ...DEFAULT_TILE_METADATA[TILE_TYPES.WALL] };
    }
    
    const tileType = this.grid.getTileType(tx, ty);
    const base = DEFAULT_TILE_METADATA[tileType] || DEFAULT_TILE_METADATA[TILE_TYPES.FLOOR];
    
    // Apply type modifiers
    const typeMod = this._typeModifiers.get(tileType);
    let result = typeMod ? { ...base, ...typeMod } : { ...base };
    
    // Apply per-tile overrides
    const key = `${tx},${ty}`;
    const override = this._overrides.get(key);
    if (override) {
      result = { ...result, ...override };
    }
    
    return result;
  }
  
  /**
   * Get specific property for a tile
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @param {string} property - Property name
   * @returns {*} Property value
   */
  getProperty(tx, ty, property) {
    return this.getMetadata(tx, ty)[property];
  }
  
  /**
   * Check if tile is walkable for player
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @returns {boolean} True if player can walk
   */
  canPlayerWalk(tx, ty) {
    return this.getProperty(tx, ty, 'walk_player') === true;
  }
  
  /**
   * Check if tile is walkable for enemy
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @returns {boolean} True if enemy can walk
   */
  canEnemyWalk(tx, ty) {
    return this.getProperty(tx, ty, 'walk_enemy') === true;
  }
  
  /**
   * Check if tile blocks line of sight
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @returns {boolean} True if blocks LOS
   */
  blocksLineOfSight(tx, ty) {
    return this.getProperty(tx, ty, 'blocks_los') === true;
  }
  
  /**
   * Get movement cost for enemy on this tile
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @returns {number} Movement cost (Infinity if impassable)
   */
  getEnemyCost(tx, ty) {
    return this.getProperty(tx, ty, 'cost_enemy');
  }
  
  /**
   * Set override metadata for a specific tile
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @param {Object} metadata - Partial metadata to override
   */
  setOverride(tx, ty, metadata) {
    if (!isInBounds(tx, ty)) return;
    
    const key = `${tx},${ty}`;
    const existing = this._overrides.get(key) || {};
    this._overrides.set(key, { ...existing, ...metadata });
    
    // Invalidate grid's metadata cache
    this.grid._metadataCache.delete(key);
  }
  
  /**
   * Clear override for a specific tile
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   */
  clearOverride(tx, ty) {
    const key = `${tx},${ty}`;
    this._overrides.delete(key);
    this.grid._metadataCache.delete(key);
  }
  
  /**
   * Set modifier for all tiles of a type
   * @param {number} tileType - Tile type constant
   * @param {Object} metadata - Partial metadata to apply
   */
  setTypeModifier(tileType, metadata) {
    this._typeModifiers.set(tileType, metadata);
  }
  
  /**
   * Clear type modifier
   * @param {number} tileType - Tile type constant
   */
  clearTypeModifier(tileType) {
    this._typeModifiers.delete(tileType);
  }
  
  /**
   * Clear all overrides
   */
  clearAllOverrides() {
    this._overrides.clear();
    this.grid._metadataCache.clear();
  }
  
  /**
   * Mark a tile as temporarily blocked (e.g., by another enemy)
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @param {string} blockerId - ID of blocking entity
   */
  markBlocked(tx, ty, blockerId) {
    this.setOverride(tx, ty, {
      walk_enemy: false,
      _blockedBy: blockerId
    });
  }
  
  /**
   * Clear temporary block on a tile
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   * @param {string} blockerId - ID of blocking entity (must match)
   */
  clearBlocked(tx, ty, blockerId) {
    const meta = this.getMetadata(tx, ty);
    if (meta._blockedBy === blockerId) {
      this.clearOverride(tx, ty);
    }
  }
  
  /**
   * Get all enemy-walkable tiles with their costs
   * @returns {Array<{tx: number, ty: number, cost: number}>}
   */
  getEnemyWalkableTiles() {
    const result = [];
    for (let ty = 0; ty < this.grid.height; ty++) {
      for (let tx = 0; tx < this.grid.width; tx++) {
        const cost = this.getEnemyCost(tx, ty);
        if (cost < Infinity) {
          result.push({ tx, ty, cost });
        }
      }
    }
    return result;
  }
  
  /**
   * Debug: Get metadata summary
   * @returns {Object} Summary statistics
   */
  getSummary() {
    let walkablePlayer = 0;
    let walkableEnemy = 0;
    let blocksLOS = 0;
    let totalCost = 0;
    
    for (let ty = 0; ty < this.grid.height; ty++) {
      for (let tx = 0; tx < this.grid.width; tx++) {
        const meta = this.getMetadata(tx, ty);
        if (meta.walk_player) walkablePlayer++;
        if (meta.walk_enemy) walkableEnemy++;
        if (meta.blocks_los) blocksLOS++;
        if (meta.cost_enemy < Infinity) totalCost += meta.cost_enemy;
      }
    }
    
    return {
      totalTiles: this.grid.width * this.grid.height,
      walkablePlayer,
      walkableEnemy,
      blocksLOS,
      totalCost,
      overrides: this._overrides.size,
      typeModifiers: this._typeModifiers.size
    };
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Create default metadata for a custom tile type
 * @param {Object} options - Metadata options
 * @returns {Object} Tile metadata object
 */
export function createTileMetadata(options = {}) {
  return {
    walk_player: options.walk_player ?? true,
    walk_enemy: options.walk_enemy ?? true,
    blocks_los: options.blocks_los ?? false,
    cost_enemy: options.cost_enemy ?? 1.0,
    ...options
  };
}

// ==================== PREDEFINED TERRAIN COSTS ====================

/**
 * Terrain cost multipliers for pathfinding
 * Higher cost = less preferred path
 */
export const TERRAIN_COSTS = {
  NORMAL: 1.0,
  SLOW: 2.0,      // Slow terrain (optional)
  DANGEROUS: 3.0, // Near detection sources (optional)
  PREFERRED: 0.5  // Preferred patrol path (optional)
};

// ==================== EXPORTS ====================
export default TileMetadata;
