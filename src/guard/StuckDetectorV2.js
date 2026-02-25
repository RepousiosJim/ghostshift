/**
 * Enhanced Stuck Detector Module
 * 
 * Improved stuck detection with doorway contention handling,
 * enhanced anti-oscillation, and hotspot tracking.
 * 
 * Phase B: Enhanced stuck detection for improved AI behavior.
 * 
 * Features:
 * - Time-window stuck detection
 * - Flip-flop oscillation prevention
 * - Doorway contention detection
 * - Stuck hotspot tracking
 * - Enhanced recovery strategies
 * 
 * @module guard/StuckDetectorV2
 */

/**
 * Stuck detection configuration
 */
export const STUCK_DETECTOR_V2_CONFIG = {
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
  narrowCorridorRadius: 60,
  
  // ===== ENHANCED FEATURES =====
  
  // Doorway contention detection
  doorwayContention: {
    enabled: true,
    // Detection radius for doorway
    detectionRadius: 50,
    // Minimum time in doorway before considered stuck
    minTimeInDoorway: 800,
    // Direction alternation threshold for oscillation
    directionAlternationThreshold: 3,
    // Cooldown before retrying doorway
    retryCooldown: 1000
  },
  
  // Stuck hotspot tracking
  hotspotTracking: {
    enabled: true,
    // Number of stuck events to track
    maxHotspots: 10,
    // Radius for grouping stuck positions
    hotspotRadius: 60,
    // Decay time for hotspot priority (ms)
    hotspotDecayTime: 60000
  },
  
  // Enhanced oscillation detection
  enhancedOscillation: {
    enabled: true,
    // Minimum consecutive reversals to trigger
    minReversals: 3,
    // Time window for reversal detection (ms)
    reversalWindow: 2000,
    // Position revisit threshold
    positionRevisitThreshold: 30
  },
  
  // Recovery strategies
  recovery: {
    // Maximum recovery attempts before giving up
    maxRecoveryAttempts: 3,
    // Cooldown between recovery strategies
    strategyCooldown: 500,
    // Backup distance multiplier per attempt
    backupDistanceMultiplier: 1.5
  }
};

/**
 * Stuck Hotspot
 * Tracks areas where guards frequently get stuck
 */
class StuckHotspot {
  constructor(position, time) {
    this.position = { ...position };
    this.count = 1;
    this.firstOccurrence = time;
    this.lastOccurrence = time;
    this.priority = 1;
  }
  
  update(time) {
    this.count++;
    this.lastOccurrence = time;
    // Increase priority with repeated occurrences
    this.priority = Math.min(this.priority + 1, 5);
  }
  
  decay(now) {
    // Reduce priority over time
    const age = now - this.lastOccurrence;
    if (age > STUCK_DETECTOR_V2_CONFIG.hotspotTracking.hotspotDecayTime) {
      this.priority = Math.max(0, this.priority - 1);
    }
    return this.priority > 0;
  }
}

/**
 * Enhanced Stuck Detector
 * Tracks guard movement with improved stuck and oscillation detection
 */
export class StuckDetectorV2 {
  constructor(config = {}) {
    this.config = { ...STUCK_DETECTOR_V2_CONFIG, ...config };
    
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
    
    // Doorway contention tracking
    this._doorwayTimer = 0;
    this._doorwayDirectionAlternations = 0;
    this._lastDoorwayDirection = null;
    this._doorwayStuck = false;
    
    // Stuck hotspots
    this._hotspots = [];
    
    // Recovery state
    this._recoveryAttempts = 0;
    this._lastRecoveryTime = 0;
    
    // Diagnostics
    this._stuckEvents = [];
    this._recoveryEvents = [];
    this._maxEventHistory = 50;
    
    // State flags
    this._isStuck = false;
    this._isOscillating = false;
    this._isFlipFlopping = false;
    this._isDoorwayStuck = false;
    this._nearHotspot = false;
  }
  
