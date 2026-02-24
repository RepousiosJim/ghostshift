/**
 * Canary Metrics Logger Module
 * 
 * Structured logging for canary rollout observability and safety hardening.
 * Tracks per-level metrics: stuck events, fallback triggers, state-transition anomalies.
 * 
 * Features:
 * - Per-level structured metrics collection
 * - Anomaly detection with configurable thresholds
 * - Local storage persistence for daily reports
 * - Rollback threshold monitoring
 * 
 * @module guard/CanaryMetricsLogger
 */

/**
 * Canary metrics configuration
 */
export const CANARY_METRICS_CONFIG = {
  // Storage key for persisted metrics
  storageKey: 'ghostshift_canary_metrics_v1',
  
  // Sampling configuration
  sampleIntervalMs: 1000,       // Sample every second
  maxSamplesPerLevel: 300,      // ~5 minutes of data
  
  // Anomaly thresholds (per level, per session)
  thresholds: {
    maxStuckEventsPerSession: 5,
    maxFallbackTriggersPerSession: 2,
    maxStateTransitionAnomalies: 3,
    maxZeroVelocityDuration: 3000,  // 3 seconds
    maxRecoveryFailures: 3
  },
  
  // Rollback recommendation thresholds
  rollbackThresholds: {
    stuckEventRate: 0.1,           // 10% stuck rate triggers rollback
    fallbackTriggerRate: 0.05,     // 5% fallback rate triggers rollback
    anomalyRate: 0.15,             // 15% anomaly rate triggers rollback
    minSamplesForRecommendation: 30  // Need at least 30 samples
  },
  
  // Daily report configuration
  report: {
    enabled: true,
    maxDaysRetention: 7
  }
};

/**
 * Anomaly types for structured logging
 */
export const ANOMALY_TYPES = {
  STUCK_EVENT: 'stuck_event',
  OSCILLATION: 'oscillation',
  FLIP_FLOP: 'flip_flop',
  ZERO_VELOCITY: 'zero_velocity',
  STATE_LOOP: 'state_loop',
  RAPID_TRANSITIONS: 'rapid_transitions',
  RECOVERY_FAILURE: 'recovery_failure',
  FALLBACK_TRIGGER: 'fallback_trigger'
};

/**
 * Severity levels
 */
export const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

/**
 * Canary Metrics Logger
 * Collects, persists, and analyzes per-level canary metrics
 */
export class CanaryMetricsLogger {
  constructor(config = {}) {
    this.config = { ...CANARY_METRICS_CONFIG, ...config };
    
    // Current session metrics
    this._sessionMetrics = new Map(); // levelIndex -> LevelMetrics
    
    // Daily aggregated metrics (persisted)
    this._dailyMetrics = this._loadDailyMetrics();
    
    // Callbacks for anomaly notifications
    this._anomalyCallbacks = [];
    
    // Rollback recommendation state
    this._rollbackRecommended = new Map(); // levelIndex -> { recommended, reason }
  }
  
  /**
   * Start tracking a level
   * @param {number} levelIndex - Level index
   * @param {string} levelName - Level name
   * @param {string} aiMode - 'modular' or 'legacy'
   */
  startLevel(levelIndex, levelName, aiMode) {
    const metrics = {
      levelIndex,
      levelName,
      aiMode,
      startTime: Date.now(),
      samples: [],
      events: {
        stuck: [],
        fallback: [],
        anomaly: [],
        stateTransition: []
      },
      counters: {
        stuckEvents: 0,
        fallbackTriggers: 0,
        anomalies: 0,
        stateTransitions: 0,
        zeroVelocityFrames: 0
      },
      lastSample: null,
      isActive: true
    };
    
    this._sessionMetrics.set(levelIndex, metrics);
  }
  
  /**
   * Record a sample during level play
   * @param {number} levelIndex - Level index
   * @param {object} data - Sample data
   */
  sample(levelIndex, data) {
    const metrics = this._sessionMetrics.get(levelIndex);
    if (!metrics || !metrics.isActive) return;
    
    const sample = {
      time: Date.now() - metrics.startTime,
      timestamp: Date.now(),
      ...data
    };
    
    metrics.samples.push(sample);
    metrics.lastSample = sample;
    
    // Trim to max samples
    if (metrics.samples.length > this.config.maxSamplesPerLevel) {
      metrics.samples.shift();
    }
    
    // Check for zero velocity
    if (data.velocity !== undefined && data.velocity < 0.5) {
      metrics.counters.zeroVelocityFrames++;
      
      // Check for sustained zero velocity
      if (metrics.counters.zeroVelocityFrames > this.config.thresholds.maxZeroVelocityDuration / 16) {
        this.recordAnomaly(levelIndex, ANOMALY_TYPES.ZERO_VELOCITY, {
          duration: metrics.counters.zeroVelocityFrames * 16,
          position: data.guardPosition
        });
      }
    } else {
      metrics.counters.zeroVelocityFrames = 0;
    }
  }
  
