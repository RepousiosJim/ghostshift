/**
 * NavIntegration - Integration layer for GhostShift nav graph system
 * 
 * Phase A: Hooks nav graph into existing AI pathing system.
 * 
 * Features:
 * - Integrates with GuardAI for path-aware behavior
 * - Enforces enemy pathing only on valid walk nodes
 * - Anti-stuck path fallback at nav layer
 * - Room-aware search patterns
 * - Corridor navigation optimization
 * 
 * @module nav/NavIntegration
 */

import { worldToTile, tileToWorld, isInBounds, TILE_SIZE } from '../tile/TileGrid.js';
import { NavGraph, NAV_NODE_TYPES } from './NavGraph.js';
import { PathCheckEngine, PATTERN_TYPES } from './PathCheckEngine.js';
import { RoomSweepGenerator, SWEEP_TYPES } from './RoomSweepGenerator.js';

// ==================== INTEGRATION CONFIG ====================

export const NAV_INTEGRATION_CONFIG = {
  // Anti-stuck
  stuckCheckInterval: 500,       // Ms between stuck checks
  stuckDisplacementThreshold: 5, // Pixels displacement to not be stuck
  stuckRecoveryAttempts: 3,      // Max recovery attempts before fallback
  
  // Path validation
  pathValidationInterval: 200,   // Ms between path validations
  pathReplanThreshold: 3,        // Tiles off path before replan
  
  // Room sweep
  autoSweepOnEnter: true,        // Auto-generate sweep on room entry
  sweepCompletionBonus: 0.5,     // Awareness reduction on sweep complete
  
  // Corridor navigation
  corridorSpeedMultiplier: 1.1,  // Speed boost in corridors
  chokepointCautionMultiplier: 0.9, // Slow down at chokepoints
  
  // Fallback
  fallbackToLegacyPath: true,    // Fall back to legacy pathfinding on failure
  legacyPathThreshold: 2000,     // Ms before falling back to legacy
  
  // Debug
  debug: false
};

// ==================== NAV INTEGRATION CLASS ====================

/**
 * NavIntegration - Main integration class for nav graph system
 */
export class NavIntegration {
  constructor(tileGrid, tileMetadata, config = {}) {
    this.grid = tileGrid;
    this.metadata = tileMetadata;
    this.config = { ...NAV_INTEGRATION_CONFIG, ...config };
    
    // Create nav graph
    this.navGraph = new NavGraph(tileGrid, tileMetadata, { debug: config.debug });
    
    // Create pattern engines
    this.pathCheckEngine = new PathCheckEngine(this.navGraph, tileMetadata, { debug: config.debug });
    this.roomSweepGenerator = new RoomSweepGenerator(this.navGraph, tileMetadata, { debug: config.debug });
    
    // Agent tracking
    this._agents = new Map(); // agentId -> AgentNavState
    
    // Performance tracking
    this._stats = {
      pathsValidated: 0,
      pathsReplanned: 0,
      stuckRecoveries: 0,
      roomSweepsStarted: 0,
      roomSweepsCompleted: 0
    };
  }
  
  // ==================== AGENT MANAGEMENT ====================
  
  /**
   * Register an agent for nav tracking
   * @param {string} agentId - Unique agent identifier
   * @param {Object} options - Agent options
   */
  registerAgent(agentId, options = {}) {
    this._agents.set(agentId, {
      id: agentId,
      currentTile: null,
      currentRoom: null,
      currentNodeType: null,
      currentPath: null,
      currentPathIndex: 0,
      lastPosition: null,
      lastPositionTime: 0,
      stuckCheckTime: 0,
      stuckRecoveryAttempts: 0,
      activePattern: null,
      activeSweep: null,
      sweepIndex: 0,
      lastNodeType: null,
      cameFrom: null,
      ...options
    });
  }
  
  /**
   * Unregister an agent
   * @param {string} agentId
   */
  unregisterAgent(agentId) {
    this._agents.delete(agentId);
  }
  
