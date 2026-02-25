/**
 * Guard State Machine V2 Module
 * 
 * Enhanced state machine with deterministic transitions, hysteresis,
 * cooldowns, and difficulty scaling.
 * 
 * Phase B: State machine overhaul for improved AI behavior.
 * 
 * States:
 * - PATROL: Normal patrol behavior
 * - INVESTIGATE: Moving to investigate a disturbance
 * - SWEEP_ROOM: Systematically searching a room
 * - SEARCH_PATHS: Searching along predicted player paths
 * - RETURN_TO_PATROL: Returning to patrol route after search
 * - CHASE: Active pursuit - player seen
 * 
 * @module guard/GuardStateMachineV2
 */

/**
 * Guard state constants
 */
export const GUARD_STATES_V2 = {
  PATROL: 'patrol',
  INVESTIGATE: 'investigate',
  SWEEP_ROOM: 'sweepRoom',
  SEARCH_PATHS: 'searchPaths',
  RETURN_TO_PATROL: 'returnToPatrol',
  CHASE: 'chase'
};

/**
 * Legacy state mapping for backward compatibility
 */
export const LEGACY_STATE_MAP = {
  patrol: GUARD_STATES_V2.PATROL,
  investigate: GUARD_STATES_V2.INVESTIGATE,
  search: GUARD_STATES_V2.SEARCH_PATHS,
  chase: GUARD_STATES_V2.CHASE
};

/**
 * State transition reasons for diagnostics
 */
export const TRANSITION_REASONS = {
  AWARENESS_INCREASED: 'awareness_increased',
  AWARENESS_DECREASED: 'awareness_decreased',
  PLAYER_VISIBLE: 'player_visible',
  PLAYER_LOST: 'player_lost',
  TIMER_EXPIRED: 'timer_expired',
  WAYPOINT_REACHED: 'waypoint_reached',
  ROOM_COMPLETE: 'room_complete',
  PATHS_COMPLETE: 'paths_complete',
  STUCK_RECOVERY: 'stuck_recovery',
  COORDINATION_ROLE: 'coordination_role',
  RETURN_TO_ROUTE: 'return_to_route',
  DIFFICULTY_SCALING: 'difficulty_scaling'
};

/**
 * Default state machine configuration
 */
export const STATE_MACHINE_V2_CONFIG = {
  // Base durations (ms) - scaled by difficulty
  investigateDuration: 3000,
  sweepRoomDuration: 5000,
  searchPathsDuration: 4000,
  returnToPatrolTimeout: 8000,
  
  // Hysteresis: minimum time in a state before allowing transition (ms)
  stateHysteresis: 400,
  
  // State transition cooldown: prevents rapid state changes (ms)
  stateTransitionCooldown: 500,
  
  // Minimum time before allowing state downgrade (ms)
  downgradeHysteresis: 800,
  
  // Speed multipliers for different states
  speedMultipliers: {
    patrol: 1.0,
    investigate: 1.1,
    sweepRoom: 1.0,
    searchPaths: 1.2,
    returnToPatrol: 0.9,
    chase: 1.5
  },
  
  // Awareness thresholds for state transitions
  awarenessThresholds: {
    investigate: 1,
    chase: 2
  },
  
  // Sweep room configuration
  sweepRoom: {
    gridSpacing: 48,        // Spacing between sweep points
    maxPoints: 12,          // Maximum sweep points per room
    pointThreshold: 20      // Distance threshold to consider point reached
  },
  
  // Search paths configuration
  searchPaths: {
    maxBranches: 4,         // Maximum path branches to search
    branchDepth: 3,         // How deep to follow each branch
    pointThreshold: 25      // Distance threshold for search points
  },
  
  // Difficulty scaling factors (multipliers applied to base durations)
  difficultyScaling: {
    // Easy (0.5): slower reactions, longer searches
    // Normal (1.0): standard behavior
    // Hard (1.5): faster reactions, shorter searches
    reactionTimeFactor: 0.85,     // Lower = faster reactions
    searchDurationFactor: 0.9,    // Lower = shorter searches
    sweepThoroughness: 1.1        // Higher = more thorough sweeps
  }
};