  /**
   * Get current stuck state
   * @returns {boolean}
   */
  get isStuck() {
    return this._isStuck || this._isDoorwayStuck;
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
   * Get doorway stuck state
   * @returns {boolean}
   */
  get isDoorwayStuck() {
    return this._isDoorwayStuck;
  }
  
  /**
   * Get near hotspot state
   * @returns {boolean}
   */
  get nearHotspot() {
    return this._nearHotspot;
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
   * Get recovery attempts count
   * @returns {number}
   */
  get recoveryAttempts() {
    return this._recoveryAttempts;
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
   * @param {Object} context - Additional context (near doorway, etc.)
   * @returns {{isStuck: boolean, isOscillating: boolean, isFlipFlopping: boolean, displacement: number, nearHotspot: boolean}}
   */
  update(x, y, now = Date.now(), context = {}) {
    // Initialize last position if needed
    if (!this._lastPosition) {
      this._lastPosition = { x, y };
      return { 
        isStuck: false, 
        isOscillating: false, 
        isFlipFlopping: false, 
        displacement: 0,
        nearHotspot: false
      };
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
    if (this._isStuck && (this._stuckEvents.length === 0 || 
        !this._stuckEvents[this._stuckEvents.length - 1].active)) {
      this._stuckEvents.push({
        time: now,
        position: { x, y },
        active: true,
        totalDisplacement
      });
      this._trimEvents();
      
      // Track hotspot
      this._trackHotspot(x, y, now);
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
    
    // Check for position revisit (enhanced oscillation detection)
    if (this.config.enhancedOscillation.enabled) {
      const revisitDetected = this._detectPositionRevisit(x, y, now);
      if (revisitDetected) {
        this._isOscillating = true;
      }
    }
    
    // Update doorway contention if near doorway
    if (this.config.doorwayContention.enabled && context.nearDoorway) {
      this._updateDoorwayContention(displacement, now);
    } else {
      this._resetDoorwayTracking();
    }
    
    // Check if near a known hotspot
    this._nearHotspot = this._checkNearHotspot(x, y, now);
    
    // Decay hotspots periodically
    this._decayHotspots(now);
    
    return {
      isStuck: this._isStuck,
      isOscillating: this._isOscillating,
      isFlipFlopping: this._isFlipFlopping,
      isDoorwayStuck: this._isDoorwayStuck,
      displacement: totalDisplacement,
      positionVariance,
      nearHotspot: this._nearHotspot
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
    this._isFlipFlopping = this._detectFlipFlop(now);
    
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
    this._recoveryAttempts++;
    this._lastRecoveryTime = now;
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
      position: { x, y },
      attemptNumber: this._recoveryAttempts
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
    this._isDoorwayStuck = false;
    this._recoveryAttempts = 0;
    
    this._resetDoorwayTracking();
    
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
    
    // Increase backup distance with recovery attempts
    const backupMultiplier = Math.pow(
      this.config.recovery.backupDistanceMultiplier, 
      Math.min(this._recoveryAttempts, 3)
    );
    const backupDist = this.config.stuckBackupDist * backupMultiplier;
    
    const backupFactor = -backupDist / dist;
    return {
      x: x + dx * backupFactor,
      y: y + dy * backupFactor
    };
  }
  
  /**
   * Get suggested recovery direction
   * @param {number} x - Current X
   * @param {number} y - Current Y
   * @param {number} targetX - Target X
   * @param {number} targetY - Target Y
   * @param {number} now - Current time in ms
   * @returns {{angle: number, reason: string}|null}
   */
  getSuggestedRecoveryDirection(x, y, targetX, targetY, now = Date.now()) {
    // Check cooldown
    if (now - this._lastRecoveryTime < this.config.recovery.strategyCooldown) {
      return null;
    }
    
    // If stuck in doorway, suggest perpendicular movement
    if (this._isDoorwayStuck) {
      const dx = targetX - x;
      const dy = targetY - y;
      const angle = Math.atan2(dy, dx);
      // Perpendicular direction
      const perpAngle = angle + Math.PI / 2;
      return { angle: perpAngle, reason: 'doorway_contention' };
    }
    
    // If oscillating, suggest a different direction
    if (this._isOscillating || this._isFlipFlopping) {
      // Get recent angles and avoid them
      const recentAngles = this._directionHistory.slice(-3).map(d => d.angle);
      
      // Try to find a direction not recently used
      const testAngles = [
        Math.atan2(targetY - y, targetX - x),
        Math.atan2(targetY - y, targetX - x) + Math.PI / 4,
        Math.atan2(targetY - y, targetX - x) - Math.PI / 4,
        Math.atan2(targetY - y, targetX - x) + Math.PI / 2,
        Math.atan2(targetY - y, targetX - x) - Math.PI / 2
      ];
      
      for (const testAngle of testAngles) {
        let isNovel = true;
        for (const recentAngle of recentAngles) {
          const diff = Math.abs(this._normalizeAngleDiff(testAngle - recentAngle));
          if (diff < Math.PI / 4) {
            isNovel = false;
            break;
          }
        }
        if (isNovel) {
          return { angle: testAngle, reason: 'oscillation_avoidance' };
        }
      }
      
      // If no novel direction found, go opposite
      return { 
        angle: Math.atan2(targetY - y, targetX - x) + Math.PI, 
        reason: 'forced_reverse' 
      };
    }
    
    // If near hotspot, suggest movement away from hotspot
    if (this._nearHotspot) {
      const nearestHotspot = this._getNearestHotspot(x, y);
      if (nearestHotspot) {
        const angle = Math.atan2(
          y - nearestHotspot.position.y,
          x - nearestHotspot.position.x
        );
        return { angle, reason: 'hotspot_avoidance' };
      }
    }
    
    return null;
  }
  
  /**
   * Update doorway contention tracking
   * @private
   */
  _updateDoorwayContention(displacement, now) {
    const config = this.config.doorwayContention;
    
    // Increment doorway timer if not moving much
    if (displacement < 2) {
      this._doorwayTimer += 16; // Approximate frame time
    } else {
      this._doorwayTimer = Math.max(0, this._doorwayTimer - 8);
    }
    
    // Check for doorway stuck
    if (this._doorwayTimer > config.minTimeInDoorway) {
      this._isDoorwayStuck = true;
    }
  }
  
  /**
   * Reset doorway tracking
   * @private
   */
  _resetDoorwayTracking() {
    this._doorwayTimer = 0;
    this._doorwayDirectionAlternations = 0;
    this._lastDoorwayDirection = null;
    this._isDoorwayStuck = false;
  }
  
  /**
   * Track stuck hotspot
   * @private
   */
  _trackHotspot(x, y, now) {
    if (!this.config.hotspotTracking.enabled) return;
    
    const radius = this.config.hotspotTracking.hotspotRadius;
    
    // Check if near existing hotspot
    for (const hotspot of this._hotspots) {
      const dist = Math.hypot(x - hotspot.position.x, y - hotspot.position.y);
      if (dist < radius) {
        hotspot.update(now);
        return;
      }
    }
    
    // Create new hotspot
    if (this._hotspots.length < this.config.hotspotTracking.maxHotspots) {
      this._hotspots.push(new StuckHotspot({ x, y }, now));
    } else {
      // Replace oldest/least important hotspot
      this._hotspots.sort((a, b) => a.priority - b.priority);
      this._hotspots[0] = new StuckHotspot({ x, y }, now);
    }
  }
  
  /**
   * Check if position is near a known hotspot
   * @private
   */
  _checkNearHotspot(x, y, now) {
    if (!this.config.hotspotTracking.enabled) return false;
    
    const radius = this.config.hotspotTracking.hotspotRadius;
    
    for (const hotspot of this._hotspots) {
      const dist = Math.hypot(x - hotspot.position.x, y - hotspot.position.y);
      if (dist < radius * 1.5 && hotspot.priority >= 2) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get nearest hotspot
   * @private
   */
  _getNearestHotspot(x, y) {
    if (this._hotspots.length === 0) return null;
    
    let nearest = null;
    let minDist = Infinity;
    
    for (const hotspot of this._hotspots) {
      const dist = Math.hypot(x - hotspot.position.x, y - hotspot.position.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = hotspot;
      }
    }
    
    return nearest;
  }
  
  /**
   * Decay hotspot priorities
   * @private
   */
  _decayHotspots(now) {
    this._hotspots = this._hotspots.filter(h => h.decay(now));
  }
  
  /**
   * Detect position revisit (enhanced oscillation)
   * @private
   */
  _detectPositionRevisit(x, y, now) {
    const threshold = this.config.enhancedOscillation.positionRevisitThreshold;
    const window = this.config.enhancedOscillation.reversalWindow;
    
    // Check if revisiting a position from within the window
    for (const pos of this._positionHistory) {
      if (now - pos.time > window) continue;
      
      const dist = Math.hypot(x - pos.x, y - pos.y);
      if (dist < threshold && (Math.abs(pos.x - x) > 2 || Math.abs(pos.y - y) > 2)) {
        return true;
      }
    }
    
    return false;
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
   * @param {number} now - Current time in ms
   * @returns {boolean}
   * @private
   */
  _detectFlipFlop(now) {
    if (this._directionHistory.length < this.config.directionHistoryLength) {
      return false;
    }
    
    const config = this.config.enhancedOscillation;
    if (!config.enabled) {
      return this._detectFlipFlopBasic();
    }
    
    // Enhanced detection with time window
    let reversalCount = 0;
    const windowStart = now - config.reversalWindow;
    
    for (let i = 1; i < this._directionHistory.length; i++) {
      const prev = this._directionHistory[i - 1];
      const curr = this._directionHistory[i];
      
      if (curr.time < windowStart) continue;
      
      let angleDiff = Math.abs(curr.angle - prev.angle);
      angleDiff = this._normalizeAngleDiff(angleDiff);
      
      // Check if direction reversed
      if (Math.abs(Math.abs(angleDiff) - Math.PI) < (Math.PI - this.config.oppositeDirectionThreshold)) {
        reversalCount++;
      }
    }
    
    return reversalCount >= config.minReversals;
  }
  
  /**
   * Basic flip-flop detection (fallback)
   * @private
   */
  _detectFlipFlopBasic() {
    let flipFlopCount = 0;
    for (let i = 1; i < this._directionHistory.length; i++) {
      const prevAngle = this._directionHistory[i - 1].angle;
      const currAngle = this._directionHistory[i].angle;
      
      let angleDiff = currAngle - prevAngle;
      angleDiff = this._normalizeAngleDiff(angleDiff);
      
      if (Math.abs(Math.abs(angleDiff) - Math.PI) < (Math.PI - this.config.oppositeDirectionThreshold)) {
        flipFlopCount++;
      }
    }
    
    return flipFlopCount >= 2;
  }
  
  /**
   * Normalize angle difference to [-PI, PI]
   * @private
   */
  _normalizeAngleDiff(diff) {
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
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
  
  /**
   * Get diagnostics snapshot
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      isStuck: this._isStuck,
      isOscillating: this._isOscillating,
      isFlipFlopping: this._isFlipFlopping,
      isDoorwayStuck: this._isDoorwayStuck,
      nearHotspot: this._nearHotspot,
      displacementHistoryLength: this._displacementHistory.length,
      positionHistoryLength: this._positionHistory.length,
      directionHistoryLength: this._directionHistory.length,
      hasTemporaryWaypoint: !!this.temporaryWaypoint,
      recoveryAttempts: this._recoveryAttempts,
      hotspotCount: this._hotspots.length,
      timeSinceLastEscapeVector: Date.now() - this._lastEscapeVector,
      timeSinceLastDirectionChange: Date.now() - this._lastDirectionChange,
      recentStuckEvents: this._stuckEvents.slice(-5),
      recentRecoveryEvents: this._recoveryEvents.slice(-5),
      hotspots: this._hotspots.map(h => ({
        position: h.position,
        count: h.count,
        priority: h.priority
      }))
    };
  }
  
  /**
   * Get hotspots for external use
   * @returns {Array}
   */
  getHotspots() {
    return [...this._hotspots];
  }
}

export default StuckDetectorV2;