  /**
   * Get agent state
   * @param {string} agentId
   * @returns {Object|null}
   */
  getAgentState(agentId) {
    return this._agents.get(agentId) || null;
  }
  
  // ==================== PATH VALIDATION ====================
  
  /**
   * Validate and potentially replan agent path
   * Called periodically to ensure agent is on valid path
   * 
   * @param {string} agentId
   * @param {number} worldX - Current world X
   * @param {number} worldY - Current world Y
   * @param {Array} currentPath - Current path (world coords)
   * @returns {Object} Validation result { valid, replanned, newPath }
   */
  validatePath(agentId, worldX, worldY, currentPath) {
    const state = this._agents.get(agentId);
    if (!state) return { valid: true, replanned: false, newPath: currentPath };
    
    this._stats.pathsValidated++;
    
    // Update current tile
    const { tx, ty } = worldToTile(worldX, worldY);
    state.currentTile = { tx, ty };
    
    // Check if we're still on the path
    if (currentPath && currentPath.length > 0) {
      const nearestDist = this._findNearestPathPoint(worldX, worldY, currentPath);
      
      if (nearestDist > this.config.pathReplanThreshold * TILE_SIZE) {
        // Too far from path - may need replan
        this._stats.pathsReplanned++;
        
        if (this.config.debug) {
          console.log(`[NavIntegration] Agent ${agentId} off path by ${nearestDist}px, suggesting replan`);
        }
        
        return {
          valid: false,
          replanned: true,
          newPath: null, // Signal that replan is needed
          reason: 'off_path'
        };
      }
    }
    
    return { valid: true, replanned: false, newPath: currentPath };
  }
  
  /**
   * Find nearest point on path
   * @private
   */
  _findNearestPathPoint(x, y, path) {
    let minDist = Infinity;
    
    for (const point of path) {
      const dx = point.x - x;
      const dy = point.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      minDist = Math.min(minDist, dist);
    }
    
    return minDist;
  }
  
  // ==================== ANTI-STUCK SYSTEM ====================
  
  /**
   * Check if agent is stuck and provide recovery path
   * 
   * @param {string} agentId
   * @param {number} worldX - Current world X
   * @param {number} worldY - Current world Y
   * @param {number} targetX - Target world X
   * @param {number} targetY - Target world Y
   * @param {number} now - Current timestamp
   * @returns {Object} { isStuck, recoveryPath, recoveryWaypoint }
   */
  checkStuck(agentId, worldX, worldY, targetX, targetY, now = Date.now()) {
    const state = this._agents.get(agentId);
    if (!state) return { isStuck: false, recoveryPath: null, recoveryWaypoint: null };
    
    // Check displacement
    let displacement = 0;
    if (state.lastPosition) {
      const dx = worldX - state.lastPosition.x;
      const dy = worldY - state.lastPosition.y;
      displacement = Math.sqrt(dx * dx + dy * dy);
    }
    
    // Update position tracking
    state.lastPosition = { x: worldX, y: worldY };
    
    // Check if stuck (insufficient displacement over interval)
    if (now - state.stuckCheckTime < this.config.stuckCheckInterval) {
      return { isStuck: false, recoveryPath: null, recoveryWaypoint: null };
    }
    
    state.stuckCheckTime = now;
    
    if (displacement < this.config.stuckDisplacementThreshold) {
      state.stuckRecoveryAttempts++;
      
      if (this.config.debug) {
        console.log(`[NavIntegration] Agent ${agentId} stuck detected (attempt ${state.stuckRecoveryAttempts})`);
      }
      
      // Generate recovery path
      const recovery = this._generateRecoveryPath(agentId, worldX, worldY, targetX, targetY);
      
      if (recovery) {
        this._stats.stuckRecoveries++;
        return {
          isStuck: true,
          recoveryPath: recovery.path,
          recoveryWaypoint: recovery.waypoint,
          attempts: state.stuckRecoveryAttempts
        };
      }
      
      // Max attempts reached - fall back to legacy
      if (state.stuckRecoveryAttempts >= this.config.stuckRecoveryAttempts) {
        return {
          isStuck: true,
          recoveryPath: null,
          recoveryWaypoint: null,
          fallbackToLegacy: true
        };
      }
    } else {
      // Reset attempts if moving
      state.stuckRecoveryAttempts = 0;
    }
    
    return { isStuck: false, recoveryPath: null, recoveryWaypoint: null };
  }
  