/**
 * Difficulty configuration presets
 */
export const DIFFICULTY_PRESETS = {
  easy: {
    name: 'easy',
    reactionMultiplier: 1.5,      // Slower reactions
    searchDurationMultiplier: 1.3, // Longer searches
    sweepPointMultiplier: 0.7,    // Fewer sweep points
    speedMultiplier: 0.9,         // Slower movement
    awarenessDecayRate: 0.8       // Faster awareness decay
  },
  normal: {
    name: 'normal',
    reactionMultiplier: 1.0,
    searchDurationMultiplier: 1.0,
    sweepPointMultiplier: 1.0,
    speedMultiplier: 1.0,
    awarenessDecayRate: 1.0
  },
  hard: {
    name: 'hard',
    reactionMultiplier: 0.7,      // Faster reactions
    searchDurationMultiplier: 0.8, // Shorter searches
    sweepPointMultiplier: 1.3,    // More sweep points
    speedMultiplier: 1.15,        // Faster movement
    awarenessDecayRate: 1.2       // Slower awareness decay
  },
  extreme: {
    name: 'extreme',
    reactionMultiplier: 0.5,
    searchDurationMultiplier: 0.6,
    sweepPointMultiplier: 1.5,
    speedMultiplier: 1.3,
    awarenessDecayRate: 1.5
  }
};

/**
 * Guard State Machine V2
 * Enhanced state management with deterministic transitions
 */
export class GuardStateMachineV2 {
  constructor(config = {}, difficulty = 'normal') {
    this.config = { ...STATE_MACHINE_V2_CONFIG, ...config };
    
    // State variables
    this._currentState = GUARD_STATES_V2.PATROL;
    this._previousState = null;
    this._stateTimer = 0;
    this._lastStateChange = 0;
    this._lastDowngrade = 0;
    this._lastKnownPlayerPos = null;
    this._searchPoints = null;
    this._currentSearchIndex = 0;
    this._sweepPoints = null;
    this._currentSweepIndex = 0;
    this._returnTarget = null;
    
    // Difficulty settings
    this._difficulty = difficulty;
    this._difficultyConfig = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.normal;
    
    // Transition tracking
    this._transitionReason = null;
    this._pendingTransition = null;
    
    // Diagnostics
    this._transitionHistory = [];
    this._maxHistoryLength = 30;
    
    // Validation flags
    this._isValid = true;
    this._lastValidationError = null;
    
    // Cooldowns for specific transitions
    this._cooldowns = {
      investigateToSearch: 0,
      searchToReturn: 0,
      returnToPatrol: 0,
      chaseToSearch: 0
    };
  }
  
  /**
   * Get current state
   * @returns {string} Current state name
   */
  get currentState() {
    return this._currentState;
  }
  
  /**
   * Get previous state
   * @returns {string|null}
   */
  get previousState() {
    return this._previousState;
  }
  
  /**
   * Get state timer value
   * @returns {number} Timer in ms
   */
  get stateTimer() {
    return this._stateTimer;
  }
  
  /**
   * Get last known player position
   * @returns {{x: number, y: number}|null}
   */
  get lastKnownPlayerPos() {
    return this._lastKnownPlayerPos;
  }
  
  /**
   * Get search points for SEARCH_PATHS state
   * @returns {Array<{x: number, y: number}>|null}
   */
  get searchPoints() {
    return this._searchPoints;
  }
  
  /**
   * Get current search index
   * @returns {number}
   */
  get currentSearchIndex() {
    return this._currentSearchIndex;
  }
  