  /**
   * Record a stuck event
   * @param {number} levelIndex - Level index
   * @param {object} data - Event data
   */
  recordStuckEvent(levelIndex, data) {
    const metrics = this._sessionMetrics.get(levelIndex);
    if (!metrics) return;
    
    const event = {
      time: Date.now() - metrics.startTime,
      timestamp: Date.now(),
      ...data
    };
    
    metrics.events.stuck.push(event);
    metrics.counters.stuckEvents++;
    
    // Log to console in dev mode
    this._logEvent('stuck', levelIndex, event);
    
    // Check threshold
    if (metrics.counters.stuckEvents > this.config.thresholds.maxStuckEventsPerSession) {
      this.recordAnomaly(levelIndex, ANOMALY_TYPES.STUCK_EVENT, {
        count: metrics.counters.stuckEvents,
        positions: metrics.events.stuck.slice(-5).map(e => e.position)
      });
    }
    
    // Check rollback threshold
    this._checkRollbackThreshold(levelIndex);
  }
  
  /**
   * Record a fallback trigger event
   * @param {number} levelIndex - Level index
   * @param {string} reason - Fallback reason
   * @param {object} data - Additional data
   */
  recordFallbackTrigger(levelIndex, reason, data = {}) {
    const metrics = this._sessionMetrics.get(levelIndex);
    if (!metrics) return;
    
    const event = {
      time: Date.now() - metrics.startTime,
      timestamp: Date.now(),
      reason,
      ...data
    };
    
    metrics.events.fallback.push(event);
    metrics.counters.fallbackTriggers++;
    
    // Log critical event
    this._logEvent('fallback', levelIndex, event, SEVERITY.CRITICAL);
    
    // This is always an anomaly
    this.recordAnomaly(levelIndex, ANOMALY_TYPES.FALLBACK_TRIGGER, {
      reason,
      fallbackCount: metrics.counters.fallbackTriggers
    });
    
    // Check rollback threshold
    this._checkRollbackThreshold(levelIndex);
  }
  
  /**
   * Record a state transition
   * @param {number} levelIndex - Level index
   * @param {string} from - Previous state
   * @param {string} to - New state
   */
  recordStateTransition(levelIndex, from, to) {
    const metrics = this._sessionMetrics.get(levelIndex);
    if (!metrics) return;
    
    const event = {
      time: Date.now() - metrics.startTime,
      timestamp: Date.now(),
      from,
      to
    };
    
    metrics.events.stateTransition.push(event);
    metrics.counters.stateTransitions++;
    
    // Detect state loops (same state repeated 3+ times in short window)
    const recentTransitions = metrics.events.stateTransition.slice(-6);
    if (recentTransitions.length >= 6) {
      const states = recentTransitions.map(e => e.to);
      const stateCounts = {};
      for (const s of states) {
        stateCounts[s] = (stateCounts[s] || 0) + 1;
      }
      
      for (const [state, count] of Object.entries(stateCounts)) {
        if (count >= 3) {
          this.recordAnomaly(levelIndex, ANOMALY_TYPES.STATE_LOOP, {
            state,
            count,
            recentTransitions: recentTransitions
          });
          break;
        }
      }
    }
    
    // Detect rapid transitions (more than 5 transitions in 1 second)
    const lastSecondTransitions = metrics.events.stateTransition.filter(
      e => Date.now() - e.timestamp < 1000
    );
    
    if (lastSecondTransitions.length > 5) {
      this.recordAnomaly(levelIndex, ANOMALY_TYPES.RAPID_TRANSITIONS, {
        count: lastSecondTransitions.length,
        transitions: lastSecondTransitions
      });
    }
  }
  
