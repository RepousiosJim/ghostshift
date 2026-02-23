/**
 * Guard Diagnostics Module
 * 
 * Runtime diagnostics and anomaly detection for guard AI.
 * Phase P1: Improved runtime diagnostics hooks for quick detection of AI/pathing anomalies.
 * 
 * Features:
 * - Anomaly detection (stuck loops, oscillation, unreachable targets)
 * - Performance metrics tracking
 * - State transition validation
 * - Diagnostic logging with configurable levels
 * 
 * @module guard/GuardDiagnostics
 */

/**
 * Diagnostic level constants
 */
export const DIAGNOSTIC_LEVEL = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
  TRACE: 5
};

/**
 * Diagnostic configuration
 */
export const DIAGNOSTIC_CONFIG = {
  // Current diagnostic level
  level: DIAGNOSTIC_LEVEL.WARN,
  
  // Anomaly detection thresholds
  anomalyThresholds: {
    maxStuckEventsPerMinute: 5,
    maxStateTransitionsPerSecond: 10,
    maxOscillationEventsPerMinute: 3,
    maxZeroVelocityFrames: 60,  // ~1 second at 60fps
    maxPathRecalculationsPerSecond: 5
  },
  
  // Performance tracking
  trackPerformance: true,
  performanceSampleSize: 100,
  
  // Logging
  logToConsole: true,
  logPrefix: '[GuardDiag]'
};

/**
 * Guard Diagnostics
 * Tracks guard AI behavior and detects anomalies
 */
export class GuardDiagnostics {
  constructor(config = {}) {
    this.config = { ...DIAGNOSTIC_CONFIG, ...config };
    
    // Event tracking
    this._events = {
      stuck: [],
      oscillation: [],
      stateTransitions: [],
      pathRecalculations: [],
      zeroVelocity: [],
      anomalies: []
    };
    
    // Performance metrics
    this._metrics = {
      updateTimes: [],
      avgUpdateTime: 0,
      maxUpdateTime: 0,
      totalUpdates: 0
    };
    
    // Current state tracking
    this._currentState = {
      consecutiveZeroVelocityFrames: 0,
      lastPosition: null,
      lastState: null,
      lastUpdateTime: 0
    };
    
    // Anomaly callbacks
    this._anomalyCallbacks = [];
    
    // Bounded event history
    this._maxEventsPerType = 100;
  }
  
  /**
   * Set diagnostic level
   * @param {number} level - DIAGNOSTIC_LEVEL value
   */
  setLevel(level) {
    this.config.level = level;
  }
  
  /**
   * Register callback for anomaly detection
   * @param {function} callback - Function(anomalyType, data)
   */
  onAnomaly(callback) {
    this._anomalyCallbacks.push(callback);
  }
  
  /**
   * Record guard update
   * @param {Object} data - Update data
   * @param {number} duration - Update duration in ms
   */
  recordUpdate(data, duration = 0) {
    if (!this.config.trackPerformance) return;
    
    this._metrics.totalUpdates++;
    this._metrics.updateTimes.push(duration);
    
    if (this._metrics.updateTimes.length > this.config.performanceSampleSize) {
      this._metrics.updateTimes.shift();
    }
    
    this._metrics.avgUpdateTime = this._metrics.updateTimes.reduce((a, b) => a + b, 0) / 
                                   this._metrics.updateTimes.length;
    this._metrics.maxUpdateTime = Math.max(...this._metrics.updateTimes);
    
    // Track zero velocity
    if (data.vx === 0 && data.vy === 0) {
      this._currentState.consecutiveZeroVelocityFrames++;
      
      if (this._currentState.consecutiveZeroVelocityFrames > 
          this.config.anomalyThresholds.maxZeroVelocityFrames) {
        this._recordAnomaly('zero_velocity', {
          frames: this._currentState.consecutiveZeroVelocityFrames,
          position: { x: data.x, y: data.y },
          state: data.state
        });
      }
    } else {
      this._currentState.consecutiveZeroVelocityFrames = 0;
    }
    
    // Track position
    this._currentState.lastPosition = { x: data.x, y: data.y };
    this._currentState.lastUpdateTime = Date.now();
    
    this._log(DIAGNOSTIC_LEVEL.TRACE, 'Update', data);
  }
  