  /**
   * Get sweep points for SWEEP_ROOM state
   * @returns {Array<{x: number, y: number}>|null}
   */
  get sweepPoints() {
    return this._sweepPoints;
  }
  
  /**
   * Get current sweep index
   * @returns {number}
   */
  get currentSweepIndex() {
    return this._currentSweepIndex;
  }
  
  /**
   * Get return target for RETURN_TO_PATROL state
   * @returns {{x: number, y: number}|null}
   */
  get returnTarget() {
    return this._returnTarget;
  }
  
  /**
   * Get speed multiplier for current state
   * @returns {number}
   */
  get speedMultiplier() {
    const baseMultiplier = this.config.speedMultipliers[this._currentState] || 1.0;
    return baseMultiplier * this._difficultyConfig.speedMultiplier;
  }
  
  /**
   * Get current difficulty
   * @returns {string}
   */
  get difficulty() {
    return this._difficulty;
  }
  
  /**
   * Check if state machine is valid
   * @returns {boolean}
   */
  get isValid() {
    return this._isValid;
  }
  
  /**
   * Get last validation error
   * @returns {string|null}
   */
  get lastValidationError() {
    return this._lastValidationError;
  }
  
  /**
   * Get last transition reason
   * @returns {string|null}
   */
  get transitionReason() {
    return this._transitionReason;
  }
  
  /**
   * Set difficulty level
   * @param {string} difficulty - 'easy', 'normal', 'hard', or 'extreme'
   */
  setDifficulty(difficulty) {
    if (DIFFICULTY_PRESETS[difficulty]) {
      this._difficulty = difficulty;
      this._difficultyConfig = DIFFICULTY_PRESETS[difficulty];
    }
  }
  
  /**
   * Initialize state machine (idempotent)
   * @param {number} now - Current time in ms
   */
  initialize(now = Date.now()) {
    if (this._currentState !== GUARD_STATES_V2.PATROL || this._lastStateChange === 0) {
      this._currentState = GUARD_STATES_V2.PATROL;
      this._previousState = null;
      this._stateTimer = 0;
      this._lastStateChange = now;
      this._lastDowngrade = now;
      this._lastKnownPlayerPos = null;
      this._searchPoints = null;
      this._currentSearchIndex = 0;
      this._sweepPoints = null;
      this._currentSweepIndex = 0;
      this._returnTarget = null;
      this._transitionReason = TRANSITION_REASONS.timer_expired;
      this._recordTransition('init', GUARD_STATES_V2.PATROL, now);
      
      // Reset cooldowns
      for (const key of Object.keys(this._cooldowns)) {
        this._cooldowns[key] = 0;
      }
    }
    this._isValid = true;
    this._lastValidationError = null;
  }
  
  /**
   * Update state based on awareness level and player visibility
   * @param {number} awareness - Guard awareness level (0-3)
   * @param {boolean} playerVisible - Is player currently visible to guard?
   * @param {{x: number, y: number}} playerPos - Player position
   * @param {number} now - Current time in ms
   * @param {Object} context - Additional context (coordination role, etc.)
   * @returns {{state: string, target: {x: number, y: number}|null, changed: boolean, reason: string|null}}
   */
  update(awareness, playerVisible, playerPos, now = Date.now(), context = {}) {
    const timeSinceStateChange = now - this._lastStateChange;
    const timeSinceDowngrade = now - this._lastDowngrade;
    let changed = false;
    let target = null;
    let reason = null;
    
    // Validate inputs
    if (typeof awareness !== 'number' || awareness < 0) {
      this._isValid = false;
      this._lastValidationError = `Invalid awareness: ${awareness}`;
      return { state: this._currentState, target: null, changed: false, reason: null };
    }
    
    // Apply difficulty scaling to hysteresis
    const scaledHysteresis = this.config.stateHysteresis * this._difficultyConfig.reactionMultiplier;
    
    // Process pending transition if exists
    if (this._pendingTransition && timeSinceStateChange >= scaledHysteresis) {
      const pending = this._pendingTransition;
      this._pendingTransition = null;
      this._transitionTo(pending.state, now, pending.reason);
      changed = true;
      reason = pending.reason;
    }
    
    // State transitions with hysteresis and cooldowns
    if (!changed) {
      const transitionResult = this._processStateTransitions(
        awareness, playerVisible, playerPos, timeSinceStateChange, 
        timeSinceDowngrade, scaledHysteresis, now, context
      );
      
      if (transitionResult.changed) {
        changed = true;
        reason = transitionResult.reason;
      }
    }
    
    // Update state timer
    this._updateStateTimer(now);
    
    // Determine target based on state
    target = this.getTarget(playerPos);
    
    this._transitionReason = reason;
    
    return {
      state: this._currentState,
      target,
      changed,
      reason,
      speedMultiplier: this.speedMultiplier
    };
  }
  