  /**
   * Record an anomaly
   * @param {number} levelIndex - Level index
   * @param {string} type - Anomaly type (ANOMALY_TYPES)
   * @param {object} data - Anomaly data
   */
  recordAnomaly(levelIndex, type, data) {
    const metrics = this._sessionMetrics.get(levelIndex);
    if (!metrics) return;
    
    const anomaly = {
      time: Date.now() - metrics.startTime,
      timestamp: Date.now(),
      type,
      severity: this._getAnomalySeverity(type),
      ...data
    };
    
    // Avoid duplicate anomalies within 5 seconds
    const recentAnomalies = metrics.events.anomaly.filter(
      a => Date.now() - a.timestamp < 5000 && a.type === type
    );
    
    if (recentAnomalies.length > 0) return;
    
    metrics.events.anomaly.push(anomaly);
    metrics.counters.anomalies++;
    
    // Log anomaly
    this._logEvent('anomaly', levelIndex, anomaly, anomaly.severity);
    
    // Notify callbacks
    for (const callback of this._anomalyCallbacks) {
      try {
        callback(levelIndex, type, anomaly);
      } catch (e) {
        console.error('[CanaryMetrics] Callback error:', e);
      }
    }
    
    // Check rollback threshold
    this._checkRollbackThreshold(levelIndex);
  }
  
  /**
   * End tracking for a level
   * @param {number} levelIndex - Level index
   * @returns {object} Level summary
   */
  endLevel(levelIndex) {
    const metrics = this._sessionMetrics.get(levelIndex);
    if (!metrics) return null;
    
    metrics.isActive = false;
    metrics.endTime = Date.now();
    
    const summary = this._computeLevelSummary(metrics);
    
    // Aggregate into daily metrics
    this._aggregateDaily(summary);
    
    // Persist daily metrics
    this._saveDailyMetrics();
    
    return summary;
  }
  
  /**
   * Get summary for a level
   * @param {number} levelIndex - Level index
   * @returns {object|null}
   */
  getLevelSummary(levelIndex) {
    const metrics = this._sessionMetrics.get(levelIndex);
    if (!metrics) return null;
    return this._computeLevelSummary(metrics);
  }
  
  /**
   * Get all level summaries for current session
   * @returns {Array<object>}
   */
  getAllLevelSummaries() {
    const summaries = [];
    for (const [levelIndex, metrics] of this._sessionMetrics) {
      summaries.push(this._computeLevelSummary(metrics));
    }
    return summaries;
  }
  
  /**
   * Get rollback recommendation for a level
   * @param {number} levelIndex - Level index
   * @returns {{recommended: boolean, reason: string|null, metrics: object}}
   */
  getRollbackRecommendation(levelIndex) {
    const recommendation = this._rollbackRecommended.get(levelIndex);
    const summary = this.getLevelSummary(levelIndex);
    
    return {
      recommended: recommendation?.recommended || false,
      reason: recommendation?.reason || null,
      metrics: summary
    };
  }
  
  /**
   * Check if rollback is recommended for any canary level
   * @returns {Array<{levelIndex: number, recommended: boolean, reason: string}>}
   */
  checkRollbackStatus() {
    const statuses = [];
    
    for (const [levelIndex, metrics] of this._sessionMetrics) {
      if (metrics.aiMode === 'modular') {
        const rec = this.getRollbackRecommendation(levelIndex);
        statuses.push({
          levelIndex,
          levelName: metrics.levelName,
          ...rec
        });
      }
    }
    
    return statuses;
  }
  
  /**
   * Generate daily report
   * @returns {object}
   */
  generateDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    const dailyData = this._dailyMetrics[today] || { levels: {} };
    
    const report = {
      date: today,
      generatedAt: new Date().toISOString(),
      summary: {
        totalSessions: 0,
        totalAnomalies: 0,
        totalFallbackTriggers: 0,
        canaryHealth: 'healthy'
      },
      levels: {},
      recommendations: []
    };
    
    // Aggregate per-level data
    for (const [levelKey, levelData] of Object.entries(dailyData.levels || {})) {
      const levelIndex = parseInt(levelKey.replace('level_', ''));
      
      report.levels[levelKey] = {
        levelIndex,
        levelName: levelData.levelName,
        aiMode: levelData.aiMode,
        sessionCount: levelData.sessionCount || 0,
        totalSamples: levelData.totalSamples || 0,
        avgStuckRate: levelData.avgStuckRate || 0,
        totalAnomalies: levelData.totalAnomalies || 0,
        fallbackTriggers: levelData.fallbackTriggers || 0,
        healthStatus: this._computeHealthStatus(levelData)
      };
      
      report.summary.totalSessions += levelData.sessionCount || 0;
      report.summary.totalAnomalies += levelData.totalAnomalies || 0;
      report.summary.totalFallbackTriggers += levelData.fallbackTriggers || 0;
    }
    
