/**
 * TileMovement - Tile-constrained movement for enemies
 * 
 * Phase B: Migrate enemy movement to tile-locked navigation.
 * Features:
 * - Tile-to-tile movement with interpolation
 * - No blocked tile occupancy
 * - Smooth visual transitions
 * - Legacy fallback support
 * 
 * @module tile/TileMovement
 */

import { 
  worldToTile, 
  tileToWorld, 
  isInBounds,
  TILE_SIZE 
} from './TileGrid.js';
import { TileMetadata } from './TileMetadata.js';
import { Pathfinder } from './Pathfinder.js';

// ==================== CONFIGURATION ====================

export const TILE_MOVEMENT_CONFIG = {
  // Movement speed in tiles per second
  tilesPerSecond: 3.0,
  
  // Interpolation easing function: 'linear', 'easeOut', 'easeInOut'
  easing: 'linear',
  
  // Arrival threshold (in pixels) to consider waypoint reached
  arrivalThreshold: 4,
  
  // Stuck detection: frames without progress before recalculating
  stuckFrames: 30,
  
  // Minimum distance to goal before path recalculation
  pathRecalcDistance: 1.5,
  
  // Enable debug visualization
  debug: false
};

// ==================== EASING FUNCTIONS ====================

const EASING_FUNCTIONS = {
  linear: (t) => t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
};

// ==================== TILE AGENT CLASS ====================

/**
 * TileAgent - Represents an entity that moves on the tile grid
 */
export class TileAgent {
  /**
   * Create a new tile agent
   * @param {Object} options - Agent options
   * @param {number} options.startTx - Starting tile X
   * @param {number} options.startTy - Starting tile Y
   * @param {TileGrid} options.tileGrid - Tile grid reference
   * @param {TileMetadata} options.tileMetadata - Tile metadata reference
   * @param {Pathfinder} options.pathfinder - Pathfinder reference
   * @param {string} options.agentId - Unique agent ID
   * @param {Object} options.config - Config overrides
   */
  constructor(options) {
    this.tileGrid = options.tileGrid;
    this.metadata = options.tileMetadata;
    this.pathfinder = options.pathfinder;
    this.agentId = options.agentId || `agent_${Date.now()}`;
    this.config = { ...TILE_MOVEMENT_CONFIG, ...options.config };
    
    // Current position (tile coordinates)
    this.tx = options.startTx;
    this.ty = options.startTy;
    
    // World position (for interpolation)
    const worldPos = tileToWorld(this.tx, this.ty);
    this.worldX = worldPos.x;
    this.worldY = worldPos.y;
    
    // Target position
    this.targetTx = this.tx;
    this.targetTy = this.ty;
    this.targetWorldX = this.worldX;
    this.targetWorldY = this.worldY;
    
    // Movement state
    this.isMoving = false;
    this.moveProgress = 0;
    this.moveStartX = this.worldX;
    this.moveStartY = this.worldY;
    
    // Current path
    this.currentPath = null;
    this.currentWaypointIndex = 0;
    
    // Stuck detection
    this._stuckCounter = 0;
    this._lastWorldX = this.worldX;
    this._lastWorldY = this.worldY;
    
    // Blocked tile management
    this._isBlocking = false;
    this._blockedTiles = new Set();
    
    // Patrol state
    this.patrolPoints = [];
    this.currentPatrolIndex = 0;
    
    // Debug visualization
    this._debugGraphics = null;
  }
  
  /**
   * Set patrol points (tile coordinates)
   * @param {Array<{tx: number, ty: number}>} points - Patrol points
   */
  setPatrolPoints(points) {
    this.patrolPoints = points.map(p => ({
      tx: p.tx !== undefined ? p.tx : p.x,
      ty: p.ty !== undefined ? p.ty : p.y
    }));
    this.currentPatrolIndex = 0;
  }
  
  /**
   * Set patrol points from world coordinates
   * @param {Array<{x: number, y: number}>} points - World coordinate points
   */
  setPatrolPointsWorld(points) {
    this.patrolPoints = points.map(p => worldToTile(p.x, p.y));
    this.currentPatrolIndex = 0;
  }
  
