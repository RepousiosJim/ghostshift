/**
 * GameScene Tile Integration - Integrates tile navigation with GameScene
 * 
 * Phase B: Integration layer between tile system and GameScene.
 * This module provides:
 * - Tile system initialization for a level
 * - Guard AI that uses tile-based pathfinding
 * - Legacy fallback when USE_TILE_AI is false
 * 
 * @module tile/GameSceneIntegration
 */

// Import directly from individual modules to avoid circular dependency
import { 
  TileGrid,
  worldToTile,
  tileToWorld,
  TILE_SIZE
} from './TileGrid.js';
import { TileMetadata } from './TileMetadata.js';
import { Pathfinder } from './Pathfinder.js';
import { TileMovementManager } from './TileMovement.js';

// ==================== FEATURE FLAGS ====================
// Define locally to avoid circular import from index.js

/**
 * Feature flag to enable tile-based AI navigation
 * When false, uses legacy continuous movement system
 */
export const USE_TILE_AI = false; // Default: off, enable after testing

/**
 * Debug mode for tile system
 */
export const TILE_DEBUG = false;

// ==================== GUARD AI ADAPTER ====================

/**
 * GuardAIAdapter - Adapts guard AI to use tile-based or legacy movement
 */
export class GuardAIAdapter {
  /**
   * Create guard AI adapter
   * @param {Object} gameScene - GameScene instance
   * @param {Object} options - Configuration options
   */
  constructor(gameScene, options = {}) {
    this.scene = gameScene;
    this.config = {
      useTileAI: USE_TILE_AI,
      debug: TILE_DEBUG,
      ...options
    };
    
    // Tile system (initialized lazily)
    this.tileSystem = null;
    this.tileAgent = null;
    
    // Legacy AI state (used when USE_TILE_AI is false)
    this._legacyState = {
      currentPatrolIndex: 0,
      guardAngle: 0,
      _guardState: 'PATROL',
      _guardStateTimer: 0,
      _lastStateChange: 0,
      _lastDirectionChange: 0,
      _positionHistory: [],
      _guardStuckFrames: 0,
      _guardLastValidPos: null
    };
  }
  
  /**
   * Initialize tile system for current level
   * @param {Object} levelLayout - Current level layout
   */
  initialize(levelLayout) {
    if (!this.config.useTileAI) {
      if (this.config.debug) {
        console.log('[GuardAIAdapter] Using legacy movement system');
      }
      return;
    }
    
    // Create tile system components directly
    const tileGrid = new TileGrid(levelLayout);
    const tileMetadata = new TileMetadata(tileGrid);
    const pathfinder = new Pathfinder(tileGrid, tileMetadata, { debug: this.config.debug });
    const agentManager = new TileMovementManager(tileGrid, tileMetadata, pathfinder);
    
    this.tileSystem = {
      tileGrid,
      tileMetadata,
      pathfinder,
      agentManager,
      destroy() {
        agentManager.clear();
        pathfinder.clearCache();
      }
    };
    
    // Create tile agent for guard
    const guardStartTile = this._getGuardStartTile(levelLayout);
    this.tileAgent = this.tileSystem.agentManager.createAgent(
      'guard_0',
      guardStartTile.tx,
      guardStartTile.ty,
      {
        tilesPerSecond: this._calculateTilesPerSecond()
      }
    );
    
    // Set patrol points
    if (levelLayout.guardPatrol && levelLayout.guardPatrol.length > 0) {
      const patrolTiles = levelLayout.guardPatrol.map(p => ({
        tx: p.x,
        ty: p.y
      }));
      this.tileAgent.setPatrolPoints(patrolTiles);
    }
    
    if (this.config.debug) {
      console.log('[GuardAIAdapter] Tile AI initialized', {
        startTile: guardStartTile,
        patrolPoints: this.tileAgent.patrolPoints.length
      });
    }
  }
  
  /**
   * Get guard starting tile from level layout
   * @private
   */
  _getGuardStartTile(levelLayout) {
    if (levelLayout.guardPatrol && levelLayout.guardPatrol.length > 0) {
      const firstPoint = levelLayout.guardPatrol[0];
      return { tx: firstPoint.x, ty: firstPoint.y };
    }
    // Default to center of map
    return { tx: 11, ty: 9 };
  }
  
  /**
   * Calculate guard speed in tiles per second based on difficulty
   * @private
   */
  _calculateTilesPerSecond() {
    const baseSpeed = 65; // BASE_GUARD_SPEED from main.js
    const difficulty = this.scene.levelDifficulty || 1;
    const speedMultiplier = 1 + (difficulty - 1) * 0.15;
    // Convert pixel speed to tiles per second
    // At 60 FPS, pixel speed * 60 = pixels per second
    // Pixels per second / TILE_SIZE = tiles per second
    return (baseSpeed * speedMultiplier * 60) / TILE_SIZE;
  }
  
  /**
   * Update guard AI (called from GameScene.update)
   * @param {number} delta - Delta time in ms
   * @param {Object} guard - Guard sprite
   * @param {Object} player - Player sprite
   * @returns {{x: number, y: number, angle: number}} New position and angle
   */
  update(delta, guard, player) {
    if (this.config.useTileAI && this.tileAgent) {
      return this._updateTileAI(delta, guard, player);
    } else {
      return this._updateLegacyAI(delta, guard, player);
    }
  }
  