  /**
   * Generate recovery path for stuck agent
   * @private
   */
  _generateRecoveryPath(agentId, x, y, targetX, targetY) {
    const { tx, ty } = worldToTile(x, y);
    const node = this.navGraph.getNode(tx, ty);
    
    if (!node) return null;
    
    // Strategy 1: Find alternative route through different neighbor
    const neighbors = node.getNeighborNodes();
    const targetTile = worldToTile(targetX, targetY);
    
    // Sort neighbors by distance to target (prefer closer)
    neighbors.sort((a, b) => {
      const distA = Math.abs(a.tx - targetTile.tx) + Math.abs(a.ty - targetTile.ty);
      const distB = Math.abs(b.tx - targetTile.tx) + Math.abs(b.ty - targetTile.ty);
      return distA - distB;
    });
    
    // Try each neighbor as potential escape
    for (const neighbor of neighbors) {
      // Skip where we came from
      if (state?.cameFrom && 
          neighbor.tx === state.cameFrom.tx && 
          neighbor.ty === state.cameFrom.ty) {
        continue;
      }
      
      // Check if this neighbor leads to target
      if (this.navGraph.hasPath(neighbor.tx, neighbor.ty, targetTile.tx, targetTile.tx)) {
        const world = tileToWorld(neighbor.tx, neighbor.ty);
        return {
          path: [world, { x: targetX, y: targetY }],
          waypoint: world
        };
      }
    }
    
    // Strategy 2: Backtrack to junction/doorway
    const nearestJunction = this.navGraph.findNearestNodeOfType(tx, ty, NAV_NODE_TYPES.JUNCTION);
    if (nearestJunction) {
      const world = tileToWorld(nearestJunction.tx, nearestJunction.ty);
      return {
        path: [world],
        waypoint: world
      };
    }
    
    // Strategy 3: Backtrack to any corridor
    const nearestCorridor = this.navGraph.findNearestNodeOfType(tx, ty, NAV_NODE_TYPES.CORRIDOR);
    if (nearestCorridor) {
      const world = tileToWorld(nearestCorridor.tx, nearestCorridor.ty);
      return {
        path: [world],
        waypoint: world
      };
    }
    
    return null;
  }
  
  // ==================== ROOM SWEEP INTEGRATION ====================
  
  /**
   * Check if agent is entering a room and generate sweep pattern
   * 
   * @param {string} agentId
   * @param {number} worldX - Current world X
   * @param {number} worldY - Current world Y
   * @returns {Object} { enteredRoom, sweepPattern }
   */
  checkRoomEntry(agentId, worldX, worldY) {
    const state = this._agents.get(agentId);
    if (!state) return { enteredRoom: false, sweepPattern: null };
    
    const { tx, ty } = worldToTile(worldX, worldY);
    const room = this.navGraph.getRoomAt(tx, ty);
    
    // Check if room changed
    if (room && room.id !== state.currentRoom) {
      state.currentRoom = room.id;
      state.lastNodeType = state.currentNodeType;
      state.currentNodeType = NAV_NODE_TYPES.ROOM_INTERIOR;
      
      if (this.config.autoSweepOnEnter) {
        // Generate sweep pattern
        const sweep = this.roomSweepGenerator.generateStandardSweep(room.id, tx, ty);
        state.activeSweep = sweep;
        state.sweepIndex = 0;
        
        this._stats.roomSweepsStarted++;
        
        if (this.config.debug) {
          console.log(`[NavIntegration] Agent ${agentId} entered room ${room.id}, starting sweep`);
        }
        
        return {
          enteredRoom: true,
          sweepPattern: sweep,
          roomId: room.id
        };
      }
      
      return { enteredRoom: true, sweepPattern: null };
    }
    
    // Check if exited room
    if (!room && state.currentRoom !== null) {
      state.currentRoom = null;
      state.currentNodeType = this.navGraph.getNode(tx, ty)?.type || NAV_NODE_TYPES.CORRIDOR;
      
      // Cancel active sweep
      if (state.activeSweep) {
        state.activeSweep = null;
        state.sweepIndex = 0;
      }
    }
    
    return { enteredRoom: false, sweepPattern: null };
  }
  