  /**
   * Update agent position and movement
   * @param {number} delta - Delta time in milliseconds
   * @returns {{x: number, y: number, arrived: boolean}} New world position and arrival status
   */
  update(delta) {
    if (!this.isMoving) {
      // Not moving, check if we have a path to follow
      if (this.currentPath && this.currentWaypointIndex < this.currentPath.length) {
        this._startNextWaypoint();
      } else {
        // No path, stay in place
        return { x: this.worldX, y: this.worldY, arrived: true };
      }
    }
    
    // Update movement progress
    const deltaTimeSeconds = delta / 1000;
    const moveSpeed = this.config.tilesPerSecond;
    const tilesPerMs = moveSpeed / 1000;
    const distancePerFrame = tilesPerMs * delta;
    
    // Calculate total distance and direction
    const dx = this.targetWorldX - this.moveStartX;
    const dy = this.targetWorldY - this.moveStartY;
    const totalDistance = Math.sqrt(dx * dx + dy * dy);
    
    if (totalDistance < 0.1) {
      // Already at target
      this._completeMovement();
      return { x: this.worldX, y: this.worldY, arrived: true };
    }
    
    // Update progress
    const progressDelta = (distancePerFrame * TILE_SIZE) / totalDistance;
    this.moveProgress = Math.min(1, this.moveProgress + progressDelta);
    
    // Apply easing
    const easedProgress = EASING_FUNCTIONS[this.config.easing](this.moveProgress);
    
    // Interpolate position
    this.worldX = this.moveStartX + dx * easedProgress;
    this.worldY = this.moveStartY + dy * easedProgress;
    
    // Check for arrival
    if (this.moveProgress >= 1) {
      this._completeMovement();
      return { x: this.worldX, y: this.worldY, arrived: true };
    }
    
    // Stuck detection
    this._checkStuck();
    
    return { x: this.worldX, y: this.worldY, arrived: false };
  }
  
  /**
   * Move to a target position (world coordinates)
   * @param {number} targetX - Target world X
   * @param {number} targetY - Target world Y
   * @returns {boolean} True if path found
   */
  moveTo(targetX, targetY) {
    const target = worldToTile(targetX, targetY);
    return this.moveToTile(target.tx, target.ty);
  }
  
  /**
   * Move to a target tile
   * @param {number} targetTx - Target tile X
   * @param {number} targetTy - Target tile Y
   * @returns {boolean} True if path found
   */
  moveToTile(targetTx, targetTy) {
    // Find path
    const path = this.pathfinder.findPath(this.tx, this.ty, targetTx, targetTy);
    
    if (!path || path.length === 0) {
      if (this.config.debug) {
        console.warn(`[TileAgent ${this.agentId}] No path to (${targetTx}, ${targetTy})`);
      }
      return false;
    }
    
    this.currentPath = path;
    this.currentWaypointIndex = 0;
    
    // Start moving to first waypoint
    this._startNextWaypoint();
    
    return true;
  }
  
  /**
   * Follow patrol path
   * @returns {boolean} True if moving to next patrol point
   */
  followPatrol() {
    if (this.patrolPoints.length === 0) return false;
    
    const target = this.patrolPoints[this.currentPatrolIndex];
    const moving = this.moveToTile(target.tx, target.ty);
    
    return moving;
  }
  
  /**
   * Advance to next patrol point
   */
  advancePatrol() {
    if (this.patrolPoints.length === 0) return;
    
    this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
  }
  
  /**
   * Stop current movement
   */
  stop() {
    this.isMoving = false;
    this.currentPath = null;
    this.currentWaypointIndex = 0;
  }
  
  /**
   * Force recalculate path (e.g., after obstacle change)
   */
  recalculatePath() {
    if (this.currentPath && this.currentWaypointIndex < this.currentPath.length) {
      const finalTarget = this.currentPath[this.currentPath.length - 1];
      this.moveToTile(finalTarget.tx, finalTarget.ty);
    }
  }
  
  // ==================== PRIVATE METHODS ====================
  
  /**
   * Start moving to next waypoint in path
   * @private
   */
  _startNextWaypoint() {
    if (!this.currentPath || this.currentWaypointIndex >= this.currentPath.length) {
      this.isMoving = false;
      return;
    }
    
    const waypoint = this.currentPath[this.currentWaypointIndex];
    
    // Clear previous blocked tile
    this._clearBlockedTiles();
    
    // Set new target
    this.targetTx = waypoint.tx;
    this.targetTy = waypoint.ty;
    const worldPos = tileToWorld(this.targetTx, this.targetTy);
    this.targetWorldX = worldPos.x;
    this.targetWorldY = worldPos.y;
    
    // Initialize movement
    this.moveStartX = this.worldX;
    this.moveStartY = this.worldY;
    this.moveProgress = 0;
    this.isMoving = true;
    
    // Mark target tile as blocked
    this._markTileBlocked(this.targetTx, this.targetTy);
    
    if (this.config.debug) {
      console.log(`[TileAgent ${this.agentId}] Moving to waypoint ${this.currentWaypointIndex}: (${this.targetTx}, ${this.targetTy})`);
    }
  }
  