  /**
   * Record state transition
   * @param {string} from - Previous state
   * @param {string} to - New state
   * @param {number} now - Current time in ms
   */
  recordStateTransition(from, to, now = Date.now()) {
    const event = { from, to, time: now };
    this._events.stateTransitions.push(event);
    this._trimEvents('stateTransitions');
    
    this._currentState.lastState = to;
    
    // Check for rapid state transitions
    const recentTransitions = this._events.stateTransitions.filter(
      e => now - e.time < 1000
    );
    
    if (recentTransitions.length > this.config.anomalyThresholds.maxStateTransitionsPerSecond) {
      this._recordAnomaly('rapid_state_transitions', {
        count: recentTransitions.length,
        transitions: recentTransitions
      });
    }
    
    this._log(DIAGNOSTIC_LEVEL.DEBUG, `State: ${from} -> ${to}`);
  }
  
  /**
   * Record stuck event
   * @param {Object} data - Stuck event data
   */
  recordStuckEvent(data) {
    const now = Date.now();
    const event = { ...data, time: now };
    this._events.stuck.push(event);
    this._trimEvents('stuck');
    
    // Check for excessive stuck events
    const recentStuck = this._events.stuck.filter(
      e => now - e.time < 60000
    );
    
    if (recentStuck.length > this.config.anomalyThresholds.maxStuckEventsPerMinute) {
      this._recordAnomaly('excessive_stuck', {
        count: recentStuck.length,
        positions: recentStuck.map(e => e.position)
      });
    }
    
    this._log(DIAGNOSTIC_LEVEL.WARN, 'Stuck detected', data);
  }
  
  /**
   * Record oscillation event
   * @param {Object} data - Oscillation event data
   */
  recordOscillationEvent(data) {
    const now = Date.now();
    const event = { ...data, time: now };
    this._events.oscillation.push(event);
    this._trimEvents('oscillation');
    
    // Check for excessive oscillation
    const recentOsc = this._events.oscillation.filter(
      e => now - e.time < 60000
    );
    
    if (recentOsc.length > this.config.anomalyThresholds.maxOscillationEventsPerMinute) {
      this._recordAnomaly('excessive_oscillation', {
        count: recentOsc.length
      });
    }
    
    this._log(DIAGNOSTIC_LEVEL.WARN, 'Oscillation detected', data);
  }
  
  /**
   * Record path recalculation
   * @param {Object} data - Path data
   */
  recordPathRecalculation(data) {
    const now = Date.now();
    const event = { ...data, time: now };
    this._events.pathRecalculations.push(event);
    this._trimEvents('pathRecalculations');
    
    // Check for excessive recalculations
    const recentRecalc = this._events.pathRecalculations.filter(
      e => now - e.time < 1000
    );
    
    if (recentRecalc.length > this.config.anomalyThresholds.maxPathRecalculationsPerSecond) {
      this._recordAnomaly('excessive_path_recalc', {
        count: recentRecalc.length
      });
    }
    
    this._log(DIAGNOSTIC_LEVEL.DEBUG, 'Path recalculation', data);
  }
  
  /**
   * Record an anomaly
   * @param {string} type - Anomaly type
   * @param {Object} data - Anomaly data
   * @private
   */
  _recordAnomaly(type, data) {
    const anomaly = {
      type,
      data,
      time: Date.now()
    };
    
    this._events.anomalies.push(anomaly);
    this._trimEvents('anomalies');
    
    this._log(DIAGNOSTIC_LEVEL.WARN, `ANOMALY: ${type}`, data);
    
    // Notify callbacks
    for (const callback of this._anomalyCallbacks) {
      try {
        callback(type, data);
      } catch (e) {
        this._log(DIAGNOSTIC_LEVEL.ERROR, 'Anomaly callback error', e);
      }
    }
  }
  
