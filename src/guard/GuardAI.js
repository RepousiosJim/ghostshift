/**
 * Guard AI Orchestrator Module
 * 
 * Main coordination module for guard AI behavior.
 * Phase P1: Extracted from main.js monolith for maintainability.
 * 
 * Integrates:
 * - GuardStateMachine: State management
 * - StuckDetector: Stuck detection and recovery
 * - MovementSolver: Obstacle avoidance and direction calculation
 * 
 * @module guard/GuardAI
 */

import { GuardStateMachine, GUARD_STATES, STATE_MACHINE_CONFIG } from './GuardStateMachine.js';
import { StuckDetector, STUCK_DETECTOR_CONFIG } from './StuckDetector.js';
import { MovementSolver, MOVEMENT_SOLVER_CONFIG } from './MovementSolver.js';

/**
 * Combined guard AI configuration
 */
export const GUARD_AI_CONFIG = {
  ...STATE_MACHINE_CONFIG,
  ...STUCK_DETECTOR_CONFIG,
  ...MOVEMENT_SOLVER_CONFIG,
  
  // Search pattern configuration
  searchPatternPoints: 4,
  searchPatternRadius: 80,
  
  // Waypoint thresholds
  chaseWaypointThreshold: 100,
  patrolWaypointThreshold: 25
};

/**
 * Guard AI Orchestrator
 * Coordinates state machine, stuck detection, and movement
 */
export class GuardAI {
  constructor(config = {}) {
    this.config = { ...GUARD_AI_CONFIG, ...config };
    
    // Component instances
    this.stateMachine = new GuardStateMachine(this.config);
    this.stuckDetector = new StuckDetector(this.config);
    this.movementSolver = new MovementSolver(this.config);
    
    // Patrol state
    this._patrolPoints = [];
    this._currentPatrolIndex = 0;
    
    // Scene context (injected)
    this._scene = null;
    this._isWallAtFn = null;
    this._generateSearchPatternFn = null;
    
    // Last update result for diagnostics
    this._lastUpdateResult = null;
    
    // Initialization flag
    this._initialized = false;
  }
  
  /**
   * Initialize guard AI
   * @param {Array<{x: number, y: number}>} patrolPoints - Patrol waypoints
   * @param {function} isWallAtFn - Wall detection function
   * @param {function} generateSearchPatternFn - Search pattern generator
   * @param {number} now - Current time in ms
   * @param {number} tileSize - Tile size for calculations
   */
  initialize(patrolPoints, isWallAtFn, generateSearchPatternFn, now = Date.now(), tileSize = 48) {
    this._patrolPoints = patrolPoints ? [...patrolPoints] : [];
    this._currentPatrolIndex = 0;
    this._isWallAtFn = isWallAtFn;
    this._generateSearchPatternFn = generateSearchPatternFn;
    
    this.movementSolver.setWallDetectionFunction(isWallAtFn);
    this.movementSolver.setTileSize(tileSize);
    
    this.stateMachine.initialize(now);
    this.stuckDetector.reset(now);
    
    this._initialized = true;
    this._lastUpdateResult = null;
  }
  
  /**
   * Check if AI is initialized
   * @returns {boolean}
   */
  get isInitialized() {
    return this._initialized;
  }
  
  /**
   * Get current state
   * @returns {string}
   */
  get currentState() {
    return this.stateMachine.currentState;
  }
  
  /**
   * Get speed multiplier
   * @returns {number}
   */
  get speedMultiplier() {
    return this.stateMachine.speedMultiplier;
  }
  
  /**
   * Get current target position
   * @returns {{x: number, y: number}|null}
   */
  get currentTarget() {
    return this.stateMachine.lastKnownPlayerPos || this._patrolPoints[this._currentPatrolIndex] || null;
  }
  
  /**
   * Get current patrol index
   * @returns {number}
   */
  get currentPatrolIndex() {
    return this._currentPatrolIndex;
  }
  
  /**
   * Get stuck state
   * @returns {boolean}
   */
  get isStuck() {
    return this.stuckDetector.isStuck;
  }
  
