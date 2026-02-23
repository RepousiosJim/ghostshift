/**
 * Tile Module Index - Exports for GhostShift tile navigation system
 * 
 * ## P0 STABILIZATION STATUS
 * ========================
 * Feature Flag: USE_TILE_AI = false (LEGACY MODE ACTIVE)
 * 
 * Decision Rationale:
 * - Legacy continuous movement system is STABLE and WELL-TESTED
 * - Legacy includes robust anti-stuck mechanisms (Phase 16):
 *   - Time-window stuck detection
 *   - Flip-flop oscillation prevention
 *   - Temporary waypoint creation
 *   - Narrow corridor handling
 * - Tile system remains available for future enablement
 * 
 * To enable tile-based navigation:
 * 1. Set USE_TILE_AI = true below
 * 2. Run: npm run verify:p0
 * 3. Run: npm run test:e2e
 * 4. Verify no regressions in guard behavior
 * 
 * Rollback: Set USE_TILE_AI = false
 * 
 * ## Architecture
 * Phase A/B: Foundation for tile-locked navigation.
 * 
 * Usage:
 * ```javascript
 * import { createTileSystem, USE_TILE_AI, setTileAIEnabled } from './tile/index.js';
 * 
 * if (USE_TILE_AI) {
 *   const tileSystem = createTileSystem(levelLayout);
 *   // Use tileSystem.pathfinder, tileSystem.agentManager, etc.
 * }
 * 
 * // Runtime toggle (for debugging)
 * setTileAIEnabled(true); // or false
 * ```
 * 
 * @module tile/index
 */

// ==================== FEATURE FLAG ====================

/**
 * Feature flag to enable tile-based AI navigation
 * 
 * VALUES:
 * - false: Use legacy continuous movement (RECOMMENDED for stability)
 * - true: Use tile-based A* pathfinding (EXPERIMENTAL)
 * 
 * @type {boolean}
 */
let _USE_TILE_AI = false;

/**
 * Get current tile AI state
 * @returns {boolean}
 */
export function isTileAIEnabled() {
  // Also check window for runtime override
  if (typeof window !== 'undefined' && window.GHOSTSHIFT_FORCE_TILE_AI !== undefined) {
    return window.GHOSTSHIFT_FORCE_TILE_AI;
  }
  return _USE_TILE_AI;
}

/**
 * Set tile AI state (runtime toggle for debugging)
 * WARNING: Only use during development/debugging
 * @param {boolean} enabled
 */
export function setTileAIEnabled(enabled) {
  _USE_TILE_AI = enabled;
  if (typeof window !== 'undefined') {
    window.GHOSTSHIFT_USE_TILE_AI = enabled;
  }
  console.log(`[TileSystem] AI mode set to: ${enabled ? 'TILE-BASED' : 'LEGACY'}`);
}

// Export getter as pseudo-constant for backward compatibility
export const USE_TILE_AI = new Proxy({}, {
  get: () => isTileAIEnabled()
});

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

// ==================== DEFAULT EXPORT ====================
export default {
  USE_TILE_AI,
  TILE_DEBUG,
  createTileSystem,
  convertPatrolToTile,
  isTileAIEnabled,
  setTileAIEnabled
};