  /**
   * Process state transitions based on awareness and visibility
   * @private
   */
  _processStateTransitions(awareness, playerVisible, playerPos, 
                           timeSinceStateChange, timeSinceDowngrade, 
                           scaledHysteresis, now, context) {
    let changed = false;
    let reason = null;
    
    // CHASE: Player definitely detected
    if (awareness >= 2 && timeSinceStateChange >= scaledHysteresis) {
      if (this._currentState !== GUARD_STATES_V2.CHASE) {
        this._transitionTo(GUARD_STATES_V2.CHASE, now, TRANSITION_REASONS.AWARENESS_INCREASED);
        this._lastKnownPlayerPos = { x: playerPos.x, y: playerPos.y };
        this._clearSearchState();
        this._clearSweepState();
        changed = true;
        reason = TRANSITION_REASONS.AWARENESS_INCREASED;
      } else if (playerVisible) {
        // Update last known position while chasing
        this._lastKnownPlayerPos = { x: playerPos.x, y: playerPos.y };
      }
    }
    // INVESTIGATE: Suspicious, heading to check
    else if (awareness === 1 && timeSinceStateChange >= scaledHysteresis) {
      if (this._currentState === GUARD_STATES_V2.PATROL || 
          this._currentState === GUARD_STATES_V2.RETURN_TO_PATROL) {
        this._transitionTo(GUARD_STATES_V2.INVESTIGATE, now, TRANSITION_REASONS.AWARENESS_INCREASED);
        const scaledDuration = this.config.investigateDuration * this._difficultyConfig.searchDurationMultiplier;
        this._stateTimer = scaledDuration;
        this._lastKnownPlayerPos = { x: playerPos.x, y: playerPos.y };
        changed = true;
        reason = TRANSITION_REASONS.AWARENESS_INCREASED;
      }
    }
    // Handle state-specific transitions
    else if (this._currentState === GUARD_STATES_V2.CHASE && !playerVisible) {
      // Lost sight during chase -> switch to SEARCH_PATHS
      if (timeSinceStateChange >= scaledHysteresis) {
        this._transitionTo(GUARD_STATES_V2.SEARCH_PATHS, now, TRANSITION_REASONS.PLAYER_LOST);
        const scaledDuration = this.config.searchPathsDuration * this._difficultyConfig.searchDurationMultiplier;
        this._stateTimer = scaledDuration;
        changed = true;
        reason = TRANSITION_REASONS.PLAYER_LOST;
      }
    }
    else if (this._currentState === GUARD_STATES_V2.INVESTIGATE) {
      // Check if investigation complete
      if (this._stateTimer <= 0) {
        // Investigation timeout -> start room sweep if in room context
        if (context.roomInfo) {
          this._transitionTo(GUARD_STATES_V2.SWEEP_ROOM, now, TRANSITION_REASONS.TIMER_EXPIRED);
          const scaledDuration = this.config.sweepRoomDuration * this._difficultyConfig.searchDurationMultiplier;
          this._stateTimer = scaledDuration;
          changed = true;
          reason = TRANSITION_REASONS.TIMER_EXPIRED;
        } else {
          // No room context -> search paths
          this._transitionTo(GUARD_STATES_V2.SEARCH_PATHS, now, TRANSITION_REASONS.TIMER_EXPIRED);
          this._stateTimer = this.config.searchPathsDuration * this._difficultyConfig.searchDurationMultiplier;
          changed = true;
          reason = TRANSITION_REASONS.TIMER_EXPIRED;
        }
      }
    }
    else if (this._currentState === GUARD_STATES_V2.SWEEP_ROOM) {
      // Check if sweep complete
      if (this._stateTimer <= 0 || this._currentSweepIndex >= (this._sweepPoints?.length || 0)) {
        this._transitionTo(GUARD_STATES_V2.SEARCH_PATHS, now, TRANSITION_REASONS.ROOM_COMPLETE);
        this._stateTimer = this.config.searchPathsDuration * this._difficultyConfig.searchDurationMultiplier;
        this._clearSweepState();
        changed = true;
        reason = TRANSITION_REASONS.ROOM_COMPLETE;
      }
    }
    else if (this._currentState === GUARD_STATES_V2.SEARCH_PATHS) {
      // Check if search complete
      if (this._stateTimer <= 0 || this._currentSearchIndex >= (this._searchPoints?.length || 0)) {
        this._transitionTo(GUARD_STATES_V2.RETURN_TO_PATROL, now, TRANSITION_REASONS.PATHS_COMPLETE);
        this._stateTimer = this.config.returnToPatrolTimeout;
        this._clearSearchState();
        changed = true;
        reason = TRANSITION_REASONS.PATHS_COMPLETE;
      }
    }
    else if (this._currentState === GUARD_STATES_V2.RETURN_TO_PATROL) {
      // Check if returned to patrol route
      if (this._stateTimer <= 0) {
        this._transitionTo(GUARD_STATES_V2.PATROL, now, TRANSITION_REASONS.RETURN_TO_ROUTE);
        this._returnTarget = null;
        this._lastKnownPlayerPos = null;
        changed = true;
        reason = TRANSITION_REASONS.RETURN_TO_ROUTE;
      }
    }
    
    // Handle coordination role changes
    if (context.coordinationRole && changed === false && timeSinceStateChange >= scaledHysteresis) {
      const roleResult = this._handleCoordinationRole(context.coordinationRole, playerPos, now);
      if (roleResult.changed) {
        changed = true;
        reason = TRANSITION_REASONS.COORDINATION_ROLE;
      }
    }
    
    return { changed, reason };
  }
  