  /**
   * Complete current movement
   * @private
   */
  _completeMovement() {
    // Snap to exact tile center
    const worldPos = tileToWorld(this.targetTx, this.targetTy);
    this.worldX = worldPos.x;
    this.worldY = worldPos.y;
    this.tx = this.targetTx;
    this.ty = this.targetTy;
    
    this.isMoving = false;
    this.moveProgress = 0;
    
    // Clear blocked tiles for old position
    this._clearBlockedTiles();
    
    // Mark current tile as blocked
    this._markTileBlocked(this.tx, this.ty);
    
    // Advance waypoint index
    if (this.currentPath) {
      this.currentWaypointIndex++;
      
      // Check if reached final waypoint
      if (this.currentWaypointIndex >= this.currentPath.length) {
        // Path complete
        this.currentPath = null;
        this.currentWaypointIndex = 0;
        
        if (this.config.debug) {
          console.log(`[TileAgent ${this.agentId}] Reached destination`);
        }
      }
    }
    
    // Reset stuck counter
    this._stuckCounter = 0;
  }
  
  /**
   * Check if agent is stuck
   * @private
   */
  _checkStuck() {
    const dx = this.worldX - this._lastWorldX;
    const dy = this.worldY - this._lastWorldY;
    const moved = Math.sqrt(dx * dx + dy * dy);
    
    if (moved < 0.5) {
      this._stuckCounter++;
      
      if (this._stuckCounter >= this.config.stuckFrames) {
        if (this.config.debug) {
          console.warn(`[TileAgent ${this.agentId}] Stuck detected, recalculating path`);
        }
        this._stuckCounter = 0;
        this.recalculatePath();
      }
    } else {
      this._stuckCounter = 0;
    }
    
    this._lastWorldX = this.worldX;
    this._lastWorldY = this.worldY;
  }
  
  /**
   * Mark a tile as blocked by this agent
   * @private
   */
  _markTileBlocked(tx, ty) {
    const key = `${tx},${ty}`;
    if (!this._blockedTiles.has(key)) {
      this._blockedTiles.add(key);
      this.metadata.markBlocked(tx, ty, this.agentId);
    }
    this._isBlocking = true;
  }
  
  /**
   * Clear all blocked tiles for this agent
   * @private
   */
  _clearBlockedTiles() {
    for (const key of this._blockedTiles) {
      const [tx, ty] = key.split(',').map(Number);
      this.metadata.clearBlocked(tx, ty, this.agentId);
    }
    this._blockedTiles.clear();
    this._isBlocking = false;
  }
  
  // ==================== UTILITY METHODS ====================
  
  /**
   * Get current world position
   * @returns {{x: number, y: number}}
   */
  getPosition() {
    return { x: this.worldX, y: this.worldY };
  }
  
  /**
   * Get current tile position
   * @returns {{tx: number, ty: number}}
   */
  getTilePosition() {
    return { tx: this.tx, ty: this.ty };
  }
  
  /**
   * Check if agent has reached destination
   * @returns {boolean}
   */
  hasArrived() {
    return !this.isMoving && (!this.currentPath || this.currentWaypointIndex >= this.currentPath.length);
  }
  
  /**
   * Get distance to target (in tiles)
   * @returns {number}
   */
  getDistanceToTarget() {
    if (!this.currentPath || this.currentWaypointIndex >= this.currentPath.length) {
      return 0;
    }
    const target = this.currentPath[this.currentPath.length - 1];
    return Math.abs(target.tx - this.tx) + Math.abs(target.ty - this.ty);
  }
  
  /**
   * Set movement speed
   * @param {number} tilesPerSecond - Speed in tiles per second
   */
  setSpeed(tilesPerSecond) {
    this.config.tilesPerSecond = tilesPerSecond;
  }
  