  /**
   * Main update function - call each frame
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
    if (!this._initialized) {
      return { vx: 0, vy: 0, angle: 0, state: GUARD_STATES.PATROL, waypointReached: false };
    }
    
    // Update state machine
    const stateResult = this.stateMachine.update(awareness, playerVisible, playerPos, now);
    
    // Update stuck detection
    const stuckResult = this.stuckDetector.update(guardX, guardY, now);
    const flipFlopResult = this.stuckDetector.updateDirection(guardVx, guardVy, now);
    
    // Determine target
    let target = this._determineTarget(stateResult.state, playerPos);
    
    // Check for temporary waypoint
    const tempWaypoint = this.stuckDetector.temporaryWaypoint;
    if (tempWaypoint) {
      target = tempWaypoint;
    }
    
    if (!target) {
      this._lastUpdateResult = {
        vx: 0, vy: 0, angle: 0, state: stateResult.state, waypointReached: false,
        reason: 'no_target'
      };
      return this._lastUpdateResult;
    }
    
    // Calculate movement to target
    const effectiveSpeed = baseSpeed * stateResult.speedMultiplier;
    const movement = this.movementSolver.calculateMovement(guardX, guardY, target.x, target.y, effectiveSpeed);
    
    // Check waypoint threshold
    const waypointThreshold = (stateResult.state === GUARD_STATES.CHASE || 
                               stateResult.state === GUARD_STATES.SEARCH) 
                              ? this.config.chaseWaypointThreshold 
                              : this.config.patrolWaypointThreshold;
    
    if (movement.sqDist < waypointThreshold * waypointThreshold) {
      // Waypoint reached
      const waypointResult = this._handleWaypointReached(stateResult.state, playerVisible, playerPos, now);
      
      this._lastUpdateResult = {
        vx: 0, vy: 0, angle: 0,
        state: waypointResult.state,
        waypointReached: true
      };
      return this._lastUpdateResult;
    }
    
    // Apply wall clearance force
    let desiredVx = movement.vx;
    let desiredVy = movement.vy;
    
    const isNarrowCorridor = this.movementSolver.isNarrowCorridor(guardX, guardY);
    const clearanceForceMultiplier = isNarrowCorridor ? this.config.narrowCorridorPushForce : 0.3;
    const clearance = this.movementSolver.getWallClearanceForce(guardX, guardY);
    
    desiredVx += clearance.x * effectiveSpeed * clearanceForceMultiplier;
    desiredVy += clearance.y * effectiveSpeed * clearanceForceMultiplier;
    
    // Check for obstacle ahead
    const hasObstacleAhead = this.movementSolver.hasObstacleAhead(guardX, guardY, desiredVx, desiredVy, effectiveSpeed);
    const isStuck = stuckResult.isStuck || stuckResult.isOscillating || flipFlopResult;
    
    // Handle obstacle avoidance and stuck recovery
    if (hasObstacleAhead || isStuck) {
      const canChangeDirection = this.stuckDetector.canChangeDirection(now);
      const canUseEscapeVector = this.stuckDetector.canUseEscapeVector(now);
      
      if (canChangeDirection || isStuck) {
        // Get recent direction angles for flip-flop penalty
        const recentAngles = this.stuckDetector._directionHistory.slice(-3).map(d => d.angle);
        
        const alternativeDir = this.movementSolver.findAlternativeDirection(
          guardX, guardY,
          desiredVx, desiredVy,
          effectiveSpeed,
          isStuck,
          flipFlopResult,
          recentAngles
        );
        
        if (alternativeDir) {
          desiredVx = alternativeDir.vx;
          desiredVy = alternativeDir.vy;
          this.stuckDetector.recordDirectionChange(now);
          
          // Create temporary waypoint for stuck recovery
          if (isStuck && canUseEscapeVector) {
            this.stuckDetector.recordEscapeVector(now);
            this._createTemporaryEscapeWaypoint(guardX, guardY, desiredVx, desiredVy, effectiveSpeed, now);
          }
          
          // If stuck by displacement, try backing up
          if (stuckResult.isStuck) {
            const backup = this.stuckDetector.calculateBackupPosition(guardX, guardY, target.x, target.y);
            // Return backup position for scene to apply
            this._lastUpdateResult = {
              vx: desiredVx,
              vy: desiredVy,
              angle: Math.atan2(desiredVy, desiredVx),
              state: stateResult.state,
              waypointReached: false,
              backupPosition: backup
            };
            return this._lastUpdateResult;
          }
          
          // If flip-flopping, add perpendicular bias
          if (flipFlopResult) {
            const currentAngle = Math.atan2(desiredVy, desiredVx);
            const perpendicularAngle = currentAngle + (Math.PI / 2) * (Math.random() > 0.5 ? 1 : -1);
            desiredVx = Math.cos(perpendicularAngle) * effectiveSpeed;
            desiredVy = Math.sin(perpendicularAngle) * effectiveSpeed;
          }
        }
      }
    }
    
    // Apply direction smoothing
    const smoothed = this.movementSolver.smoothDirection(desiredVx, desiredVy, guardVx, guardVy, effectiveSpeed);
    
    this._lastUpdateResult = {
      vx: smoothed.vx,
      vy: smoothed.vy,
      angle: Math.atan2(smoothed.vy, smoothed.vx),
      state: stateResult.state,
      waypointReached: false
    };
    
    return this._lastUpdateResult;
  }
  
  /**
   * Determine target based on state
   * @param {string} state - Current state
   * @param {{x: number, y: number}} playerPos - Player position
   * @returns {{x: number, y: number}|null}
   * @private
   */
  _determineTarget(state, playerPos) {
    switch (state) {
      case GUARD_STATES.CHASE:
      case GUARD_STATES.INVESTIGATE:
        return this.stateMachine.lastKnownPlayerPos;
      
      case GUARD_STATES.SEARCH:
        const searchPoints = this.stateMachine.searchPoints;
        const searchIndex = this.stateMachine.currentSearchIndex;
        return searchPoints?.[searchIndex] || null;
      
      case GUARD_STATES.PATROL:
      default:
        return this._patrolPoints[this._currentPatrolIndex] || null;
    }
  }
  
