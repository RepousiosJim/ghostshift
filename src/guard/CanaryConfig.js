/**
 * Guard AI Canary Configuration
 * 
 * Step 7 (2026-02-24): FULL ROLLOUT COMPLETE - 100% coverage.
 * All 7 levels now use modular GuardAI. Legacy code is fallback only.
 * 
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  ROLLBACK SWITCH: Set CANARY_CONFIG.enabled = false          ║
 * ║  to revert ALL levels to legacy AI immediately.              ║
 * ║  See ROLLBACK_SWITCH.md for detailed instructions.           ║
 * ╚═══════════════════════════════════════════════════════════════╝
 * 
 * @module guard/CanaryConfig
 */

import { 
  CanaryMetricsLogger, 
  getCanaryMetricsLogger,
  ANOMALY_TYPES 
} from './CanaryMetricsLogger.js';

/**
 * Canary rollout configuration
 * 
 * Step 7: Full rollout complete - all levels now use modular AI.
 * 
 * Levels using modular AI (ALL):
 * - 0: Warehouse (simple layout, good baseline)
 * - 1: Labs (medium complexity)
 * - 2: Server Farm (difficulty 2)
 * - 3: Comms Tower (moderate complexity)
 * - 4: The Vault (high security)
 * - 5: Training Facility (open spaces)
 * - 6: Penthouse (final level)
 * 
 * Coverage: 7 of 7 levels (100%)
 */
export const CANARY_CONFIG = {
  // ═══════════════════════════════════════════════════════════════
  // ⚠️ ROLLBACK SWITCH: Set to false to disable modular AI for ALL levels
  // This is the master kill-switch for emergency rollback
  // See ROLLBACK_SWITCH.md for complete instructions
  // ═══════════════════════════════════════════════════════════════
  enabled: true,
  
  // All levels use modular guard AI (100% rollout)
  canaryLevels: [0, 1, 2, 3, 4, 5, 6],
  
  // Percentage of sessions to enable canary (for future gradual rollout)
  // Currently at 100% for canary levels
  rolloutPercentage: 100,
  
  // Metrics collection settings
  metrics: {
    enabled: true,
    sampleIntervalMs: 500,     // Sample every 500ms
    maxSamples: 120,           // ~1 minute of data
    reportOnSceneEnd: true     // Report when scene ends
  },
  
  // Fallback settings
  fallback: {
    enabled: true,
    errorThreshold: 3,         // Fall back after 3 errors
    recoveryTimeoutMs: 30000   // Try modular again after 30s
  }
};

/**
 * Check if a level should use modular guard AI
 * @param {number} levelIndex - Level index
 * @param {object} options - Override options
 * @returns {boolean}
 */
export function isCanaryLevel(levelIndex, options = {}) {
  // Allow runtime override
  if (options.forceModular !== undefined) {
    return options.forceModular;
  }
  
  // Check global feature flag
  if (typeof window !== 'undefined') {
    // URL param override
    if (window.location?.search?.includes('modularGuard=all')) {
      return true;
    }
    if (window.location?.search?.includes('modularGuard=none')) {
      return false;
    }
    
    // Window property override
    if (window.GHOSTSHIFT_MODULAR_GUARD_AI === true) {
      return true;
    }
    if (window.GHOSTSHIFT_MODULAR_GUARD_AI === false) {
      return false;
    }
  }
  
  // Check canary config
  if (!CANARY_CONFIG.enabled) {
    return false;
  }
  
  // Check if level is in canary list
  return CANARY_CONFIG.canaryLevels.includes(levelIndex);
}

/**
 * Canary metrics collector
 * Collects performance and behavior metrics for comparison.
 * Integrates with CanaryMetricsLogger for structured observability.
 */
export class CanaryMetrics {
  constructor(config = CANARY_CONFIG.metrics) {
    this.config = config;
    this.samples = [];
    this.startTime = null;
    this.levelIndex = null;
    this.levelName = null;
    this.aiMode = null; // 'modular' or 'legacy'
    this.errorCount = 0;
    this.lastSampleTime = 0;
    
    // Reference to structured metrics logger
    this._metricsLogger = null;
    this._lastState = null;
  }
  
  /**
   * Start metrics collection for a level
   * @param {number} levelIndex - Level index
   * @param {string} aiMode - 'modular' or 'legacy'
   * @param {string} levelName - Optional level name
   */
  start(levelIndex, aiMode, levelName = null) {
    this.samples = [];
    this.startTime = Date.now();
    this.levelIndex = levelIndex;
    this.levelName = levelName;
    this.aiMode = aiMode;
    this.errorCount = 0;
    this.lastSampleTime = 0;
    this._lastState = null;
    
    // Start structured logging
    this._metricsLogger = getCanaryMetricsLogger();
    this._metricsLogger.startLevel(levelIndex, levelName || `Level ${levelIndex}`, aiMode);
  }
  
  /**
   * Record a sample
   * @param {object} data - Sample data
   */
  sample(data) {
    if (!this.config.enabled || !this.startTime) return;
    
    const now = Date.now();
    if (now - this.lastSampleTime < this.config.sampleIntervalMs) return;
    
    this.lastSampleTime = now;
    
    this.samples.push({
      time: now - this.startTime,
      ...data
    });
    
    // Trim to max samples
    if (this.samples.length > this.config.maxSamples) {
      this.samples.shift();
    }
    
    // Record to structured logger
    if (this._metricsLogger) {
      this._metricsLogger.sample(this.levelIndex, {
        velocity: data.velocity,
        isStuck: data.isStuck,
        state: data.state,
        guardPosition: data.guardX !== undefined ? { x: data.guardX, y: data.guardY } : null
      });
      
      // Track state transitions
      if (data.state && data.state !== this._lastState) {
        if (this._lastState !== null) {
          this._metricsLogger.recordStateTransition(this.levelIndex, this._lastState, data.state);
        }
        this._lastState = data.state;
      }
      
      // Track stuck events
      if (data.isStuck && !this._lastStuckState) {
        this._metricsLogger.recordStuckEvent(this.levelIndex, {
          position: { x: data.guardX, y: data.guardY },
          velocity: data.velocity
        });
      }
      this._lastStuckState = data.isStuck;
    }
  }
  