  /**
   * Update using tile-based AI
   * @private
   */
  _updateTileAI(delta, guard, player) {
    // Update tile agent
    const result = this.tileAgent.update(delta);
    
    // Apply position to guard sprite
    guard.x = result.x;
    guard.y = result.y;
    
    // Calculate angle based on movement direction
    let angle = 0;
    if (this.tileAgent.isMoving) {
      const dx = this.tileAgent.targetWorldX - this.tileAgent.worldX;
      const dy = this.tileAgent.targetWorldY - this.tileAgent.worldY;
      angle = Math.atan2(dy, dx);
    }
    
    // Check if arrived at patrol point, advance to next
    if (this.tileAgent.hasArrived() && this.tileAgent.patrolPoints.length > 0) {
      this.tileAgent.advancePatrol();
      this.tileAgent.followPatrol();
    }
    
    // Handle awareness states (chase mode)
    this._updateAwareness(player);
    
    return {
      x: result.x,
      y: result.y,
      angle,
      arrived: result.arrived
    };
  }
  
  /**
   * Update guard awareness state
   * @private
   */
  _updateAwareness(player) {
    const awareness = this.scene.guardAwareness || 0;
    
    if (awareness >= 2 && this.tileAgent) {
      // Chase mode - recalculate path to player
      const playerTile = worldToTile(player.x, player.y);
      
      // Only recalculate if not already targeting player
      const currentTarget = this.tileAgent.currentPath?.[this.tileAgent.currentPath.length - 1];
      if (!currentTarget || 
          Math.abs(currentTarget.tx - playerTile.tx) > 2 ||
          Math.abs(currentTarget.ty - playerTile.ty) > 2) {
        // Recalculate path to player
        this.tileAgent.moveToTile(playerTile.tx, playerTile.ty);
      }
      
      // Speed boost in chase mode
      this.tileAgent.setSpeed(this._calculateTilesPerSecond() * 1.5);
    } else if (awareness === 1 && this.tileAgent) {
      // Alert mode - moderate speed boost
      this.tileAgent.setSpeed(this._calculateTilesPerSecond() * 1.2);
    } else if (this.tileAgent) {
      // Normal patrol speed
      this.tileAgent.setSpeed(this._calculateTilesPerSecond());
    }
  }
  
  /**
   * Update using legacy AI (delegates to GameScene.updateGuard)
   * This is a fallback that calls the original movement code
   * @private
   */
  _updateLegacyAI(delta, guard, player) {
    // The legacy AI is handled directly in GameScene.updateGuard()
    // This method exists for API consistency
    return {
      x: guard.x,
      y: guard.y,
      angle: this._legacyState.guardAngle,
      arrived: false
    };
  }
  
  /**
   * Handle guard state changes (for both tile and legacy AI)
   * @param {string} state - New state: 'PATROL', 'ALERT', 'CHASE'
   */
  setState(state) {
    this._legacyState._guardState = state;
    this._legacyState._lastStateChange = Date.now();
    
    if (this.config.debug) {
      console.log(`[GuardAIAdapter] State changed to: ${state}`);
    }
  }
  
  /**
   * Get current guard tile position
   * @returns {{tx: number, ty: number}}
   */
  getTilePosition() {
    if (this.tileAgent) {
      return this.tileAgent.getTilePosition();
    }
    // Fallback to world coordinates
    return worldToTile(this.scene.guard.x, this.scene.guard.y);
  }
  
  /**
   * Force path recalculation
   */
  recalculatePath() {
    if (this.tileAgent) {
      this.tileAgent.recalculatePath();
    }
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.tileSystem) {
      this.tileSystem.destroy();
      this.tileSystem = null;
    }
    this.tileAgent = null;
  }
}

// ==================== INTEGRATION HELPER ====================

/**
 * Integrate tile system with GameScene
 * Call this from GameScene.create()
 * 
 * @param {Object} gameScene - GameScene instance
 * @returns {GuardAIAdapter|null} Guard AI adapter or null if disabled
 */
export function integrateTileSystem(gameScene) {
  if (!USE_TILE_AI) {
    if (TILE_DEBUG) {
      console.log('[TileIntegration] Tile AI disabled, using legacy system');
    }
    return null;
  }
  
  const adapter = new GuardAIAdapter(gameScene, {
    debug: TILE_DEBUG
  });
  
  // Store reference on scene
  gameScene._tileAIAdapter = adapter;
  
  // Initialize after level layout is loaded
  if (gameScene.currentLayout) {
    adapter.initialize(gameScene.currentLayout);
  }
  
  return adapter;
}

/**
 * Update tile system from GameScene.update()
 * 
 * @param {Object} gameScene - GameScene instance
 * @param {number} delta - Delta time in ms
 * @returns {Object|null} Position update or null
 */
export function updateTileAI(gameScene, delta) {
  const adapter = gameScene._tileAIAdapter;
  if (!adapter || !USE_TILE_AI) {
    return null;
  }
  
  return adapter.update(delta, gameScene.guard, gameScene.player);
}

/**
 * Clean up tile system from GameScene.shutdown()
 * 
 * @param {Object} gameScene - GameScene instance
 */
export function cleanupTileSystem(gameScene) {
  if (gameScene._tileAIAdapter) {
    gameScene._tileAIAdapter.destroy();
    gameScene._tileAIAdapter = null;
  }
}

// ==================== EXPORTS ====================
export default {
  USE_TILE_AI,
  GuardAIAdapter,
  integrateTileSystem,
  updateTileAI,
  cleanupTileSystem
};
