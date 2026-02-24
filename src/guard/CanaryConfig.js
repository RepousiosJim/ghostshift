/**
 * Guard AI Canary Configuration
 * 
 * Step 2: Controlled rollout of modular guard AI to selected levels.
 * Enables A/B comparison between legacy and modular AI implementations.
 * 
 * @module guard/CanaryConfig
 */

/**
 * Canary rollout configuration
 * 
 * Levels using modular AI:
 * - 0: Warehouse (simple layout, good baseline)
 * - 3: Comms Tower (moderate complexity)
 * 
 * Levels remaining on legacy:
 * - 1: Labs
 * - 2: Server Farm
 * - 4: The Vault
 * - 5: Training Facility
 * - 6: Penthouse
 */
export const CANARY_CONFIG = {
  // Master switch: set to false to disable all canary mode
  enabled: true,
  
  // Levels using modular guard AI (array of level indices)
  canaryLevels: [0, 3],
  
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
 * Collects performance and behavior metrics for comparison
 */
export class CanaryMetrics {
  constructor(config = CANARY_CONFIG.metrics) {
    this.config = config;
    this.samples = [];
    this.startTime = null;
    this.levelIndex = null;
    this.aiMode = null; // 'modular' or 'legacy'
    this.errorCount = 0;
    this.lastSampleTime = 0;
  }
  
  /**
   * Start metrics collection for a level
   * @param {number} levelIndex - Level index
   * @param {string} aiMode - 'modular' or 'legacy'
   */
  start(levelIndex, aiMode) {
    this.samples = [];
    this.startTime = Date.now();
    this.levelIndex = levelIndex;
    this.aiMode = aiMode;
    this.errorCount = 0;
    this.lastSampleTime = 0;
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
  }
  
  /**
   * Record an error
   */
  recordError() {
    this.errorCount++;
  }
  
  /**
   * Get summary statistics
   * @returns {object}
   */
  getSummary() {
    if (this.samples.length === 0) {
      return { 
        levelIndex: this.levelIndex, 
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
    this.startTime = null;
    return summary;
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
  getFallbackManager
};
