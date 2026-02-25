/**
 * GuardNavAdapter - Extends GuardAI with nav graph capabilities
 * 
 * Phase A: Integration layer connecting nav graph to modular GuardAI.
 * 
 * Features:
 * - Wraps GuardAI with nav-aware pathfinding
 * - Enforces pathing only on valid walk nodes
 * - Integrates search patterns with state machine
 * - Nav-layer anti-stuck recovery
 * - Room-aware behavior transitions
 * 
 * @module guard/GuardNavAdapter
 */

import { GuardAI, GUARD_STATES, GUARD_AI_CONFIG } from './GuardAI.js';
import { createNavSystem, NAV_NODE_TYPES, PATTERN_TYPES } from '../nav/index.js';
import { worldToTile, tileToWorld, TILE_SIZE } from '../tile/TileGrid.js';

// ==================== NAV ADAPTER CONFIG ====================

export const NAV_ADAPTER_CONFIG = {
  // Enable nav graph features
  enableNavGraph: true,
  
  // Search behavior
  useNavSearchPatterns: true,     // Use nav-aware search patterns
  searchPatternTimeout: 8000,     // Ms before pattern expires
  
  // Anti-stuck
  navLayerStuckDetection: true,   // Enable nav-layer stuck detection
  navStuckThreshold: 3,           // Tiles off valid path before stuck
  
  // Speed adjustments
  adjustSpeedByNodeType: true,    // Adjust speed based on nav node type
  
  // Room behavior
  autoRoomSweep: true,            // Auto-sweep rooms on entry
  
  // Debug
  debug: false
};

// ==================== GUARD NAV ADAPTER CLASS ====================

/**
 * GuardNavAdapter - Extends GuardAI with nav graph integration
 */
