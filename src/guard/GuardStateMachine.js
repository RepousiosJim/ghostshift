/**
 * Guard State Machine Module
 * 
 * Manages guard AI state transitions with hysteresis and cooldowns.
 * Phase P1: Extracted from main.js monolith for maintainability.
 * 
 * States:
 * - PATROL: Normal patrol behavior
 * - INVESTIGATE: Moving to investigate a disturbance
 * - CHASE: Active pursuit - player seen
 * - SEARCH: Searching area where player was last seen
 * 
 * @module guard/GuardStateMachine
 */

/**
 * Guard state constants
 */
export const GUARD_STATES = {
  PATROL: 'patrol',
  INVESTIGATE: 'investigate',
  CHASE: 'chase',
  SEARCH: 'search'
};

/**
 * State machine configuration
 */
export const STATE_MACHINE_CONFIG = {
  // Time to stay in INVESTIGATE state before returning to PATROL (ms)
  investigateDuration: 3000,
  
  // Time to stay in SEARCH state before returning to PATROL (ms)
  searchDuration: 4000,
  
  // Hysteresis: minimum time in a state before allowing transition (ms)
  stateHysteresis: 400,
  
  // State transition cooldown: prevents rapid state changes (ms)
  stateTransitionCooldown: 500,
  
  // Speed multipliers for different states
  speedMultipliers: {
    patrol: 1.0,
    investigate: 1.1,
    chase: 1.5,
    search: 1.2
  }
};

/**
 * Guard State Machine
 * Manages state transitions with hysteresis and validation
 */
export class GuardStateMachine {
  constructor(config = {}) {
    this.config = { ...STATE_MACHINE_CONFIG, ...config };
    
    // State variables
    this._currentState = GUARD_STATES.PATROL;
    this._stateTimer = 0;
    this._lastStateChange = 0;
    this._lastKnownPlayerPos = null;
    this._searchPoints = null;
    this._currentSearchIndex = 0;
    
    // Diagnostics
    this._transitionHistory = [];
    this._maxHistoryLength = 20;
    
    // Validation flags
    this._isValid = true;
    this._lastValidationError = null;
  }
  
