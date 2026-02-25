/**
 * Nav Module Index - Navigation graph system for GhostShift
 * 
 * Phase A: Enemy AI navigation overhaul with nav graph + room/path-check engine.
 * 
 * Architecture:
 * - NavGraph: Tile-derived navigation graph with semantic node types
 * - PathCheckEngine: Search pattern generators (lane sweep, branch check, expanding ring)
 * - RoomSweepGenerator: Room sweep route generator (doorway -> corners -> center -> exit)
 * - NavIntegration: Integration layer with existing AI pathing hooks
 * 
 * Usage:
 * ```javascript
 * import { createNavSystem } from './nav/index.js';
 * 
 * // Create nav system from tile grid
 * const navSystem = createNavSystem(tileGrid, tileMetadata, { debug: true });
 * 
 * // Register agents
 * navSystem.registerAgent('guard1');
 * 
 * // Check node context
 * const context = navSystem.getNodeContext('guard1', guard.x, guard.y);
 * 
 * // Start search pattern
 * navSystem.startSearchPattern('guard1', 'expanding_ring', playerLastSeen.x, playerLastSeen.y);
 * 
 * // Get next search point
 * const nextPoint = navSystem.getNextSearchPoint('guard1');
 * ```
 * 
 * Integration with GuardAI:
 * - NavIntegration provides hooks that can be called from GuardAI.update()
 * - Anti-stuck system works at nav layer for more intelligent recovery
 * - Room sweep patterns integrate with search state
 * 
 * @module nav/index
 */

// ==================== RE-EXPORTS ====================

// NavGraph
export {
  NavGraph,
  NavNode,
  NAV_NODE_TYPES,
  NODE_TYPE_PRIORITIES,
  NAV_GRAPH_CONFIG
} from './NavGraph.js';

// PathCheckEngine
export {
  PathCheckEngine,
  SearchPattern,
  PATTERN_TYPES,
  PATH_CHECK_CONFIG
} from './PathCheckEngine.js';

// RoomSweepGenerator
export {
  RoomSweepGenerator,
  SWEEP_TYPES,
  ROOM_SWEEP_CONFIG
} from './RoomSweepGenerator.js';

// NavIntegration
export {
  NavIntegration,
  NAV_INTEGRATION_CONFIG
} from './NavIntegration.js';

// ==================== FACTORY FUNCTION ====================

import { NavGraph, NAV_GRAPH_CONFIG } from './NavGraph.js';
import { PathCheckEngine, PATH_CHECK_CONFIG } from './PathCheckEngine.js';
import { RoomSweepGenerator, ROOM_SWEEP_CONFIG } from './RoomSweepGenerator.js';
import { NavIntegration, NAV_INTEGRATION_CONFIG } from './NavIntegration.js';

/**
 * Create a complete nav system
 * @param {TileGrid} tileGrid - Tile grid instance
 * @param {TileMetadata} tileMetadata - Tile metadata instance
 * @param {Object} options - Configuration options
 * @returns {NavIntegration} Nav integration instance
 */
export function createNavSystem(tileGrid, tileMetadata, options = {}) {
  const config = {
    ...NAV_GRAPH_CONFIG,
    ...PATH_CHECK_CONFIG,
    ...ROOM_SWEEP_CONFIG,
    ...NAV_INTEGRATION_CONFIG,
    ...options
  };
  
  return new NavIntegration(tileGrid, tileMetadata, config);
}

/**
 * Create a nav graph (lower-level API)
 * @param {TileGrid} tileGrid
 * @param {TileMetadata} tileMetadata
 * @param {Object} options
 * @returns {NavGraph}
 */
export function createNavGraph(tileGrid, tileMetadata, options = {}) {
  return new NavGraph(tileGrid, tileMetadata, options);
}

/**
 * Create a path check engine (lower-level API)
 * @param {NavGraph} navGraph
 * @param {TileMetadata} tileMetadata
 * @param {Object} options
 * @returns {PathCheckEngine}
 */
export function createPathCheckEngine(navGraph, tileMetadata, options = {}) {
  return new PathCheckEngine(navGraph, tileMetadata, options);
}

/**
 * Create a room sweep generator (lower-level API)
 * @param {NavGraph} navGraph
 * @param {TileMetadata} tileMetadata
 * @param {Object} options
 * @returns {RoomSweepGenerator}
 */
export function createRoomSweepGenerator(navGraph, tileMetadata, options = {}) {
  return new RoomSweepGenerator(navGraph, tileMetadata, options);
}

// ==================== HELPER FUNCTIONS ====================

import { worldToTile, tileToWorld } from '../tile/TileGrid.js';

/**
 * Convert world coordinates to nav-friendly format
 * @param {number} x - World X
 * @param {number} y - World Y
 * @returns {{tx: number, ty: number}}
 */
export function toNavCoords(x, y) {
  return worldToTile(x, y);
}

/**
 * Convert nav coordinates to world
 * @param {number} tx - Tile X
 * @param {number} ty - Tile Y
 * @returns {{x: number, y: number}}
 */
export function toWorldCoords(tx, ty) {
  return tileToWorld(tx, ty);
}

/**
 * Determine best search pattern for a situation
 * @param {string} nodeType - Current node type
 * @param {Object} context - Context info
 * @returns {string} Pattern type
 */
export function getBestPatternForSituation(nodeType, context = {}) {
  // If we have last known position, use expanding ring
  if (context.lastSeenTx !== undefined) {
    return 'expanding_ring';
  }
  
  // Otherwise, choose based on node type
  switch (nodeType) {
    case 'junction':
      return 'branch_check';
    case 'corridor':
    case 'chokepoint':
      return 'lane_sweep';
    case 'room_interior':
      return 'expanding_ring';
    case 'doorway':
      return 'corridor_search';
    default:
      return 'expanding_ring';
  }
}

// ==================== DEFAULT EXPORT ====================

export default {
  createNavSystem,
  createNavGraph,
  createPathCheckEngine,
  createRoomSweepGenerator,
  toNavCoords,
  toWorldCoords,
  getBestPatternForSituation
};
