/**
 * Guard AI Orchestrator V2 Module
 * 
 * Enhanced main coordination module for guard AI behavior.
 * Integrates state machine V2, coordination, and enhanced stuck detection.
 * 
 * Phase B: Enhanced AI orchestrator for improved behavior.
 * 
 * Features:
 * - Enhanced state machine with SweepRoom, SearchPaths, ReturnToPatrol
 * - Multi-enemy coordination (pursuer, flanker, room-checker)
 * - Doorway contention handling
 * - Difficulty scaling
 * - Enhanced anti-stuck behavior
 * 
 * @module guard/GuardAIV2
 */

import { 
  GuardStateMachineV2, 
  GUARD_STATES_V2, 
  STATE_MACHINE_V2_CONFIG,
  DIFFICULTY_PRESETS 
} from './GuardStateMachineV2.js';
import { GuardCoordinator, COORD_ROLES, COORDINATOR_CONFIG } from './GuardCoordinator.js';
import { StuckDetectorV2, STUCK_DETECTOR_V2_CONFIG } from './StuckDetectorV2.js';
import { MovementSolver, MOVEMENT_SOLVER_CONFIG } from './MovementSolver.js';

/**
 * Combined guard AI configuration
 */
export const GUARD_AI_V2_CONFIG = {
  ...STATE_MACHINE_V2_CONFIG,
  ...STUCK_DETECTOR_V2_CONFIG,
  ...MOVEMENT_SOLVER_CONFIG,
  ...COORDINATOR_CONFIG,
  
  // Search pattern configuration
  searchPatternPoints: 4,
  searchPatternRadius: 80,
  
  // Waypoint thresholds
  chaseWaypointThreshold: 100,
  patrolWaypointThreshold: 25,
  sweepWaypointThreshold: 20,
  searchWaypointThreshold: 30,
  
  // Coordination enable/disable
  enableCoordination: true,
  
  // Difficulty (can be overridden per guard)
  defaultDifficulty: 'normal'
};

/**
 * Guard AI Orchestrator V2
 * Coordinates enhanced state machine, coordination, stuck detection, and movement
 */
