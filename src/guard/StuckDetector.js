/**
 * Stuck Detector Module
 * 
 * Manages stuck detection and recovery for guard AI.
 * Phase P1: Extracted from main.js monolith for maintainability.
 * 
 * Features:
 * - Time-window stuck detection
 * - Flip-flop oscillation prevention
 * - Position variance tracking
 * - Escape vector calculation
 * 
 * @module guard/StuckDetector
 */

/**
 * Stuck detection configuration
 */
export const STUCK_DETECTOR_CONFIG = {
  // Stuck detection window - track displacement over multiple frames
  stuckDetectionWindow: 20,
  
  // Minimum displacement threshold (pixels) - guard must move this much within window
  minDisplacementThreshold: 8,
  
  // Escape vector cooldown (ms) - prevent rapid direction flipping
  escapeVectorCooldown: 400,
  
  // Direction change cooldown (ms)
  directionChangeCooldown: 150,
  
  // Position history length for oscillation detection
  positionHistoryLength: 10,
  
  // Oscillation threshold: if position variance < this, guard is oscillating
  oscillationThreshold: 16,
  
  // Direction history length for flip-flop detection
  directionHistoryLength: 6,
  
  // Angle threshold for detecting opposite direction (radians)
  oppositeDirectionThreshold: 2.5,  // ~143 degrees
  
  // Temporary waypoint duration (ms)
  temporaryWaypointDuration: 1500,
  
  // Stuck backup distance (pixels)
  stuckBackupDist: 24,
  
  // Narrow corridor wall threshold
  narrowCorridorWallThreshold: 3,
  
  // Narrow corridor detection radius (pixels)
  narrowCorridorRadius: 60
};

/**
 * Stuck Detector
 * Tracks guard movement to detect and recover from stuck situations
 */
export class StuckDetector {
  constructor(config = {}) {
    this.config = { ...STUCK_DETECTOR_CONFIG, ...config };
    
    // Displacement tracking
    this._displacementHistory = [];
    this._lastPosition = null;
    
    // Position tracking for oscillation
    this._positionHistory = [];
    
    // Direction tracking for flip-flop
    this._directionHistory = [];
    
    // Cooldown tracking
    this._lastEscapeVector = 0;
    this._lastDirectionChange = 0;
    
    // Temporary waypoint
    this._temporaryWaypoint = null;
    this._temporaryWaypointExpiry = 0;
    
    // Diagnostics
    this._stuckEvents = [];
    this._recoveryEvents = [];
    this._maxEventHistory = 50;
    
    // State flags
    this._isStuck = false;
    this._isOscillating = false;
    this._isFlipFlopping = false;
  }
  
  /**
   * Get current stuck state
   * @returns {boolean}
   */
  get isStuck() {
    return this._isStuck;
  }
  
  /**
   * Get oscillation state
   * @returns {boolean}
   */
  get isOscillating() {
    return this._isOscillating;
  }
  
  /**
   * Get flip-flop state
   * @returns {boolean}
   */
  get isFlipFlopping() {
    return this._isFlipFlopping;
  }
  
  /**
   * Get temporary waypoint if active
   * @returns {{x: number, y: number}|null}
   */
  get temporaryWaypoint() {
    if (this._temporaryWaypoint && Date.now() < this._temporaryWaypointExpiry) {
      return this._temporaryWaypoint;
    }
    return null;
  }
  
  /**
   * Check if escape vector can be used (cooldown check)
   * @param {number} now - Current time in ms
   * @returns {boolean}
   */
  canUseEscapeVector(now = Date.now()) {
    return (now - this._lastEscapeVector) > this.config.escapeVectorCooldown;
  }
  
  /**
   * Check if direction can change (cooldown check)
   * @param {number} now - Current time in ms
   * @returns {boolean}
   */
  canChangeDirection(now = Date.now()) {
    return (now - this._lastDirectionChange) > this.config.directionChangeCooldown;
  }
  