  /**
   * Handle coordination role assignment
   * @private
   */
  _handleCoordinationRole(role, playerPos, now) {
    // Coordination roles can override certain states
    switch (role) {
      case 'pursuer':
        // Pursuer goes directly to chase if aware
        if (this._currentState !== GUARD_STATES_V2.CHASE && this._lastKnownPlayerPos) {
          this._transitionTo(GUARD_STATES_V2.CHASE, now, TRANSITION_REASONS.COORDINATION_ROLE);
          return { changed: true };
        }
        break;
      
      case 'flanker':
        // Flanker moves to intercept
        if (this._currentState === GUARD_STATES_V2.PATROL || 
            this._currentState === GUARD_STATES_V2.RETURN_TO_PATROL) {
          this._transitionTo(GUARD_STATES_V2.SEARCH_PATHS, now, TRANSITION_REASONS.COORDINATION_ROLE);
          return { changed: true };
        }
        break;
      
      case 'room_checker':
        // Room checker performs systematic sweep
        if (this._currentState !== GUARD_STATES_V2.SWEEP_ROOM) {
          this._transitionTo(GUARD_STATES_V2.SWEEP_ROOM, now, TRANSITION_REASONS.COORDINATION_ROLE);
          return { changed: true };
        }
        break;
    }
    
    return { changed: false };
  }
  
