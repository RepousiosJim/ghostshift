/**
 * Tile Module Index - Exports for GhostShift tile navigation system
 * 
 * Phase A/B: Foundation for tile-locked navigation.
 * 
 * Usage:
 * ```javascript
 * import { createTileSystem, USE_TILE_AI } from './tile/index.js';
 * 
 * if (USE_TILE_AI) {
 *   const tileSystem = createTileSystem(levelLayout);
 *   // Use tileSystem.pathfinder, tileSystem.agentManager, etc.
 * }
 * ```
 * 
 * @module tile/index
 */

// ==================== FEATURE FLAG ====================

/**
 * Feature flag to enable tile-based AI navigation
 * When false, uses legacy continuous movement system
 */
export const USE_TILE_AI = false; // Default: off, enable after testing

/**
 * Debug mode for tile system
 */
export const TILE_DEBUG = false;

// ==================== RE-EXPORTS ====================

// TileGrid module
export {
  TileGrid,
  TILE_SIZE,
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_TYPES,
  worldToTile,
  tileToWorld,
  tileToWorldCorner,
  snapToTileCenter,
  isInBounds,
  manhattanDistance,
  chebyshevDistance,
  euclideanDistance
} from './TileGrid.js';

// TileMetadata module
export {
  TileMetadata,
  DEFAULT_TILE_METADATA,
  createTileMetadata,
  TERRAIN_COSTS
} from './TileMetadata.js';

// Pathfinder module
export {
  Pathfinder,
  PATHFINDER_CONFIG,
  PriorityQueue
} from './Pathfinder.js';

// TileMovement module
export {
  TileAgent,
  TileMovementManager,
  TILE_MOVEMENT_CONFIG
} from './TileMovement.js';

// ==================== FACTORY FUNCTION ====================

import { TileGrid } from './TileGrid.js';
import { TileMetadata } from './TileMetadata.js';
import { Pathfinder, PATHFINDER_CONFIG } from './Pathfinder.js';
import { TileMovementManager, TILE_MOVEMENT_CONFIG } from './TileMovement.js';

/**
 * Create a complete tile navigation system
 * @param {Object} levelLayout - Level layout from LEVEL_LAYOUTS
 * @param {Object} options - Optional configuration
 * @returns {Object} Tile system with all components
 */
export function createTileSystem(levelLayout, options = {}) {
  // Create tile grid
  const tileGrid = new TileGrid(levelLayout);
  
  // Create metadata manager
  const tileMetadata = new TileMetadata(tileGrid);
  
  // Create pathfinder with config
  const pathfinderConfig = { ...PATHFINDER_CONFIG, ...options.pathfinder };
  if (options.debug !== undefined) pathfinderConfig.debug = options.debug;
  const pathfinder = new Pathfinder(tileGrid, tileMetadata, pathfinderConfig);
  
  // Create movement manager
  const movementConfig = { ...TILE_MOVEMENT_CONFIG, ...options.movement };
  if (options.debug !== undefined) movementConfig.debug = options.debug;
  const agentManager = new TileMovementManager(tileGrid, tileMetadata, pathfinder);
  agentManager.config = movementConfig;
  
  return {
    tileGrid,
    tileMetadata,
    pathfinder,
    agentManager,
    
    /**
     * Clean up all resources
     */
    destroy() {
      agentManager.clear();
      pathfinder.clearCache();
    },
    
    /**
     * Get system statistics
     */
    getStats() {
      return {
        pathfinder: pathfinder.getStats(),
        metadata: tileMetadata.getSummary(),
        agents: agentManager.agents.size
      };
    }
  };
}

// ==================== INTEGRATION HELPERS ====================

/**
 * Convert patrol points from world to tile coordinates
 * @param {Array<{x: number, y: number}>} worldPoints - World coordinate points
 * @returns {Array<{tx: number, ty: number}>} Tile coordinate points
 */
export function convertPatrolToTile(worldPoints) {
  return worldPoints.map(p => {
    const tile = worldToTile(p.x, p.y);
    return { tx: tile.tx, ty: tile.ty };
  });
}

/**
 * Check if tile system should be used based on feature flag
 * @returns {boolean}
 */
export function isTileAIEnabled() {
  return USE_TILE_AI;
}

// ==================== DEFAULT EXPORT ====================
export default {
  USE_TILE_AI,
  TILE_DEBUG,
  createTileSystem,
  convertPatrolToTile,
  isTileAIEnabled
};