  /**
   * Update stuck detection with new position
   * @param {number} x - Current X position
   * @param {number} y - Current Y position
   * @param {number} now - Current time in ms
   * @returns {{isStuck: boolean, isOscillating: boolean, isFlipFlopping: boolean, displacement: number}}
   */
  update(x, y, now = Date.now()) {
    // Initialize last position if needed
    if (!this._lastPosition) {
      this._lastPosition = { x, y };
      return { isStuck: false, isOscillating: false, isFlipFlopping: false, displacement: 0 };
    }
    
    // Calculate displacement this frame
    const displacement = Math.hypot(x - this._lastPosition.x, y - this._lastPosition.y);
    this._lastPosition = { x, y };
    
    // Update displacement history
    this._displacementHistory.push(displacement);
    if (this._displacementHistory.length > this.config.stuckDetectionWindow) {
      this._displacementHistory.shift();
    }
    
    // Calculate total displacement over window
    const totalDisplacement = this._displacementHistory.reduce((a, b) => a + b, 0);
    this._isStuck = this._displacementHistory.length >= this.config.stuckDetectionWindow &&
                    totalDisplacement < this.config.minDisplacementThreshold;
    
    // Record stuck event if newly stuck
    if (this._isStuck && this._stuckEvents.length === 0 || 
        (this._stuckEvents.length > 0 && !this._stuckEvents[this._stuckEvents.length - 1].active)) {
      this._stuckEvents.push({
        time: now,
        position: { x, y },
        active: true,
        totalDisplacement
      });
      this._trimEvents();
    }
    
    // Update position history for oscillation detection
    this._positionHistory.push({ x, y, time: now });
    if (this._positionHistory.length > this.config.positionHistoryLength) {
      this._positionHistory.shift();
    }
    
    // Check for oscillation
    const positionVariance = this._calculatePositionVariance();
    this._isOscillating = this._positionHistory.length >= this.config.positionHistoryLength &&
                          positionVariance < this.config.oscillationThreshold;
    
    return {
      isStuck: this._isStuck,
      isOscillating: this._isOscillating,
      isFlipFlopping: this._isFlipFlopping,
      displacement: totalDisplacement,
      positionVariance
    };
  }
  
  /**
   * Update direction tracking for flip-flop detection
   * @param {number} vx - X velocity
   * @param {number} vy - Y velocity
   * @param {number} now - Current time in ms
   * @returns {boolean} True if flip-flop detected
   */
  updateDirection(vx, vy, now = Date.now()) {
    const speed = Math.hypot(vx, vy);
    if (speed < 0.1) return this._isFlipFlopping;
    
    const currentAngle = Math.atan2(vy, vx);
    
    // Add to direction history if significant change
    if (this._directionHistory.length === 0 ||
        Math.abs(currentAngle - this._directionHistory[this._directionHistory.length - 1].angle) > 0.1) {
      this._directionHistory.push({ angle: currentAngle, time: now });
      if (this._directionHistory.length > this.config.directionHistoryLength) {
        this._directionHistory.shift();
      }
    }
    
    // Detect flip-flop pattern
    this._isFlipFlopping = this._detectFlipFlop();
    
    return this._isFlipFlopping;
  }
  
  /**
   * Record direction change
   * @param {number} now - Current time in ms
   */
  recordDirectionChange(now = Date.now()) {
    this._lastDirectionChange = now;
  }
  
  /**
   * Record escape vector usage
   * @param {number} now - Current time in ms
   */
  recordEscapeVector(now = Date.now()) {
    this._lastEscapeVector = now;
  }
  
  /**
   * Set temporary waypoint
   * @param {number} x - Waypoint X
   * @param {number} y - Waypoint Y
   * @param {number} duration - Duration in ms
   * @param {number} now - Current time in ms
   */
  setTemporaryWaypoint(x, y, duration = null, now = Date.now()) {
    this._temporaryWaypoint = { x, y };
    this._temporaryWaypointExpiry = now + (duration || this.config.temporaryWaypointDuration);
    
    // Record recovery event
    this._recoveryEvents.push({
      time: now,
      type: 'temporary_waypoint',
      position: { x, y }
    });
    this._trimEvents();
  }
  