  /**
   * Get next sweep point for agent
   * 
   * @param {string} agentId
   * @returns {Object|null} Next sweep point or null if complete
   */
  getNextSweepPoint(agentId) {
    const state = this._agents.get(agentId);
    if (!state || !state.activeSweep) return null;
    
    if (state.sweepIndex >= state.activeSweep.points.length) {
      // Sweep complete
      this._stats.roomSweepsCompleted++;
      state.activeSweep = null;
      state.sweepIndex = 0;
      return null;
    }
    
    const point = state.activeSweep.points[state.sweepIndex];
    state.sweepIndex++;
    
    return point;
  }
  
  // ==================== SEARCH PATTERN INTEGRATION ====================
  
  /**
   * Start a search pattern for an agent
   * 
   * @param {string} agentId
   * @param {string} patternType - Pattern type from PATTERN_TYPES
   * @param {number} originX - Origin world X
   * @param {number} originY - Origin world Y
   * @param {Object} context - Additional context
   * @returns {Object} Pattern info
   */
  startSearchPattern(agentId, patternType, originX, originY, context = {}) {
    const state = this._agents.get(agentId);
    if (!state) return null;
    
    const { tx, ty } = worldToTile(originX, originY);
    let pattern;
    
    switch (patternType) {
      case PATTERN_TYPES.LANE_SWEEP:
        pattern = this.pathCheckEngine.generateLaneSweep(tx, ty, context.direction);
        break;
      
      case PATTERN_TYPES.BRANCH_CHECK:
        pattern = this.pathCheckEngine.generateBranchCheck(tx, ty, 
          context.cameFromTx, context.cameFromTy);
        break;
      
      case PATTERN_TYPES.EXPANDING_RING:
        pattern = this.pathCheckEngine.generateExpandingRing(tx, ty, context.maxRadius);
        break;
      
      case 'auto':
      default:
        pattern = this.pathCheckEngine.getBestPattern(tx, ty, context);
    }
    
    this.pathCheckEngine.startPattern(agentId, pattern);
    state.activePattern = pattern;
    
    if (this.config.debug) {
      console.log(`[NavIntegration] Agent ${agentId} started ${pattern.type} pattern`);
    }
    
    return {
      type: pattern.type,
      pointCount: pattern.points.length,
      origin: pattern.origin
    };
  }
  
  /**
   * Get next search pattern point
   * 
   * @param {string} agentId
   * @returns {Object|null} Next point or null if complete
   */
  getNextSearchPoint(agentId) {
    return this.pathCheckEngine.getNextPatternPoint(agentId);
  }
  
  /**
   * Cancel search pattern
   * @param {string} agentId
   */
  cancelSearchPattern(agentId) {
    this.pathCheckEngine.cancelPattern(agentId);
    const state = this._agents.get(agentId);
    if (state) {
      state.activePattern = null;
    }
  }
  
  // ==================== NODE TYPE AWARENESS ====================
  