  /**
   * Update state timer
   * @private
   */
  _updateStateTimer(now) {
    // Decrement timer based on frame time (approximately 16ms at 60fps)
    if (this._stateTimer > 0) {
      this._stateTimer -= 16;
    }
  }
  
  /**
   * Get current target position based on state
   * @param {{x: number, y: number}} playerPos - Current player position (for chase)
   * @returns {{x: number, y: number}|null}
   */
  getTarget(playerPos) {
    switch (this._currentState) {
      case GUARD_STATES_V2.CHASE:
        return this._lastKnownPlayerPos;
      
      case GUARD_STATES_V2.INVESTIGATE:
        return this._lastKnownPlayerPos;
      
      case GUARD_STATES_V2.SWEEP_ROOM:
        return this._sweepPoints?.[this._currentSweepIndex] || null;
      
      case GUARD_STATES_V2.SEARCH_PATHS:
        return this._searchPoints?.[this._currentSearchIndex] || null;
      
      case GUARD_STATES_V2.RETURN_TO_PATROL:
        return this._returnTarget;
      
      case GUARD_STATES_V2.PATROL:
      default:
        return null;  // Patrol target handled externally
    }
  }
  
  /**
   * Advance search index
   * @returns {boolean} True if search complete
   */
  advanceSearchIndex() {
    if (this._currentState !== GUARD_STATES_V2.SEARCH_PATHS || !this._searchPoints) {
      return true;
    }
    
    this._currentSearchIndex++;
    
    if (this._currentSearchIndex >= this._searchPoints.length) {
      return true;  // Search complete
    }
    
    return false;
  }
  
  /**
   * Advance sweep index
   * @returns {boolean} True if sweep complete
   */
  advanceSweepIndex() {
    if (this._currentState !== GUARD_STATES_V2.SWEEP_ROOM || !this._sweepPoints) {
      return true;
    }
    
    this._currentSweepIndex++;
    
    if (this._currentSweepIndex >= this._sweepPoints.length) {
      return true;  // Sweep complete
    }
    
    return false;
  }
  
  /**
   * Set search points (called when entering SEARCH_PATHS state)
   * @param {Array<{x: number, y: number}>} points
   */
  setSearchPoints(points) {
    // Apply difficulty scaling to number of points
    const maxPoints = Math.ceil(
      (this.config.searchPaths.maxBranches * this.config.searchPaths.branchDepth) * 
      this._difficultyConfig.sweepPointMultiplier
    );
    
    this._searchPoints = points ? points.slice(0, maxPoints) : null;
    this._currentSearchIndex = 0;
  }
  
  /**
   * Set sweep points (called when entering SWEEP_ROOM state)
   * @param {Array<{x: number, y: number}>} points
   */
  setSweepPoints(points) {
    // Apply difficulty scaling to number of points
    const maxPoints = Math.ceil(
      this.config.sweepRoom.maxPoints * this._difficultyConfig.sweepPointMultiplier
    );
    
    this._sweepPoints = points ? points.slice(0, maxPoints) : null;
    this._currentSweepIndex = 0;
  }
  
  /**
   * Set return target (called when entering RETURN_TO_PATROL state)
   * @param {{x: number, y: number}} target
   */
  setReturnTarget(target) {
    this._returnTarget = target ? { ...target } : null;
  }
  