  /**
   * Handle waypoint reached
   * @param {string} state - Current state
   * @param {boolean} playerVisible - Is player visible?
   * @param {{x: number, y: number}} playerPos - Player position
   * @param {number} now - Current time in ms
   * @returns {{state: string}}
   * @private
   */
  _handleWaypointReached(state, playerVisible, playerPos, now) {
    // Clear temporary waypoint
    this.stuckDetector.clearTemporaryWaypoint();
    
    // Reset stuck detection
    this.stuckDetector.reset(now);
    
    // Handle based on state
    switch (state) {
      case GUARD_STATES.PATROL:
        this._currentPatrolIndex = (this._currentPatrolIndex + 1) % this._patrolPoints.length;
        break;
      
      case GUARD_STATES.SEARCH:
        const searchComplete = this.stateMachine.advanceSearchIndex();
        if (searchComplete) {
          this.stateMachine.forceState(GUARD_STATES.PATROL, now);
        }
        break;
      
      case GUARD_STATES.INVESTIGATE:
      case GUARD_STATES.CHASE:
        this.stateMachine.handleWaypointReached(playerPos, playerVisible, now);
        
        // Generate search pattern if transitioning to search
        if (this.stateMachine.currentState === GUARD_STATES.SEARCH && this._generateSearchPatternFn) {
          const searchPoints = this._generateSearchPatternFn(this.stateMachine.lastKnownPlayerPos);
          this.stateMachine.setSearchPoints(searchPoints);
        }
        break;
    }
    
    return { state: this.stateMachine.currentState };
  }
  
  /**
   * Create temporary escape waypoint
   * @param {number} x - Current X
   * @param {number} y - Current Y
   * @param {number} vx - Velocity X
   * @param {number} vy - Velocity Y
   * @param {number} speed - Speed
   * @param {number} now - Current time in ms
   * @private
   */
  _createTemporaryEscapeWaypoint(x, y, vx, vy, speed, now) {
    const escapeAngle = Math.atan2(vy, vx);
    const escapeOffsets = [Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4];
    
    for (const offset of escapeOffsets) {
      const testAngle = escapeAngle + offset;
      const waypointDist = this.movementSolver._tileSize * 2;
      const testX = x + Math.cos(testAngle) * waypointDist;
      const testY = y + Math.sin(testAngle) * waypointDist;
      
      if (!this._isWallAtFn(testX, testY) && 
          this.movementSolver.hasPathClearance(x, y, testX, testY, 10)) {
        this.stuckDetector.setTemporaryWaypoint(testX, testY, this.config.temporaryWaypointDuration, now);
        return;
      }
    }
    
    // Try backing up
    const backupAngle = escapeAngle + Math.PI;
    const backupX = x + Math.cos(backupAngle) * this.movementSolver._tileSize;
    const backupY = y + Math.sin(backupAngle) * this.movementSolver._tileSize;
    
    if (!this._isWallAtFn(backupX, backupY)) {
      this.stuckDetector.setTemporaryWaypoint(backupX, backupY, this.config.temporaryWaypointDuration, now);
    }
  }
  
  /**
   * Trigger alarm (boost speed)
   * @param {number} multiplier - Speed multiplier
   */
  triggerAlarm(multiplier = 1.5) {
    // Alarm affects base speed - handled externally
  }
  
  /**
   * Get comprehensive diagnostics
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      initialized: this._initialized,
      currentState: this.stateMachine.currentState,
      speedMultiplier: this.stateMachine.speedMultiplier,
      patrolIndex: this._currentPatrolIndex,
      patrolPoints: this._patrolPoints.length,
      stateMachine: this.stateMachine.getDiagnostics(),
      stuckDetector: this.stuckDetector.getDiagnostics(),
      movementSolver: this.movementSolver.getDiagnostics(),
      lastUpdateResult: this._lastUpdateResult
    };
  }
  
  /**
   * Reset AI to initial state
   * @param {number} now - Current time in ms
   */
  reset(now = Date.now()) {
    this.stateMachine.reset();
    this.stuckDetector.reset(now);
    this._currentPatrolIndex = 0;
    this._lastUpdateResult = null;
  }
}

// Re-export states for convenience
export { GUARD_STATES };

export default GuardAI;