  /**
   * Teleport to a position (no pathfinding)
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   */
  teleport(tx, ty) {
    this._clearBlockedTiles();
    
    this.tx = tx;
    this.ty = ty;
    const worldPos = tileToWorld(tx, ty);
    this.worldX = worldPos.x;
    this.worldY = worldPos.y;
    
    this.targetTx = tx;
    this.targetTy = ty;
    this.targetWorldX = this.worldX;
    this.targetWorldY = this.worldY;
    
    this.isMoving = false;
    this.moveProgress = 0;
    this.currentPath = null;
    this.currentWaypointIndex = 0;
    
    this._markTileBlocked(tx, ty);
  }
  
  /**
   * Clean up agent resources
   */
  destroy() {
    this._clearBlockedTiles();
    if (this._debugGraphics) {
      this._debugGraphics.destroy();
      this._debugGraphics = null;
    }
  }
  
  /**
   * Debug: Get agent state
   * @returns {Object}
   */
  getState() {
    return {
      agentId: this.agentId,
      tile: { tx: this.tx, ty: this.ty },
      world: { x: this.worldX, y: this.worldY },
      target: { tx: this.targetTx, ty: this.targetTy },
      isMoving: this.isMoving,
      pathLength: this.currentPath ? this.currentPath.length : 0,
      waypointIndex: this.currentWaypointIndex,
      stuckCounter: this._stuckCounter
    };
  }
}

// ==================== TILE MOVEMENT MANAGER ====================

/**
 * TileMovementManager - Manages all tile agents
 */
export class TileMovementManager {
  /**
   * Create a new manager
   * @param {TileGrid} tileGrid - Tile grid reference
   * @param {TileMetadata} tileMetadata - Tile metadata reference
   * @param {Pathfinder} pathfinder - Pathfinder reference
   */
  constructor(tileGrid, tileMetadata, pathfinder) {
    this.tileGrid = tileGrid;
    this.metadata = tileMetadata;
    this.pathfinder = pathfinder;
    
    // Agent registry
    this.agents = new Map();
    
    // Global config
    this.config = { ...TILE_MOVEMENT_CONFIG };
  }
  
  /**
   * Create a new agent
   * @param {string} agentId - Unique agent ID
   * @param {number} startTx - Starting tile X
   * @param {number} startTy - Starting tile Y
   * @param {Object} config - Optional config overrides
   * @returns {TileAgent} The created agent
   */
  createAgent(agentId, startTx, startTy, config = {}) {
    if (this.agents.has(agentId)) {
      console.warn(`[TileMovementManager] Agent ${agentId} already exists`);
      return this.agents.get(agentId);
    }
    
    const agent = new TileAgent({
      startTx,
      startTy,
      tileGrid: this.tileGrid,
      tileMetadata: this.metadata,
      pathfinder: this.pathfinder,
      agentId,
      config: { ...this.config, ...config }
    });
    
    this.agents.set(agentId, agent);
    return agent;
  }
  
  /**
   * Get an agent by ID
   * @param {string} agentId - Agent ID
   * @returns {TileAgent|undefined}
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }
  
  /**
   * Remove an agent
   * @param {string} agentId - Agent ID
   */
  removeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.destroy();
      this.agents.delete(agentId);
    }
  }
  
  /**
   * Update all agents
   * @param {number} delta - Delta time in milliseconds
   */
  update(delta) {
    for (const agent of this.agents.values()) {
      agent.update(delta);
    }
  }
  
  /**
   * Clear all agents
   */
  clear() {
    for (const agent of this.agents.values()) {
      agent.destroy();
    }
    this.agents.clear();
  }
  
  /**
   * Get all agent positions
   * @returns {Map<string, {x: number, y: number}>}
   */
  getAllPositions() {
    const positions = new Map();
    for (const [id, agent] of this.agents) {
      positions.set(id, agent.getPosition());
    }
    return positions;
  }
  
  /**
   * Invalidate paths for all agents near a changed tile
   * @param {number} tx - Changed tile X
   * @param {number} ty - Changed tile Y
   */
  invalidatePathsNear(tx, ty) {
    this.pathfinder.invalidateTile(tx, ty);
    
    // Recalculate paths for agents whose paths involve this tile
    for (const agent of this.agents.values()) {
      if (agent.currentPath) {
        for (const waypoint of agent.currentPath) {
          if (waypoint.tx === tx && waypoint.ty === ty) {
            agent.recalculatePath();
            break;
          }
        }
      }
    }
  }
}

// ==================== EXPORTS ====================
export default TileMovementManager;