  /**
   * Handle waypoint reached
   * @param {{x: number, y: number}} playerPos - Current player position
   * @param {boolean} playerVisible - Is player visible?
   * @param {number} now - Current time in ms
   * @returns {{state: string, changed: boolean, reason: string|null}}
   */
  handleWaypointReached(playerPos, playerVisible, now = Date.now()) {
    let changed = false;
    let reason = null;
    
    switch (this._currentState) {
      case GUARD_STATES_V2.INVESTIGATE:
        if (this._lastKnownPlayerPos) {
          if (playerVisible) {
            // Still see player, continue chase
            this._lastKnownPlayerPos = { x: playerPos.x, y: playerPos.y };
          } else {
            // Investigation complete without sighting -> start search
            this._transitionTo(GUARD_STATES_V2.SEARCH_PATHS, now, TRANSITION_REASONS.WAYPOINT_REACHED);
            this._stateTimer = this.config.searchPathsDuration * this._difficultyConfig.searchDurationMultiplier;
            changed = true;
            reason = TRANSITION_REASONS.WAYPOINT_REACHED;
          }
        }
        break;
        
      case GUARD_STATES_V2.CHASE:
        if (playerVisible) {
          // Still see player, continue chase
          this._lastKnownPlayerPos = { x: playerPos.x, y: playerPos.y };
        } else {
          // Chase lost target -> start search
          this._transitionTo(GUARD_STATES_V2.SEARCH_PATHS, now, TRANSITION_REASONS.PLAYER_LOST);
          this._stateTimer = this.config.searchPathsDuration * this._difficultyConfig.searchDurationMultiplier;
          changed = true;
          reason = TRANSITION_REASONS.PLAYER_LOST;
        }
        break;
        
      case GUARD_STATES_V2.SWEEP_ROOM:
        const sweepComplete = this.advanceSweepIndex();
        if (sweepComplete) {
          this._transitionTo(GUARD_STATES_V2.SEARCH_PATHS, now, TRANSITION_REASONS.ROOM_COMPLETE);
          this._clearSweepState();
          changed = true;
          reason = TRANSITION_REASONS.ROOM_COMPLETE;
        }
        break;
        
      case GUARD_STATES_V2.SEARCH_PATHS:
        const searchComplete = this.advanceSearchIndex();
        if (searchComplete) {
          this._transitionTo(GUARD_STATES_V2.RETURN_TO_PATROL, now, TRANSITION_REASONS.PATHS_COMPLETE);
          this._stateTimer = this.config.returnToPatrolTimeout;
          this._clearSearchState();
          changed = true;
          reason = TRANSITION_REASONS.PATHS_COMPLETE;
        }
        break;
        
      case GUARD_STATES_V2.RETURN_TO_PATROL:
        // Reached patrol route -> return to patrol
        this._transitionTo(GUARD_STATES_V2.PATROL, now, TRANSITION_REASONS.RETURN_TO_ROUTE);
        this._returnTarget = null;
        this._lastKnownPlayerPos = null;
        changed = true;
        reason = TRANSITION_REASONS.RETURN_TO_ROUTE;
        break;
    }
    
    return { state: this._currentState, changed, reason };
  }
  
  /**
   * Clear search state
   * @private
   */
  _clearSearchState() {
    this._searchPoints = null;
    this._currentSearchIndex = 0;
  }
  
  /**
   * Clear sweep state
   * @private
   */
  _clearSweepState() {
    this._sweepPoints = null;
    this._currentSweepIndex = 0;
  }
  
  /**
   * Transition to a new state
   * @param {string} newState - Target state
   * @param {number} now - Current time in ms
   * @param {string} reason - Transition reason
   * @private
   */
  _transitionTo(newState, now, reason = null) {
    const oldState = this._currentState;
    this._previousState = oldState;
    this._currentState = newState;
    this._lastStateChange = now;
    
    // Track downgrades for hysteresis
    const isDowngrade = this._isStateDowngrade(oldState, newState);
    if (isDowngrade) {
      this._lastDowngrade = now;
    }
    
    this._recordTransition(oldState, newState, now, reason);
  }
  