  /**
   * Record an error
   */
  recordError() {
    this.errorCount++;
  }
  
  /**
   * Record a fallback trigger
   * @param {string} reason - Fallback reason
   */
  recordFallbackTrigger(reason = 'error_threshold') {
    if (this._metricsLogger) {
      this._metricsLogger.recordFallbackTrigger(this.levelIndex, reason);
    }
  }
  
  /**
   * Get summary statistics
   * @returns {object}
   */
  getSummary() {
    if (this.samples.length === 0) {
      return { 
        levelIndex: this.levelIndex, 
        levelName: this.levelName,
        aiMode: this.aiMode,
        sampleCount: 0,
        errorCount: this.errorCount 
      };
    }
    
    // Calculate stuck rate
    const stuckSamples = this.samples.filter(s => s.isStuck).length;
    const stuckRate = stuckSamples / this.samples.length;
    
    // Calculate average velocity
    const avgVelocity = this.samples.reduce((sum, s) => sum + (s.velocity || 0), 0) / this.samples.length;
    
    // Calculate state distribution
    const stateCounts = {};
    for (const s of this.samples) {
      const state = s.state || 'unknown';
      stateCounts[state] = (stateCounts[state] || 0) + 1;
    }
    
    // Calculate displacement
    const firstPos = this.samples[0];
    const lastPos = this.samples[this.samples.length - 1];
    const totalDisplacement = Math.hypot(
      (lastPos.guardX || 0) - (firstPos.guardX || 0),
      (lastPos.guardY || 0) - (firstPos.guardY || 0)
    );
    
    return {
      levelIndex: this.levelIndex,
      levelName: this.levelName,
      aiMode: this.aiMode,
      sampleCount: this.samples.length,
      durationMs: this.samples[this.samples.length - 1]?.time || 0,
      errorCount: this.errorCount,
      stuckRate,
      avgVelocity,
      totalDisplacement,
      stateDistribution: stateCounts
    };
  }
  
  /**
   * End collection and get final report
   * @returns {object}
   */
  end() {
    const summary = this.getSummary();
    
    // End structured logging
    if (this._metricsLogger) {
      this._metricsLogger.endLevel(this.levelIndex);
    }
    
    this.startTime = null;
    return summary;
  }
  
  /**
   * Get rollback recommendation for current level
   * @returns {{recommended: boolean, reason: string|null}}
   */
  getRollbackRecommendation() {
    if (!this._metricsLogger) {
      return { recommended: false, reason: null };
    }
    return this._metricsLogger.getRollbackRecommendation(this.levelIndex);
  }
}

/**
 * Global canary metrics instance
 */
let globalMetrics = null;

/**
 * Get or create global metrics instance
 * @returns {CanaryMetrics}
 */
export function getCanaryMetrics() {
  if (!globalMetrics) {
    globalMetrics = new CanaryMetrics();
  }
  return globalMetrics;
}

/**
 * Fallback manager for canary mode
 */
export class CanaryFallbackManager {
  constructor(config = CANARY_CONFIG.fallback) {
    this.config = config;
    this.errorCounts = new Map(); // levelIndex -> error count
    this.disabledUntil = new Map(); // levelIndex -> timestamp
  }
  
  /**
   * Check if modular AI should be disabled for a level
   * @param {number} levelIndex - Level index
   * @returns {boolean}
   */
  shouldFallback(levelIndex) {
    if (!this.config.enabled) return false;
    
    // Check if temporarily disabled
    const disabledUntil = this.disabledUntil.get(levelIndex);
    if (disabledUntil && Date.now() < disabledUntil) {
      return true;
    }
    
    // Check error threshold
    const errors = this.errorCounts.get(levelIndex) || 0;
    return errors >= this.config.errorThreshold;
  }
  
  /**
   * Record an error for a level
   * @param {number} levelIndex - Level index
   */
  recordError(levelIndex) {
    const current = this.errorCounts.get(levelIndex) || 0;
    this.errorCounts.set(levelIndex, current + 1);
    
    // If threshold reached, disable temporarily
    if (current + 1 >= this.config.errorThreshold) {
      this.disabledUntil.set(levelIndex, Date.now() + this.config.recoveryTimeoutMs);
    }
  }
  
  /**
   * Reset error count for a level (after successful run)
   * @param {number} levelIndex - Level index
   */
  reset(levelIndex) {
    this.errorCounts.delete(levelIndex);
    this.disabledUntil.delete(levelIndex);
  }
}

/**
 * Global fallback manager instance
 */
let globalFallbackManager = null;

/**
 * Get or create global fallback manager
 * @returns {CanaryFallbackManager}
 */
export function getFallbackManager() {
  if (!globalFallbackManager) {
    globalFallbackManager = new CanaryFallbackManager();
  }
  return globalFallbackManager;
}

export default {
  CANARY_CONFIG,
  isCanaryLevel,
  CanaryMetrics,
  getCanaryMetrics,
  CanaryFallbackManager,
  getFallbackManager,
  getCanaryMetricsLogger,
  ANOMALY_TYPES
};