  /**
   * Get current node type for agent
   * 
   * @param {string} agentId
   * @param {number} worldX
   * @param {number} worldY
   * @returns {Object} { nodeType, speedMultiplier, strategic }
   */
  getNodeContext(agentId, worldX, worldY) {
    const { tx, ty } = worldToTile(worldX, worldY);
    const node = this.navGraph.getNode(tx, ty);
    
    if (!node) {
      return {
        nodeType: NAV_NODE_TYPES.CORRIDOR,
        speedMultiplier: 1,
        strategic: false
      };
    }
    
    const state = this._agents.get(agentId);
    if (state) {
      state.lastNodeType = state.currentNodeType;
      state.currentNodeType = node.type;
      state.cameFrom = state.currentTile;
      state.currentTile = { tx, ty };
    }
    
    // Calculate speed multiplier based on node type
    let speedMultiplier = 1;
    let strategic = false;
    
    switch (node.type) {
      case NAV_NODE_TYPES.CORRIDOR:
        speedMultiplier = this.config.corridorSpeedMultiplier;
        break;
      
      case NAV_NODE_TYPES.CHOKEPOINT:
        speedMultiplier = this.config.chokepointCautionMultiplier;
        strategic = true;
        break;
      
      case NAV_NODE_TYPES.DOORWAY:
        strategic = true;
        break;
      
      case NAV_NODE_TYPES.JUNCTION:
        strategic = true;
        break;
    }
    
    return {
      nodeType: node.type,
      speedMultiplier,
      strategic,
      connections: node.connections,
      strategicValue: node.strategicValue
    };
  }
  
  // ==================== WALKABILITY ENFORCEMENT ====================
  
  /**
   * Check if a position is valid for enemy movement
   * Enforces enemy pathing only on valid walk nodes
   * 
   * @param {number} worldX
   * @param {number} worldY
   * @returns {boolean}
   */
  isValidEnemyPosition(worldX, worldY) {
    const { tx, ty } = worldToTile(worldX, worldY);
    
    // Check tile metadata
    if (!this.metadata.canEnemyWalk(tx, ty)) {
      return false;
    }
    
    // Check nav graph has a node here
    const node = this.navGraph.getNode(tx, ty);
    return node !== null && node.isWalkable;
  }
  
  /**
   * Find nearest valid position for enemy
   * 
   * @param {number} worldX
   * @param {number} worldY
   * @param {number} maxRadius - Maximum search radius in tiles
   * @returns {Object|null} { x, y, tx, ty } or null
   */
  findNearestValidPosition(worldX, worldY, maxRadius = 5) {
    const { tx, ty } = worldToTile(worldX, worldY);
    
    // Check current position
    if (this.isValidEnemyPosition(worldX, worldY)) {
      return { x: worldX, y: worldY, tx, ty };
    }
    
    // Spiral search
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          
          const checkTx = tx + dx;
          const checkTy = ty + dy;
          
          if (this.metadata.canEnemyWalk(checkTx, checkTy)) {
            const world = tileToWorld(checkTx, checkTy);
            return { x: world.x, y: world.y, tx: checkTx, ty: checkTy };
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Validate and clamp a path to walkable nodes only
   * 
   * @param {Array} path - Path as world coordinates
   * @returns {Array} Validated path
   */
  validatePath(path) {
    if (!path || path.length === 0) return path;
    
    const validatedPath = [];
    
    for (const point of path) {
      if (this.isValidEnemyPosition(point.x, point.y)) {
        validatedPath.push(point);
      } else {
        // Try to find nearest valid position
        const nearest = this.findNearestValidPosition(point.x, point.y, 3);
        if (nearest) {
          validatedPath.push({ x: nearest.x, y: nearest.y });
        }
        // If no valid position found, skip this point
      }
    }
    
    return validatedPath;
  }
  
  // ==================== STATISTICS ====================
  
  /**
   * Get integration statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this._stats,
      navGraph: this.navGraph.getStats(),
      pathCheck: this.pathCheckEngine.getStats(),
      activeAgents: this._agents.size
    };
  }
  
  /**
   * Get nav graph for debugging
   * @returns {NavGraph}
   */
  getNavGraph() {
    return this.navGraph;
  }
  
  /**
   * Rebuild nav graph (call when level changes)
   */
  rebuildGraph() {
    this.navGraph.buildGraph();
    
    // Clear agent states
    for (const [id, state] of this._agents) {
      state.currentTile = null;
      state.currentRoom = null;
      state.currentPath = null;
      state.activePattern = null;
      state.activeSweep = null;
    }
  }
}

export default NavIntegration;