  /**
   * Check if transition is a state downgrade (alertness reduction)
   * @private
   */
  _isStateDowngrade(from, to) {
    const statePriority = {
      [GUARD_STATES_V2.CHASE]: 5,
      [GUARD_STATES_V2.SEARCH_PATHS]: 4,
      [GUARD_STATES_V2.SWEEP_ROOM]: 3,
      [GUARD_STATES_V2.INVESTIGATE]: 2,
      [GUARD_STATES_V2.RETURN_TO_PATROL]: 1,
      [GUARD_STATES_V2.PATROL]: 0
    };
    
    return (statePriority[to] || 0) < (statePriority[from] || 0);
  }
  
  /**
   * Record a transition in history
   * @param {string} from - Previous state
   * @param {string} to - New state
   * @param {number} now - Current time in ms
   * @param {string} reason - Transition reason
   * @private
   */
  _recordTransition(from, to, now, reason = null) {
    this._transitionHistory.push({
      from,
      to,
      time: now,
      state: to,
      reason
    });
    
    // Keep history bounded
    if (this._transitionHistory.length > this._maxHistoryLength) {
      this._transitionHistory.shift();
    }
  }
  
  /**
   * Get transition history for diagnostics
   * @returns {Array<{from: string, to: string, time: number, reason: string}>}
   */
  getTransitionHistory() {
    return [...this._transitionHistory];
  }
  
  /**
   * Get diagnostics snapshot
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      currentState: this._currentState,
      previousState: this._previousState,
      stateTimer: this._stateTimer,
      timeSinceStateChange: Date.now() - this._lastStateChange,
      hasLastKnownPos: !!this._lastKnownPlayerPos,
      searchPointsCount: this._searchPoints?.length || 0,
      currentSearchIndex: this._currentSearchIndex,
      sweepPointsCount: this._sweepPoints?.length || 0,
      currentSweepIndex: this._currentSweepIndex,
      hasReturnTarget: !!this._returnTarget,
      difficulty: this._difficulty,
      isValid: this._isValid,
      lastTransitionReason: this._transitionReason,
      recentTransitions: this._transitionHistory.slice(-5)
    };
  }
  
  /**
   * Reset state machine to initial state
   */
  reset() {
    this._currentState = GUARD_STATES_V2.PATROL;
    this._previousState = null;
    this._stateTimer = 0;
    this._lastStateChange = Date.now();
    this._lastDowngrade = Date.now();
    this._lastKnownPlayerPos = null;
    this._searchPoints = null;
    this._currentSearchIndex = 0;
    this._sweepPoints = null;
    this._currentSweepIndex = 0;
    this._returnTarget = null;
    this._transitionHistory = [];
    this._transitionReason = null;
    this._pendingTransition = null;
    this._isValid = true;
    this._lastValidationError = null;
    
    // Reset cooldowns
    for (const key of Object.keys(this._cooldowns)) {
      this._cooldowns[key] = 0;
    }
  }
  
  /**
   * Force state (for testing/debugging)
   * @param {string} state - Target state
   * @param {number} now - Current time in ms
   */
  forceState(state, now = Date.now()) {
    const validStates = Object.values(GUARD_STATES_V2);
    if (!validStates.includes(state)) {
      this._isValid = false;
      this._lastValidationError = `Invalid state: ${state}`;
      return;
    }
    this._transitionTo(state, now, 'forced');
  }
  
  /**
   * Convert to legacy state for backward compatibility
   * @returns {string} Legacy state name
   */
  toLegacyState() {
    switch (this._currentState) {
      case GUARD_STATES_V2.SWEEP_ROOM:
      case GUARD_STATES_V2.SEARCH_PATHS:
        return 'search';
      case GUARD_STATES_V2.RETURN_TO_PATROL:
        return 'patrol';
      default:
        return this._currentState;
    }
  }
  
  /**
   * Create from legacy state for backward compatibility
   * @param {string} legacyState - Legacy state name
   * @returns {string} V2 state name
   */
  static fromLegacyState(legacyState) {
    return LEGACY_STATE_MAP[legacyState] || GUARD_STATES_V2.PATROL;
  }
}

export default GuardStateMachineV2;