  /**
   * Get diagnostic summary
   * @returns {Object}
   */
  getSummary() {
    const now = Date.now();
    
    return {
      // Metrics
      metrics: {
        totalUpdates: this._metrics.totalUpdates,
        avgUpdateTime: this._metrics.avgUpdateTime.toFixed(2),
        maxUpdateTime: this._metrics.maxUpdateTime
      },
      
      // Recent events (last 60 seconds)
      recentEvents: {
        stuckEvents: this._events.stuck.filter(e => now - e.time < 60000).length,
        oscillationEvents: this._events.oscillation.filter(e => now - e.time < 60000).length,
        stateTransitions: this._events.stateTransitions.filter(e => now - e.time < 60000).length
      },
      
      // Anomalies
      anomalies: this._events.anomalies.slice(-10),
      
      // Current state
      currentState: {
        lastState: this._currentState.lastState,
        consecutiveZeroVelocityFrames: this._currentState.consecutiveZeroVelocityFrames,
        lastPosition: this._currentState.lastPosition
      }
    };
  }
  
  /**
   * Get detailed event log
   * @param {string} type - Event type
   * @returns {Array}
   */
  getEventLog(type) {
    return this._events[type] || [];
  }
  
  /**
   * Clear all event logs
   */
  clearLogs() {
    for (const key of Object.keys(this._events)) {
      this._events[key] = [];
    }
  }
  
  /**
   * Check if any anomalies detected
   * @returns {boolean}
   */
  hasAnomalies() {
    return this._events.anomalies.length > 0;
  }
  
  /**
   * Export diagnostics for debugging
   * @returns {Object}
   */
  export() {
    return {
      config: this.config,
      summary: this.getSummary(),
      events: this._events,
      metrics: this._metrics
    };
  }
  
  /**
   * Log message at level
   * @param {number} level - Diagnostic level
   * @param {string} message - Log message
   * @param {Object} data - Optional data
   * @private
   */
  _log(level, message, data = null) {
    if (level > this.config.level) return;
    if (!this.config.logToConsole) return;
    
    const prefix = this.config.logPrefix;
    const levelNames = ['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
    const levelName = levelNames[level] || 'UNKNOWN';
    
    if (data) {
      console.log(`${prefix} [${levelName}] ${message}`, data);
    } else {
      console.log(`${prefix} [${levelName}] ${message}`);
    }
  }
  
  /**
   * Trim event array to max size
   * @param {string} type - Event type
   * @private
   */
  _trimEvents(type) {
    if (this._events[type].length > this._maxEventsPerType) {
      this._events[type] = this._events[type].slice(-this._maxEventsPerType);
    }
  }
}

/**
 * Global diagnostics instance
 * @type {GuardDiagnostics}
 */
let globalDiagnostics = null;

/**
 * Get or create global diagnostics instance
 * @param {Object} config - Optional configuration
 * @returns {GuardDiagnostics}
 */
export function getGuardDiagnostics(config = null) {
  if (!globalDiagnostics) {
    globalDiagnostics = new GuardDiagnostics(config);
  } else if (config) {
    globalDiagnostics.config = { ...globalDiagnostics.config, ...config };
  }
  return globalDiagnostics;
}

/**
 * Enable/disable global diagnostics
 * @param {boolean} enabled
 * @param {number} level - Diagnostic level
 */
export function setDiagnosticsEnabled(enabled, level = DIAGNOSTIC_LEVEL.INFO) {
  const diag = getGuardDiagnostics();
  diag.setLevel(enabled ? level : DIAGNOSTIC_LEVEL.NONE);
}

export default GuardDiagnostics;