export class GuardAIV2 {
  constructor(config = {}) {
    this.config = { ...GUARD_AI_V2_CONFIG, ...config };
    
    // Component instances
    this.stateMachine = new GuardStateMachineV2(
      this.config, 
      this.config.difficulty || this.config.defaultDifficulty
    );
    this.stuckDetector = new StuckDetectorV2(this.config);
    this.movementSolver = new MovementSolver(this.config);
    
    // Coordinator is shared across guards (set via setCoordinator)
    this._coordinator = null;
    this._guardId = `guard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Patrol state
    this._patrolPoints = [];
    this._currentPatrolIndex = 0;
    
    // Scene context (injected)
    this._scene = null;
    this._isWallAtFn = null;
    this._generateSearchPatternFn = null;
    this._getNearbyRoomsFn = null;
    this._isNearDoorwayFn = null;
    
    // Context tracking
    this._currentRoom = null;
    this._nearDoorway = false;
    
    // Last update result for diagnostics
    this._lastUpdateResult = null;
    
    // Player tracking for coordination
    this._lastPlayerPos = null;
    this._lastPlayerVelocity = { x: 0, y: 0 };
    
    // Initialization flag
    this._initialized = false;
    
    // Diagnostics mode
    this._debugMode = false;
  }
  
  /**
   * Get guard ID
   * @returns {string}
   */
  get guardId() {
    return this._guardId;
  }
  
  /**
   * Initialize guard AI
   * @param {Array<{x: number, y: number}>} patrolPoints - Patrol waypoints
   * @param {function} isWallAtFn - Wall detection function
   * @param {function} generateSearchPatternFn - Search pattern generator
   * @param {number} now - Current time in ms
   * @param {number} tileSize - Tile size for calculations
   * @param {Object} options - Additional options
   */
  initialize(patrolPoints, isWallAtFn, generateSearchPatternFn, now = Date.now(), tileSize = 48, options = {}) {
    this._patrolPoints = patrolPoints ? [...patrolPoints] : [];
    this._currentPatrolIndex = 0;
    this._isWallAtFn = isWallAtFn;
    this._generateSearchPatternFn = generateSearchPatternFn;
    
    // Optional functions for enhanced behavior
    this._getNearbyRoomsFn = options.getNearbyRoomsFn || null;
    this._isNearDoorwayFn = options.isNearDoorwayFn || null;
    
    // Set difficulty if provided
    if (options.difficulty) {
      this.stateMachine.setDifficulty(options.difficulty);
    }
    
    this.movementSolver.setWallDetectionFunction(isWallAtFn);
    this.movementSolver.setTileSize(tileSize);
    
    this.stateMachine.initialize(now);
    this.stuckDetector.reset(now);
    
    // Register with coordinator if available
    if (this._coordinator) {
      this._coordinator.registerGuard(this._guardId, {
        position: this._patrolPoints[0] || { x: 0, y: 0 },
        state: GUARD_STATES_V2.PATROL
      });
    }
    
    this._initialized = true;
    this._lastUpdateResult = null;
    
    if (this._debugMode) {
      console.log(`[GuardAIV2] Initialized guard ${this._guardId}`, {
        patrolPoints: this._patrolPoints.length,
        difficulty: this.stateMachine.difficulty
      });
    }
  }
  
  /**
   * Set coordinator for multi-guard coordination
   * @param {GuardCoordinator} coordinator
   */
  setCoordinator(coordinator) {
    // Unregister from old coordinator
    if (this._coordinator) {
      this._coordinator.unregisterGuard(this._guardId);
    }
    
    this._coordinator = coordinator;
    
    // Register with new coordinator if initialized
    if (this._initialized && coordinator) {
      coordinator.registerGuard(this._guardId, {
        position: this._patrolPoints[this._currentPatrolIndex] || { x: 0, y: 0 },
        state: this.stateMachine.currentState
      });
    }
  }
  
  /**
   * Set difficulty level
   * @param {string} difficulty - 'easy', 'normal', 'hard', or 'extreme'
   */
  setDifficulty(difficulty) {
    this.stateMachine.setDifficulty(difficulty);
  }
  
  /**
   * Enable debug mode
   * @param {boolean} enabled
   */
  setDebugMode(enabled) {
    this._debugMode = enabled;
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
    return this.stateMachine.getTarget(this._lastPlayerPos) || 
           this._patrolPoints[this._currentPatrolIndex] || null;
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
   * Get coordination role
   * @returns {string}
   */
  get coordinationRole() {
    return this._coordinator?.getRole(this._guardId) || COORD_ROLES.UNASSIGNED;
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
      return { vx: 0, vy: 0, angle: 0, state: GUARD_STATES_V2.PATROL, waypointReached: false };
    }
    
    // Track player position and velocity for coordination
    if (playerPos) {
      if (this._lastPlayerPos) {
        this._lastPlayerVelocity = {
          x: playerPos.x - this._lastPlayerPos.x,
          y: playerPos.y - this._lastPlayerPos.y
        };
      }
      this._lastPlayerPos = { ...playerPos };
    }
    
    // Update context
    this._updateContext(guardX, guardY);
    
    // Build context for state machine
    const context = this._buildContext(guardX, guardY, now);
    
    // Update state machine
    const stateResult = this.stateMachine.update(awareness, playerVisible, playerPos, now, context);
    
    // Update stuck detection with context
    const stuckResult = this.stuckDetector.update(guardX, guardY, now, {
      nearDoorway: this._nearDoorway
    });
    const flipFlopResult = this.stuckDetector.updateDirection(guardVx, guardVy, now);
    
    // Update coordinator
    if (this._coordinator) {
      this._coordinator.updateGuard(this._guardId, {
        position: { x: guardX, y: guardY },
        state: stateResult.state,
        velocity: { x: guardVx, y: guardVy }
      });
      
      // Trigger alert if awareness is high
      if (awareness >= 2 && playerPos) {
        this._coordinator.triggerAlert(playerPos, now);
      }
    }
    
    // Determine target based on state and coordination role
    let target = this._determineTarget(stateResult.state, playerPos, now);
    
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
    
    // Get waypoint threshold based on state
    const waypointThreshold = this._getWaypointThreshold(stateResult.state);
    
    if (movement.sqDist < waypointThreshold * waypointThreshold) {
      // Waypoint reached
      const waypointResult = this._handleWaypointReached(stateResult.state, playerVisible, playerPos, now);
      
      this._lastUpdateResult = {
        vx: 0, vy: 0, angle: 0,
        state: waypointResult.state,
        waypointReached: true,
        reason: waypointResult.reason
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
      const movementResult = this._handleObstacleOrStuck(
        guardX, guardY, desiredVx, desiredVy, effectiveSpeed,
        stuckResult, flipFlopResult, target, now
      );
      
      if (movementResult) {
        desiredVx = movementResult.vx;
        desiredVy = movementResult.vy;
      }
    }
    
    // Check doorway contention
    if (this._nearDoorway && this._coordinator) {
      const contention = this._coordinator.checkDoorwayContention(
        this._guardId,
        { x: guardX, y: guardY },
        now
      );
      
      if (contention.shouldYield && contention.yieldDirection !== null) {
        // Yield by moving perpendicular
        desiredVx = Math.cos(contention.yieldDirection) * effectiveSpeed * 0.5;
        desiredVy = Math.sin(contention.yieldDirection) * effectiveSpeed * 0.5;
      }
    }
    
    // Apply direction smoothing
    const smoothed = this.movementSolver.smoothDirection(desiredVx, desiredVy, guardVx, guardVy, effectiveSpeed);
    
    this._lastUpdateResult = {
      vx: smoothed.vx,
      vy: smoothed.vy,
      angle: Math.atan2(smoothed.vy, smoothed.vx),
      state: stateResult.state,
      waypointReached: false,
      reason: stateResult.reason
    };
    
    return this._lastUpdateResult;
  }
  
  /**
   * Update context information
   * @private
   */
  _updateContext(guardX, guardY) {
    // Check if near doorway
    if (this._isNearDoorwayFn) {
      this._nearDoorway = this._isNearDoorwayFn(guardX, guardY);
    }
    
    // Get current room info
    if (this._getNearbyRoomsFn) {
      const rooms = this._getNearbyRoomsFn(guardX, guardY);
      this._currentRoom = rooms?.[0] || null;
    }
  }
  
  /**
   * Build context for state machine
   * @private
   */
  _buildContext(guardX, guardY, now) {
    const context = {
      roomInfo: this._currentRoom,
      coordinationRole: this.coordinationRole
    };
    
    // Add room check targets if room_checker role
    if (this.coordinationRole === COORD_ROLES.ROOM_CHECKER && this._coordinator && this._getNearbyRoomsFn) {
      const nearbyRooms = this._getNearbyRoomsFn(guardX, guardY);
      context.roomCheckTargets = this._coordinator.getRoomCheckTargets(this._guardId, nearbyRooms);
    }
    
    return context;
  }
  
  /**
   * Get waypoint threshold based on state
   * @private
   */
  _getWaypointThreshold(state) {
    switch (state) {
      case GUARD_STATES_V2.CHASE:
        return this.config.chaseWaypointThreshold;
      case GUARD_STATES_V2.SEARCH_PATHS:
        return this.config.searchWaypointThreshold;
      case GUARD_STATES_V2.SWEEP_ROOM:
        return this.config.sweepWaypointThreshold;
      case GUARD_STATES_V2.PATROL:
      default:
        return this.config.patrolWaypointThreshold;
    }
  }
  
  /**
   * Determine target based on state and coordination
   * @private
   */
  _determineTarget(state, playerPos, now) {
    // Check coordination role first
    if (this._coordinator && this.config.enableCoordination) {
      const role = this.coordinationRole;
      
      if (role === COORD_ROLES.FLANKER && playerPos) {
        const flankTarget = this._coordinator.getFlankingTarget(
          this._guardId,
          playerPos,
          this._lastPlayerVelocity
        );
        if (flankTarget) return flankTarget;
      }
      
      if (role === COORD_ROLES.ROOM_CHECKER && this.stateMachine.sweepPoints) {
        return this.stateMachine.sweepPoints[this.stateMachine.currentSweepIndex] || null;
      }
    }
    
    // Fall back to state-based target
    switch (state) {
      case GUARD_STATES_V2.CHASE:
      case GUARD_STATES_V2.INVESTIGATE:
        return this.stateMachine.lastKnownPlayerPos;
      
      case GUARD_STATES_V2.SWEEP_ROOM:
        return this.stateMachine.sweepPoints?.[this.stateMachine.currentSweepIndex] || null;
      
      case GUARD_STATES_V2.SEARCH_PATHS:
        return this.stateMachine.searchPoints?.[this.stateMachine.currentSearchIndex] || null;
      
      case GUARD_STATES_V2.RETURN_TO_PATROL:
        return this.stateMachine.returnTarget || this._patrolPoints[this._currentPatrolIndex] || null;
      
      case GUARD_STATES_V2.PATROL:
      default:
        return this._patrolPoints[this._currentPatrolIndex] || null;
    }
  }
  
  /**
   * Handle obstacle or stuck situation
   * @private
   */
  _handleObstacleOrStuck(guardX, guardY, desiredVx, desiredVy, effectiveSpeed,
                         stuckResult, flipFlopResult, target, now) {
    const canChangeDirection = this.stuckDetector.canChangeDirection(now);
    const canUseEscapeVector = this.stuckDetector.canUseEscapeVector(now);
    
    if (canChangeDirection || stuckResult.isStuck || stuckResult.isDoorwayStuck) {
      // Get recent direction angles for flip-flop penalty
      const recentAngles = this.stuckDetector._directionHistory?.slice(-3).map(d => d.angle) || [];
      
      // Check for suggested recovery direction
      const recoveryDir = this.stuckDetector.getSuggestedRecoveryDirection(
        guardX, guardY, target.x, target.y, now
      );
      
      let alternativeDir;
      
      if (recoveryDir && recoveryDir.reason === 'doorway_contention') {
        // Use recovery direction for doorway contention
        alternativeDir = {
          vx: Math.cos(recoveryDir.angle) * effectiveSpeed,
          vy: Math.sin(recoveryDir.angle) * effectiveSpeed
        };
      } else {
        // Use movement solver for obstacle avoidance
        alternativeDir = this.movementSolver.findAlternativeDirection(
          guardX, guardY,
          desiredVx, desiredVy,
          effectiveSpeed,
          stuckResult.isStuck,
          flipFlopResult,
          recentAngles
        );
      }
      
      if (alternativeDir) {
        this.stuckDetector.recordDirectionChange(now);
        
        // Create temporary waypoint for stuck recovery
        if ((stuckResult.isStuck || stuckResult.isDoorwayStuck) && canUseEscapeVector) {
          this.stuckDetector.recordEscapeVector(now);
          this._createTemporaryEscapeWaypoint(guardX, guardY, alternativeDir.vx, alternativeDir.vy, effectiveSpeed, now);
        }
        
        // If stuck by displacement, try backing up
        if (stuckResult.isStuck) {
          const backup = this.stuckDetector.calculateBackupPosition(guardX, guardY, target.x, target.y);
          return {
            vx: alternativeDir.vx,
            vy: alternativeDir.vy,
            backupPosition: backup
          };
        }
        
        // If flip-flopping, add perpendicular bias
        if (flipFlopResult && recoveryDir) {
          const currentAngle = Math.atan2(alternativeDir.vy, alternativeDir.vx);
          const perpAngle = recoveryDir.angle;
          alternativeDir.vx = Math.cos(perpAngle) * effectiveSpeed;
          alternativeDir.vy = Math.sin(perpAngle) * effectiveSpeed;
        }
        
        return alternativeDir;
      }
    }
    
    return null;
  }
  
  /**
   * Handle waypoint reached
   * @private
   */
  _handleWaypointReached(state, playerVisible, playerPos, now) {
    // Clear temporary waypoint
    this.stuckDetector.clearTemporaryWaypoint();
    
    // Reset stuck detection
    this.stuckDetector.reset(now);
    
    // Handle based on state
    switch (state) {
      case GUARD_STATES_V2.PATROL:
        this._currentPatrolIndex = (this._currentPatrolIndex + 1) % this._patrolPoints.length;
        break;
      
      case GUARD_STATES_V2.SWEEP_ROOM:
        const sweepComplete = this.stateMachine.advanceSweepIndex();
        if (sweepComplete) {
          this.stateMachine.forceState(GUARD_STATES_V2.SEARCH_PATHS, now);
          this._generateSearchPoints(playerPos, now);
        }
        break;
      
      case GUARD_STATES_V2.SEARCH_PATHS:
        const searchComplete = this.stateMachine.advanceSearchIndex();
        if (searchComplete) {
          this.stateMachine.forceState(GUARD_STATES_V2.RETURN_TO_PATROL, now);
          // Set return target to nearest patrol point
          this._setReturnTarget(playerPos);
        }
        break;
      
      case GUARD_STATES_V2.RETURN_TO_PATROL:
        this.stateMachine.forceState(GUARD_STATES_V2.PATROL, now);
        break;
      
      case GUARD_STATES_V2.INVESTIGATE:
      case GUARD_STATES_V2.CHASE:
        const result = this.stateMachine.handleWaypointReached(playerPos, playerVisible, now);
        
        // Generate search points if transitioning to search
        if (this.stateMachine.currentState === GUARD_STATES_V2.SEARCH_PATHS) {
          this._generateSearchPoints(playerPos, now);
        }
        // Generate sweep points if transitioning to sweep
        else if (this.stateMachine.currentState === GUARD_STATES_V2.SWEEP_ROOM) {
          this._generateSweepPoints(playerPos, now);
        }
        
        return { state: this.stateMachine.currentState, reason: result.reason };
    }
    
    return { state: this.stateMachine.currentState, reason: 'waypoint_reached' };
  }
  
  /**
   * Generate search points
   * @private
   */
  _generateSearchPoints(playerPos, now) {
    if (!this._generateSearchPatternFn || !this.stateMachine.lastKnownPlayerPos) return;
    
    const searchPoints = this._generateSearchPatternFn(this.stateMachine.lastKnownPlayerPos);
    this.stateMachine.setSearchPoints(searchPoints);
    
    if (this._debugMode) {
      console.log(`[GuardAIV2] Generated ${searchPoints?.length || 0} search points`);
    }
  }
  
  /**
   * Generate sweep points for room
   * @private
   */
  _generateSweepPoints(playerPos, now) {
    if (!this._currentRoom) return;
    
    // Generate grid of sweep points within room
    const config = this.config.sweepRoom;
    const room = this._currentRoom;
    const sweepPoints = [];
    
    const centerX = room.center?.x || room.x;
    const centerY = room.center?.y || room.y;
    const width = room.width || config.gridSpacing * 3;
    const height = room.height || config.gridSpacing * 3;
    
    const spacing = config.gridSpacing;
    const cols = Math.ceil(width / spacing);
    const rows = Math.ceil(height / spacing);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = centerX - width / 2 + spacing / 2 + col * spacing;
        const y = centerY - height / 2 + spacing / 2 + row * spacing;
        
        // Only add if not a wall
        if (this._isWallAtFn && !this._isWallAtFn(x, y)) {
          sweepPoints.push({ x, y });
        }
      }
    }
    
    this.stateMachine.setSweepPoints(sweepPoints);
    
    if (this._debugMode) {
      console.log(`[GuardAIV2] Generated ${sweepPoints.length} sweep points for room`);
    }
  }
  
  /**
   * Set return target to nearest patrol point
   * @private
   */
  _setReturnTarget(currentPos) {
    if (this._patrolPoints.length === 0) return;
    
    let nearestDist = Infinity;
    let nearestPoint = this._patrolPoints[0];
    
    for (const point of this._patrolPoints) {
      const dist = Math.hypot(point.x - currentPos.x, point.y - currentPos.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestPoint = point;
      }
    }
    
    this.stateMachine.setReturnTarget(nearestPoint);
    
    // Update patrol index to continue from nearest point
    const nearestIndex = this._patrolPoints.indexOf(nearestPoint);
    if (nearestIndex >= 0) {
      this._currentPatrolIndex = nearestIndex;
    }
  }
  
  /**
   * Create temporary escape waypoint
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
      guardId: this._guardId,
      initialized: this._initialized,
      currentState: this.stateMachine.currentState,
      previousState: this.stateMachine.previousState,
      speedMultiplier: this.stateMachine.speedMultiplier,
      difficulty: this.stateMachine.difficulty,
      patrolIndex: this._currentPatrolIndex,
      patrolPoints: this._patrolPoints.length,
      coordinationRole: this.coordinationRole,
      nearDoorway: this._nearDoorway,
      stateMachine: this.stateMachine.getDiagnostics(),
      stuckDetector: this.stuckDetector.getDiagnostics(),
      movementSolver: this.movementSolver.getDiagnostics(),
      coordinator: this._coordinator?.getDiagnostics() || null,
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
    this._lastPlayerPos = null;
    this._lastPlayerVelocity = { x: 0, y: 0 };
    this._currentRoom = null;
    this._nearDoorway = false;
    
    // Update coordinator
    if (this._coordinator) {
      this._coordinator.updateGuard(this._guardId, {
        position: this._patrolPoints[0] || { x: 0, y: 0 },
        state: GUARD_STATES_V2.PATROL
      });
    }
  }
}

// Re-export states for convenience
export { GUARD_STATES_V2, COORD_ROLES, DIFFICULTY_PRESETS };

export default GuardAIV2;