  /**
   * Get current state
   * @returns {string} Current state name
   */
  get currentState() {
    return this._currentState;
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
   * Get search points for SEARCH state
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
   * Get speed multiplier for current state
   * @returns {number}
   */
  get speedMultiplier() {
    return this.config.speedMultipliers[this._currentState] || 1.0;
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
   * Initialize state machine (idempotent)
   * @param {number} now - Current time in ms
   */
  initialize(now = Date.now()) {
    if (this._currentState !== GUARD_STATES.PATROL || this._lastStateChange === 0) {
      this._currentState = GUARD_STATES.PATROL;
      this._stateTimer = 0;
      this._lastStateChange = now;
      this._lastKnownPlayerPos = null;
      this._searchPoints = null;
      this._currentSearchIndex = 0;
      this._recordTransition('init', GUARD_STATES.PATROL, now);
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
   * @returns {{state: string, target: {x: number, y: number}|null, changed: boolean}}
   */
  update(awareness, playerVisible, playerPos, now = Date.now()) {
    const timeSinceStateChange = now - this._lastStateChange;
    let changed = false;
    let target = null;
    
    // Validate inputs
    if (typeof awareness !== 'number' || awareness < 0) {
      this._isValid = false;
      this._lastValidationError = `Invalid awareness: ${awareness}`;
      return { state: this._currentState, target: null, changed: false };
    }
    
    // State transitions with hysteresis
    if (awareness >= 2 && timeSinceStateChange >= this.config.stateHysteresis) {
      // CHASE: Player definitely detected
      if (this._currentState !== GUARD_STATES.CHASE) {
        this._transitionTo(GUARD_STATES.CHASE, now);
        this._lastKnownPlayerPos = { x: playerPos.x, y: playerPos.y };
        this._searchPoints = null;
        this._currentSearchIndex = 0;
        changed = true;
      } else if (playerVisible) {
        // Update last known position while chasing
        this._lastKnownPlayerPos = { x: playerPos.x, y: playerPos.y };
      }
    } else if (awareness === 1 && timeSinceStateChange >= this.config.stateHysteresis) {
      // INVESTIGATE: Suspicious, heading to check
      if (this._currentState !== GUARD_STATES.INVESTIGATE) {
        this._transitionTo(GUARD_STATES.INVESTIGATE, now);
        this._stateTimer = this.config.investigateDuration;
        this._lastKnownPlayerPos = { x: playerPos.x, y: playerPos.y };
        changed = true;
      }
    } else if (this._currentState === GUARD_STATES.CHASE && !playerVisible) {
      // Lost sight during chase -> switch to SEARCH
      if (timeSinceStateChange >= this.config.stateHysteresis) {
        this._transitionTo(GUARD_STATES.SEARCH, now);
        this._stateTimer = this.config.searchDuration;
        changed = true;
      }
    } else if (this._currentState === GUARD_STATES.INVESTIGATE) {
      // Decrement investigate timer
      this._stateTimer -= 16;  // Approximate frame time
      if (this._stateTimer <= 0) {
        // Investigation timeout -> return to patrol
        this._transitionTo(GUARD_STATES.PATROL, now);
        this._lastKnownPlayerPos = null;
        changed = true;
      }
    } else if (this._currentState === GUARD_STATES.SEARCH) {
      // Decrement search timer
      this._stateTimer -= 16;
      if (this._stateTimer <= 0 || this._currentSearchIndex >= (this._searchPoints?.length || 0)) {
        // Search complete -> return to patrol
        this._transitionTo(GUARD_STATES.PATROL, now);
        this._lastKnownPlayerPos = null;
        this._searchPoints = null;
        this._currentSearchIndex = 0;
        changed = true;
      }
    }
    
    // Determine target based on state
    target = this.getTarget(playerPos);
    
    return {
      state: this._currentState,
      target,
      changed,
      speedMultiplier: this.speedMultiplier
    };
  }
  
  /**
   * Get current target position based on state
   * @param {{x: number, y: number}} playerPos - Current player position (for chase)
   * @returns {{x: number, y: number}|null}
   */
  getTarget(playerPos) {
    switch (this._currentState) {
      case GUARD_STATES.CHASE:
      case GUARD_STATES.INVESTIGATE:
        return this._lastKnownPlayerPos;
      case GUARD_STATES.SEARCH:
        return this._searchPoints?.[this._currentSearchIndex] || null;
      case GUARD_STATES.PATROL:
      default:
        return null;  // Patrol target handled externally
    }
  }
  
  /**
   * Advance search index
   * @returns {boolean} True if search complete
   */
  advanceSearchIndex() {
    if (this._currentState !== GUARD_STATES.SEARCH || !this._searchPoints) {
      return true;
    }
    
    this._currentSearchIndex++;
    
    if (this._currentSearchIndex >= this._searchPoints.length) {
      return true;  // Search complete
    }
    
    return false;
  }
  
  /**
   * Set search points (called when entering SEARCH state)
   * @param {Array<{x: number, y: number}>} points
   */
  setSearchPoints(points) {
    this._searchPoints = points ? [...points] : null;
    this._currentSearchIndex = 0;
  }
  
  /**
   * Handle waypoint reached
   * @param {{x: number, y: number}} playerPos - Current player position
   * @param {boolean} playerVisible - Is player visible?
   * @param {number} now - Current time in ms
   * @returns {{state: string, changed: boolean}}
   */
  handleWaypointReached(playerPos, playerVisible, now = Date.now()) {
    let changed = false;
    
    switch (this._currentState) {
      case GUARD_STATES.INVESTIGATE:
        if (this._lastKnownPlayerPos) {
          // Reached last known player position
          if (playerVisible) {
            // Still see player, continue chase
            this._lastKnownPlayerPos = { x: playerPos.x, y: playerPos.y };
          } else {
            // Investigation complete without sighting -> start search
            this._transitionTo(GUARD_STATES.SEARCH, now);
            this._stateTimer = this.config.searchDuration;
            changed = true;
          }
        }
        break;
        
      case GUARD_STATES.CHASE:
        if (playerVisible) {
          // Still see player, continue chase
          this._lastKnownPlayerPos = { x: playerPos.x, y: playerPos.y };
        } else {
          // Chase lost target -> start search
          this._transitionTo(GUARD_STATES.SEARCH, now);
          this._stateTimer = this.config.searchDuration;
          changed = true;
        }
        break;
        
      case GUARD_STATES.SEARCH:
        const searchComplete = this.advanceSearchIndex();
        if (searchComplete) {
          this._transitionTo(GUARD_STATES.PATROL, now);
          this._lastKnownPlayerPos = null;
          this._searchPoints = null;
          changed = true;
        }
        break;
    }
    
    return { state: this._currentState, changed };
  }
  
  /**
   * Transition to a new state
   * @param {string} newState - Target state
   * @param {number} now - Current time in ms
   * @private
   */
  _transitionTo(newState, now) {
    const oldState = this._currentState;
    this._currentState = newState;
    this._lastStateChange = now;
    this._recordTransition(oldState, newState, now);
  }
  
  /**
   * Record a transition in history
   * @param {string} from - Previous state
   * @param {string} to - New state
   * @param {number} now - Current time in ms
   * @private
   */
  _recordTransition(from, to, now) {
    this._transitionHistory.push({
      from,
      to,
      time: now,
      state: to
    });
    
    // Keep history bounded
    if (this._transitionHistory.length > this._maxHistoryLength) {
      this._transitionHistory.shift();
    }
  }
  
  /**
   * Get transition history for diagnostics
   * @returns {Array<{from: string, to: string, time: number}>}
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
      stateTimer: this._stateTimer,
      timeSinceStateChange: Date.now() - this._lastStateChange,
      hasLastKnownPos: !!this._lastKnownPlayerPos,
      searchPointsCount: this._searchPoints?.length || 0,
      currentSearchIndex: this._currentSearchIndex,
      isValid: this._isValid,
      recentTransitions: this._transitionHistory.slice(-5)
    };
  }
  
  /**
   * Reset state machine to initial state
   */
  reset() {
    this._currentState = GUARD_STATES.PATROL;
    this._stateTimer = 0;
    this._lastStateChange = Date.now();
    this._lastKnownPlayerPos = null;
    this._searchPoints = null;
    this._currentSearchIndex = 0;
    this._transitionHistory = [];
    this._isValid = true;
    this._lastValidationError = null;
  }
  
  /**
   * Force state (for testing/debugging)
   * @param {string} state - Target state
   * @param {number} now - Current time in ms
   */
  forceState(state, now = Date.now()) {
    if (!Object.values(GUARD_STATES).includes(state)) {
      this._isValid = false;
      this._lastValidationError = `Invalid state: ${state}`;
      return;
    }
    this._transitionTo(state, now);
  }
}

export default GuardStateMachine;