    // Determine overall health
    if (report.summary.totalFallbackTriggers > 0) {
      report.summary.canaryHealth = 'degraded';
    }
    if (report.summary.totalAnomalies > 10) {
      report.summary.canaryHealth = 'unhealthy';
    }
    
    // Add rollback recommendations
    for (const [levelIndex, rec] of this._rollbackRecommended) {
      if (rec.recommended) {
        report.recommendations.push({
          levelIndex,
          reason: rec.reason,
          severity: 'critical'
        });
      }
    }
    
    return report;
  }
  
  /**
   * Register callback for anomaly notifications
   * @param {function} callback - Function(levelIndex, type, anomaly)
   */
  onAnomaly(callback) {
    this._anomalyCallbacks.push(callback);
  }
  
  /**
   * Export all metrics for debugging
   * @returns {object}
   */
  export() {
    return {
      config: this.config,
      sessionMetrics: Object.fromEntries(this._sessionMetrics),
      dailyMetrics: this._dailyMetrics,
      rollbackRecommendations: Object.fromEntries(this._rollbackRecommended)
    };
  }
  
  /**
   * Clear all metrics
   */
  clear() {
    this._sessionMetrics.clear();
    this._rollbackRecommended.clear();
  }
  
  // Private methods
  
  _computeLevelSummary(metrics) {
    const samples = metrics.samples;
    const stuckSamples = samples.filter(s => s.isStuck).length;
    const stuckRate = samples.length > 0 ? stuckSamples / samples.length : 0;
    
    const avgVelocity = samples.length > 0
      ? samples.reduce((sum, s) => sum + (s.velocity || 0), 0) / samples.length
      : 0;
    
    return {
      levelIndex: metrics.levelIndex,
      levelName: metrics.levelName,
      aiMode: metrics.aiMode,
      duration: metrics.endTime ? metrics.endTime - metrics.startTime : Date.now() - metrics.startTime,
      sampleCount: samples.length,
      counters: { ...metrics.counters },
      stuckRate,
      avgVelocity,
      anomalyCount: metrics.counters.anomalies,
      fallbackCount: metrics.counters.fallbackTriggers,
      lastSample: metrics.lastSample,
      healthStatus: this._computeHealthStatus({
        avgStuckRate: stuckRate,
        totalAnomalies: metrics.counters.anomalies,
        fallbackTriggers: metrics.counters.fallbackTriggers
      })
    };
  }
  
  _computeHealthStatus(data) {
    const stuckRate = data.avgStuckRate || 0;
    const anomalies = data.totalAnomalies || 0;
    const fallbacks = data.fallbackTriggers || 0;
    
    if (fallbacks > 0 || stuckRate > this.config.rollbackThresholds.stuckEventRate) {
      return 'unhealthy';
    }
    
    if (anomalies > this.config.thresholds.maxStateTransitionAnomalies) {
      return 'degraded';
    }
    
    return 'healthy';
  }
  
  _getAnomalySeverity(type) {
    switch (type) {
      case ANOMALY_TYPES.FALLBACK_TRIGGER:
      case ANOMALY_TYPES.RECOVERY_FAILURE:
        return SEVERITY.CRITICAL;
      case ANOMALY_TYPES.STUCK_EVENT:
      case ANOMALY_TYPES.STATE_LOOP:
        return SEVERITY.WARNING;
      default:
        return SEVERITY.INFO;
    }
  }
  
  _checkRollbackThreshold(levelIndex) {
    const summary = this.getLevelSummary(levelIndex);
    if (!summary || summary.sampleCount < this.config.rollbackThresholds.minSamplesForRecommendation) {
      return;
    }
    
    const thresholds = this.config.rollbackThresholds;
    let recommended = false;
    let reason = null;
    
    // Check stuck rate
    if (summary.stuckRate > thresholds.stuckEventRate) {
      recommended = true;
      reason = `Stuck rate ${(summary.stuckRate * 100).toFixed(1)}% exceeds threshold ${(thresholds.stuckEventRate * 100)}%`;
    }
    
    // Check fallback rate
    const fallbackRate = summary.fallbackCount / summary.sampleCount;
    if (fallbackRate > thresholds.fallbackTriggerRate) {
      recommended = true;
      reason = `Fallback rate ${(fallbackRate * 100).toFixed(1)}% exceeds threshold ${(thresholds.fallbackTriggerRate * 100)}%`;
    }
    
    // Check anomaly rate
    const anomalyRate = summary.anomalyCount / summary.sampleCount;
    if (anomalyRate > thresholds.anomalyRate) {
      recommended = true;
      reason = `Anomaly rate ${(anomalyRate * 100).toFixed(1)}% exceeds threshold ${(thresholds.anomalyRate * 100)}%`;
    }
    
    if (recommended) {
      this._rollbackRecommended.set(levelIndex, { recommended: true, reason });
      this._logEvent('rollback', levelIndex, { reason }, SEVERITY.CRITICAL);
    }
  }
  
  _aggregateDaily(summary) {
    const today = new Date().toISOString().split('T')[0];
    
    if (!this._dailyMetrics[today]) {
      this._dailyMetrics[today] = {
        levels: {},
        lastUpdated: null
      };
    }
    
    const levelKey = `level_${summary.levelIndex}`;
    const dailyLevel = this._dailyMetrics[today].levels[levelKey] || {
      levelIndex: summary.levelIndex,
      levelName: summary.levelName,
      aiMode: summary.aiMode,
      sessionCount: 0,
      totalSamples: 0,
      totalStuckEvents: 0,
      totalAnomalies: 0,
      fallbackTriggers: 0,
      stuckRates: [],
      velocities: []
    };
    
    dailyLevel.sessionCount++;
    dailyLevel.totalSamples += summary.sampleCount;
    dailyLevel.totalStuckEvents += summary.counters.stuckEvents;
    dailyLevel.totalAnomalies += summary.anomalyCount;
    dailyLevel.fallbackTriggers += summary.fallbackCount;
    dailyLevel.stuckRates.push(summary.stuckRate);
    dailyLevel.velocities.push(summary.avgVelocity);
    dailyLevel.avgStuckRate = dailyLevel.stuckRates.reduce((a, b) => a + b, 0) / dailyLevel.stuckRates.length;
    dailyLevel.avgVelocity = dailyLevel.velocities.reduce((a, b) => a + b, 0) / dailyLevel.velocities.length;
    
    this._dailyMetrics[today].levels[levelKey] = dailyLevel;
    this._dailyMetrics[today].lastUpdated = new Date().toISOString();
    
    // Clean up old days
    this._cleanupOldMetrics();
  }
  
  _cleanupOldMetrics() {
    const dates = Object.keys(this._dailyMetrics).sort();
    const maxDays = this.config.report.maxDaysRetention;
    
    while (dates.length > maxDays) {
      const oldest = dates.shift();
      delete this._dailyMetrics[oldest];
    }
  }
  
  _loadDailyMetrics() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {};
    }
    
    try {
      const stored = window.localStorage.getItem(this.config.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.warn('[CanaryMetrics] Failed to load metrics:', e);
      return {};
    }
  }
  
  _saveDailyMetrics() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    try {
      window.localStorage.setItem(
        this.config.storageKey,
        JSON.stringify(this._dailyMetrics)
      );
    } catch (e) {
      console.warn('[CanaryMetrics] Failed to save metrics:', e);
    }
  }
  
  _logEvent(type, levelIndex, data, severity = SEVERITY.INFO) {
    const prefix = `[CanaryMetrics:${type}:${levelIndex}]`;
    const levelName = this._sessionMetrics.get(levelIndex)?.levelName || 'unknown';
    
    const logData = {
      levelIndex,
      levelName,
      ...data
    };
    
    switch (severity) {
      case SEVERITY.CRITICAL:
        console.error(prefix, logData);
        break;
      case SEVERITY.WARNING:
        console.warn(prefix, logData);
        break;
      default:
        if (this.config.debug) {
          console.log(prefix, logData);
        }
    }
  }
}

/**
 * Global metrics logger instance
 */
let globalLogger = null;

/**
 * Get or create global metrics logger
 * @param {object} config - Optional configuration
 * @returns {CanaryMetricsLogger}
 */
export function getCanaryMetricsLogger(config = null) {
  if (!globalLogger) {
    globalLogger = new CanaryMetricsLogger(config);
  } else if (config) {
    globalLogger.config = { ...globalLogger.config, ...config };
  }
  return globalLogger;
}

export default CanaryMetricsLogger;