  /**
   * Clear temporary waypoint
   */
  clearTemporaryWaypoint() {
    this._temporaryWaypoint = null;
    this._temporaryWaypointExpiry = 0;
  }
  
  /**
   * Reset stuck detection state
   * @param {number} now - Current time in ms
   */
  reset(now = Date.now()) {
    this._displacementHistory = [];
    this._positionHistory = [];
    this._directionHistory = [];
    this._lastPosition = null;
    this._isStuck = false;
    this._isOscillating = false;
    this._isFlipFlopping = false;
    
    // Mark stuck event as resolved
    if (this._stuckEvents.length > 0 && this._stuckEvents[this._stuckEvents.length - 1].active) {
      this._stuckEvents[this._stuckEvents.length - 1].resolvedAt = now;
      this._stuckEvents[this._stuckEvents.length - 1].active = false;
    }
  }
  
  /**
   * Calculate backup position when stuck
   * @param {number} x - Current X
   * @param {number} y - Current Y
   * @param {number} targetX - Target X
   * @param {number} targetY - Target Y
   * @returns {{x: number, y: number}} Backup position
   */
  calculateBackupPosition(x, y, targetX, targetY) {
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    
    if (dist < 1) return { x, y };
    
    const backupFactor = -this.config.stuckBackupDist / dist;
    return {
      x: x + dx * backupFactor,
      y: y + dy * backupFactor
    };
  }
  
  /**
   * Get diagnostics snapshot
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      isStuck: this._isStuck,
      isOscillating: this._isOscillating,
      isFlipFlopping: this._isFlipFlopping,
      displacementHistoryLength: this._displacementHistory.length,
      positionHistoryLength: this._positionHistory.length,
      directionHistoryLength: this._directionHistory.length,
      hasTemporaryWaypoint: !!this.temporaryWaypoint,
      timeSinceLastEscapeVector: Date.now() - this._lastEscapeVector,
      timeSinceLastDirectionChange: Date.now() - this._lastDirectionChange,
      recentStuckEvents: this._stuckEvents.slice(-5),
      recentRecoveryEvents: this._recoveryEvents.slice(-5)
    };
  }
  
  /**
   * Calculate position variance for oscillation detection
   * @returns {number}
   * @private
   */
  _calculatePositionVariance() {
    if (this._positionHistory.length < 2) return Infinity;
    
    let sumX = 0, sumY = 0;
    for (const pos of this._positionHistory) {
      sumX += pos.x;
      sumY += pos.y;
    }
    const avgX = sumX / this._positionHistory.length;
    const avgY = sumY / this._positionHistory.length;
    
    let variance = 0;
    for (const pos of this._positionHistory) {
      variance += (pos.x - avgX) ** 2 + (pos.y - avgY) ** 2;
    }
    return Math.sqrt(variance / this._positionHistory.length);
  }
  
  /**
   * Detect flip-flop oscillation pattern
   * @returns {boolean}
   * @private
   */
  _detectFlipFlop() {
    if (this._directionHistory.length < this.config.directionHistoryLength) {
      return false;
    }
    
    let flipFlopCount = 0;
    for (let i = 1; i < this._directionHistory.length; i++) {
      const prevAngle = this._directionHistory[i - 1].angle;
      const currAngle = this._directionHistory[i].angle;
      
      // Normalize angle difference to [-PI, PI]
      let angleDiff = currAngle - prevAngle;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      // Check if direction reversed (angle diff close to ±PI)
      if (Math.abs(Math.abs(angleDiff) - Math.PI) < (Math.PI - this.config.oppositeDirectionThreshold)) {
        flipFlopCount++;
      }
    }
    
    return flipFlopCount >= 2;
  }
  
  /**
   * Trim event histories to max length
   * @private
   */
  _trimEvents() {
    if (this._stuckEvents.length > this._maxEventHistory) {
      this._stuckEvents = this._stuckEvents.slice(-this._maxEventHistory);
    }
    if (this._recoveryEvents.length > this._maxEventHistory) {
      this._recoveryEvents = this._recoveryEvents.slice(-this._maxEventHistory);
    }
  }
}

export default StuckDetector;