export class GuardNavAdapter {
  constructor(config = {}) {
    this.config = { ...GUARD_AI_CONFIG, ...NAV_ADAPTER_CONFIG, ...config };
    
    // Core GuardAI instance
    this.guardAI = new GuardAI(this.config);
    
    // Nav system (initialized later with tile grid)
    this.navSystem = null;
    this._navEnabled = false;
    
    // Agent ID for nav tracking
    this._agentId = `guard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Search pattern state
    this._activeSearchPattern = null;
    this._searchPatternStartTime = 0;
    
    // Last nav context
    this._lastNavContext = null;
    
    // Diagnostics
    this._navDiagnostics = {
      nodeTransitions: 0,
      roomEntries: 0,
      searchPatternsStarted: 0,
      searchPatternsCompleted: 0,
      navRecoveries: 0
    };
  }
  
  /**
   * Initialize with nav system
   * @param {TileGrid} tileGrid - Tile grid instance
   * @param {TileMetadata} tileMetadata - Tile metadata instance
   */
  initializeNav(tileGrid, tileMetadata) {
    if (!this.config.enableNavGraph) {
      this._navEnabled = false;
      return;
    }
    
    try {
      this.navSystem = createNavSystem(tileGrid, tileMetadata, {
        debug: this.config.debug
      });
      
      // Register this guard as an agent
      this.navSystem.registerAgent(this._agentId);
      
      this._navEnabled = true;
      
      if (this.config.debug) {
        console.log(`[GuardNavAdapter] Nav system initialized for agent ${this._agentId}`);
        console.log('[GuardNavAdapter] Nav graph stats:', this.navSystem.getNavGraph().getStats());
      }
    } catch (e) {
      console.error('[GuardNavAdapter] Failed to initialize nav system:', e);
      this._navEnabled = false;
    }
  }
  
  /**
   * Initialize guard AI (delegates to GuardAI)
   */
  initialize(patrolPoints, isWallAtFn, generateSearchPatternFn, now = Date.now(), tileSize = 48) {
    this.guardAI.initialize(patrolPoints, isWallAtFn, generateSearchPatternFn, now, tileSize);
  }
  
  /**
   * Check if nav is enabled
   * @returns {boolean}
   */
  get isNavEnabled() {
    return this._navEnabled && this.navSystem !== null;
  }
  
  /**
   * Get current state (delegates to GuardAI)
   */
  get currentState() {
    return this.guardAI.currentState;
  }
  
  /**
   * Get speed multiplier (delegates to GuardAI)
   */
  get speedMultiplier() {
    return this.guardAI.speedMultiplier;
  }
  
  /**
   * Get current target (delegates to GuardAI)
   */
  get currentTarget() {
    return this.guardAI.currentTarget;
  }
  
  /**
   * Get current patrol index (delegates to GuardAI)
   */
  get currentPatrolIndex() {
    return this.guardAI.currentPatrolIndex;
  }
  
  /**
   * Get stuck state (delegates to GuardAI)
   */
  get isStuck() {
    return this.guardAI.isStuck;
  }
  
  /**
   * Get is initialized (delegates to GuardAI)
   */
  get isInitialized() {
    return this.guardAI.isInitialized;
  }
  
  /**
   * Main update function - enhanced with nav graph features
   * 
   * @param {number} guardX - Guard X position
   * @param {number} guardY - Guard Y position
   * @param {number} guardVx - Guard X velocity
   * @param {number} guardVy - Guard Y velocity
   * @param {number} awareness - Guard awareness level (0-3)
   * @param {boolean} playerVisible - Is player visible?
   * @param {{x: number, y: number}} playerPos - Player position
   * @param {number} baseSpeed - Base guard speed
   * @param {number} now - Current time in ms
   * @returns {{vx: number, vy: number, angle: number, state: string, waypointReached: boolean}}
   */
  update(guardX, guardY, guardVx, guardVy, awareness, playerVisible, playerPos, baseSpeed, now = Date.now()) {
    // Get base result from GuardAI
    let result = this.guardAI.update(
      guardX, guardY, guardVx, guardVy,
      awareness, playerVisible, playerPos, baseSpeed, now
    );
    
    // Apply nav enhancements if enabled
    if (this._navEnabled && this.navSystem) {
      result = this._applyNavEnhancements(
        result, guardX, guardY, guardVx, guardVy,
        awareness, playerVisible, playerPos, baseSpeed, now
      );
    }
    
    return result;
  }
  
  /**
   * Apply nav graph enhancements to update result
   * @private
   */
  _applyNavEnhancements(result, guardX, guardY, guardVx, guardVy,
                         awareness, playerVisible, playerPos, baseSpeed, now) {
    
    // 1. Get node context for speed adjustment
    const nodeContext = this.navSystem.getNodeContext(this._agentId, guardX, guardY);
    this._lastNavContext = nodeContext;
    
    // Adjust speed based on node type
    if (this.config.adjustSpeedByNodeType && nodeContext.speedMultiplier !== 1) {
      result.vx *= nodeContext.speedMultiplier;
      result.vy *= nodeContext.speedMultiplier;
    }
    
    // 2. Check room entry for auto-sweep
    if (this.config.autoRoomSweep && result.state === GUARD_STATES.SEARCH) {
      const roomEntry = this.navSystem.checkRoomEntry(this._agentId, guardX, guardY);
      
      if (roomEntry.enteredRoom && roomEntry.sweepPattern) {
        this._navDiagnostics.roomEntries++;
        
        if (this.config.debug) {
          console.log(`[GuardNavAdapter] Entered room, starting sweep pattern`);
        }
      }
    }
    
    // 3. Handle search patterns
    if (result.state === GUARD_STATES.SEARCH && this.config.useNavSearchPatterns) {
      result = this._handleSearchPattern(result, guardX, guardY, playerPos, now);
    }
    
    // 4. Nav-layer stuck detection and recovery
    if (this.config.navLayerStuckDetection) {
      const stuckCheck = this._checkNavStuck(guardX, guardY, result, now);
      
      if (stuckCheck.isStuck && stuckCheck.recoveryWaypoint) {
        // Override target with recovery waypoint
        result.vx = 0;
        result.vy = 0;
        result.recoveryWaypoint = stuckCheck.recoveryWaypoint;
        result.needsRecovery = true;
        
        this._navDiagnostics.navRecoveries++;
        
        if (this.config.debug) {
          console.log(`[GuardNavAdapter] Nav stuck detected, using recovery waypoint`);
        }
      }
    }
    
    // 5. Validate movement is on walkable nodes
    if (!this.navSystem.isValidEnemyPosition(guardX + result.vx, guardY + result.vy)) {
      // Try to adjust velocity to stay on valid nodes
      const adjusted = this._adjustVelocityToValidNode(
        guardX, guardY, result.vx, result.vy, baseSpeed
      );
      
      if (adjusted) {
        result.vx = adjusted.vx;
        result.vy = adjusted.vy;
      }
    }
    
    return result;
  }
  
  /**
   * Handle search pattern generation and progression
   * @private
   */
  _handleSearchPattern(result, guardX, guardY, playerPos, now) {
    // Check if we need a new search pattern
    if (!this._activeSearchPattern || 
        now - this._searchPatternStartTime > this.config.searchPatternTimeout) {
      
      // Generate new search pattern
      const lastKnownPos = this.guardAI.stateMachine?.lastKnownPlayerPos;
      const context = {
        lastSeenTx: lastKnownPos ? worldToTile(lastKnownPos.x, lastKnownPos.y).tx : undefined,
        lastSeenTy: lastKnownPos ? worldToTile(lastKnownPos.x, lastKnownPos.y).ty : undefined,
        cameFromTx: this._lastNavContext?.cameFrom?.tx,
        cameFromTy: this._lastNavContext?.cameFrom?.ty
      };
      
      // Start search pattern
      const patternInfo = this.navSystem.startSearchPattern(
        this._agentId,
        'auto',
        lastKnownPos?.x || guardX,
        lastKnownPos?.y || guardY,
        context
      );
      
      if (patternInfo) {
        this._activeSearchPattern = patternInfo;
        this._searchPatternStartTime = now;
        this._navDiagnostics.searchPatternsStarted++;
        
        if (this.config.debug) {
          console.log(`[GuardNavAdapter] Started ${patternInfo.type} search pattern with ${patternInfo.pointCount} points`);
        }
      }
    }
    
    // Get next search point
    const nextPoint = this.navSystem.getNextSearchPoint(this._agentId);
    
    if (nextPoint) {
      // Override target with search pattern point
      result.searchPoint = { x: nextPoint.x, y: nextPoint.y };
    } else {
      // Pattern complete
      this._activeSearchPattern = null;
      this._navDiagnostics.searchPatternsCompleted++;
      
      if (this.config.debug) {
        console.log(`[GuardNavAdapter] Search pattern complete`);
      }
    }
    
    return result;
  }
  
  /**
   * Check for nav-layer stuck conditions
   * @private
   */
  _checkNavStuck(guardX, guardY, result, now) {
    const target = result.searchPoint || this.guardAI.currentTarget;
    
    if (!target) {
      return { isStuck: false, recoveryWaypoint: null };
    }
    
    return this.navSystem.checkStuck(
      this._agentId,
      guardX, guardY,
      target.x, target.y,
      now
    );
  }
  
  /**
   * Adjust velocity to keep movement on valid nodes
   * @private
   */
  _adjustVelocityToValidNode(x, y, vx, vy, speed) {
    // Try slightly different angles to find valid direction
    const baseAngle = Math.atan2(vy, vx);
    const anglesToTry = [
      baseAngle + 0.1,
      baseAngle - 0.1,
      baseAngle + 0.2,
      baseAngle - 0.2,
      baseAngle + Math.PI / 4,
      baseAngle - Math.PI / 4
    ];
    
    for (const angle of anglesToTry) {
      const testVx = Math.cos(angle) * speed;
      const testVy = Math.sin(angle) * speed;
      
      if (this.navSystem.isValidEnemyPosition(x + testVx, y + testVy)) {
        return { vx: testVx, vy: testVy };
      }
    }
    
    return null;
  }
  
  /**
   * Get room sweep points if in room
   * @returns {Array|null}
   */
  getRoomSweepPoints() {
    if (!this._navEnabled) return null;
    
    const point = this.navSystem.getNextSweepPoint(this._agentId);
    return point ? [point] : null;
  }
  
  /**
   * Force a search pattern type
   * @param {string} patternType - Pattern type from PATTERN_TYPES
   * @param {number} originX
   * @param {number} originY
   */
  forceSearchPattern(patternType, originX, originY) {
    if (!this._navEnabled) return;
    
    this.navSystem.startSearchPattern(
      this._agentId,
      patternType,
      originX,
      originY
    );
    
    this._searchPatternStartTime = Date.now();
  }
  
  /**
   * Get nav diagnostics
   * @returns {Object}
   */
  getNavDiagnostics() {
    return {
      ...this._navDiagnostics,
      navEnabled: this._navEnabled,
      agentId: this._agentId,
      lastNavContext: this._lastNavContext,
      activeSearchPattern: this._activeSearchPattern,
      navStats: this._navEnabled ? this.navSystem.getStats() : null
    };
  }
  
  /**
   * Get comprehensive diagnostics (includes GuardAI diagnostics)
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      guardAI: this.guardAI.getDiagnostics(),
      nav: this.getNavDiagnostics()
    };
  }
  
  /**
   * Reset (delegates to GuardAI)
   */
  reset(now = Date.now()) {
    this.guardAI.reset(now);
    
    // Reset nav state
    this._activeSearchPattern = null;
    this._searchPatternStartTime = 0;
    
    if (this._navEnabled && this.navSystem) {
      this.navSystem.cancelSearchPattern(this._agentId);
    }
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this._navEnabled && this.navSystem) {
      this.navSystem.unregisterAgent(this._agentId);
    }
  }
}

// ==================== EXPORTS ====================

export { GUARD_STATES };
export default GuardNavAdapter;
