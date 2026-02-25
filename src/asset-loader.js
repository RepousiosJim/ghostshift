/**
 * GhostShift Asset Loader
 * 
 * Robust asset loading system with:
 * - Progress tracking and UI updates
 * - Required/optional asset handling
 * - Fallback strategies for failed assets
 * - Cache busting and version management
 * - Error recovery and diagnostics
 * 
 * @module AssetLoader
 */

import {
  ASSET_MANIFEST,
  ASSET_CATEGORIES,
  ASSET_PRIORITY,
  getAssetsByPriority,
  getRequiredAssets,
  hasProceduralFallback,
  getTotalAssetCount,
  ASSET_VERSION
} from './asset-manifest.js';

// Re-export ASSET_CATEGORIES for convenience
export { ASSET_CATEGORIES };

/**
 * Loading state constants
 */
export const LOAD_STATE = {
  IDLE: 'idle',
  LOADING: 'loading',
  COMPLETE: 'complete',
  FAILED: 'failed'
};

/**
 * Individual asset load result
 */
export class AssetLoadResult {
  constructor(asset, success, error = null, fallbackUsed = false) {
    this.asset = asset;
    this.success = success;
    this.error = error;
    this.fallbackUsed = fallbackUsed;
    this.timestamp = Date.now();
  }
}

/**
 * Loader diagnostics for dev mode
 */
export class LoaderDiagnostics {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = 0;
    this.endTime = 0;
    this.results = [];
    this.categoryTimings = {};
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  start() {
    this.reset();
    this.startTime = Date.now();
  }

  end() {
    this.endTime = Date.now();
  }

  recordResult(result) {
    this.results.push(result);
  }

  startCategory(category) {
    this.categoryTimings[category] = {
      start: Date.now(),
      end: null,
      duration: null
    };
  }

  endCategory(category) {
    if (this.categoryTimings[category]) {
      this.categoryTimings[category].end = Date.now();
      this.categoryTimings[category].duration = 
        this.categoryTimings[category].end - this.categoryTimings[category].start;
    }
  }

  recordCacheHit() {
    this.cacheHits++;
  }

  recordCacheMiss() {
    this.cacheMisses++;
  }

  getSummary() {
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success);
    const fallbacks = this.results.filter(r => r.fallbackUsed);
    const duration = this.endTime - this.startTime;

    return {
      totalAssets: this.results.length,
      successful,
      failed: failed.length,
      fallbacksUsed: fallbacks.length,
      duration,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      categoryTimings: this.categoryTimings,
      failedAssets: failed.map(r => ({
        key: r.asset.key,
        error: r.error?.message || 'Unknown error'
      })),
      fallbackAssets: fallbacks.map(r => r.asset.key)
    };
  }

  logSummary() {
    const summary = this.getSummary();
    console.log('[LoaderDiagnostics] ===== LOAD SUMMARY =====');
    console.log(`[LoaderDiagnostics] Total: ${summary.totalAssets} | Success: ${summary.successful} | Failed: ${summary.failed} | Fallbacks: ${summary.fallbacksUsed}`);
    console.log(`[LoaderDiagnostics] Duration: ${summary.duration}ms | Cache: ${summary.cacheHits} hits, ${summary.cacheMisses} misses`);
    
    if (Object.keys(summary.categoryTimings).length > 0) {
      console.log('[LoaderDiagnostics] Category timings:', summary.categoryTimings);
    }
    
    if (summary.failedAssets.length > 0) {
      console.warn('[LoaderDiagnostics] Failed assets:', summary.failedAssets);
    }
    
    if (summary.fallbackAssets.length > 0) {
      console.log('[LoaderDiagnostics] Fallbacks used:', summary.fallbackAssets);
    }
  }
}

/**
 * Global diagnostics instance
 */
export const loaderDiagnostics = new LoaderDiagnostics();

/**
 * Loading Screen UI Controller
 */
export class LoadingScreenUI {
  constructor(scene) {
    this.scene = scene;
    this.elements = {};
    this.visible = false;
  }

  create() {
    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // Background
    this.elements.background = this.scene.add.rectangle(
      centerX, centerY, width, height, 0x0a0a0f
    );

    // Title
    this.elements.title = this.scene.add.text(
      centerX, centerY - 80, 'GHOSTSHIFT', {
        fontSize: '42px',
        fill: '#4488ff',
        fontFamily: 'Courier New',
        fontStyle: 'bold'
      }
    ).setOrigin(0.5);

    // Title glow
    this.elements.title.setShadow(0, 0, '#4488ff', 10, true, true);

    // Subtitle
    this.elements.subtitle = this.scene.add.text(
      centerX, centerY - 40, 'LOADING SYSTEM', {
        fontSize: '14px',
        fill: '#667788',
        fontFamily: 'Courier New',
        letterSpacing: 4
      }
    ).setOrigin(0.5);

    // Progress bar background
    const barWidth = Math.min(400, width - 80);
    const barHeight = 12;
    const barX = centerX - barWidth / 2;
    const barY = centerY + 20;

    this.elements.progressBg = this.scene.add.rectangle(
      centerX, barY, barWidth, barHeight, 0x1a1a2a
    );
    this.elements.progressBg.setStrokeStyle(1, 0x2a3a4a);

    // Progress bar fill
    this.elements.progressFill = this.scene.add.rectangle(
      barX, barY, 0, barHeight - 4, 0x4488ff
    );
    this.elements.progressFill.setOrigin(0, 0.5);

    // Progress percentage text
    this.elements.progressText = this.scene.add.text(
      centerX, barY + 25, '0%', {
        fontSize: '12px',
        fill: '#66aacc',
        fontFamily: 'Courier New'
      }
    ).setOrigin(0.5);

    // Status text (current category/asset)
    this.elements.statusText = this.scene.add.text(
      centerX, barY + 50, 'Initializing...', {
        fontSize: '11px',
        fill: '#556677',
        fontFamily: 'Courier New'
      }
    ).setOrigin(0.5);

    // Error counter
    this.elements.errorContainer = this.scene.add.container(centerX, barY + 80);
    this.elements.errorText = this.scene.add.text(0, 0, '', {
      fontSize: '11px',
      fill: '#ff6666',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);
    this.elements.errorContainer.add(this.elements.errorText);
    this.elements.errorContainer.setVisible(false);

    // Version info
    this.elements.versionText = this.scene.add.text(
      centerX, height - 30, `v${ASSET_VERSION}`, {
        fontSize: '10px',
        fill: '#334455',
        fontFamily: 'Courier New'
      }
    ).setOrigin(0.5);

    // Loading animation (pulsing dots)
    this.elements.loadingDots = this.scene.add.text(
      centerX + 100, centerY - 40, '...', {
        fontSize: '14px',
        fill: '#4488ff',
        fontFamily: 'Courier New'
      }
    ).setOrigin(0.5);

    this.visible = true;
    return this;
  }

  updateProgress(progress, status = null) {
    if (!this.visible) return;

    const barWidth = this.elements.progressBg.width - 4;
    const fillWidth = Math.max(0, barWidth * progress);
    
    this.elements.progressFill.width = fillWidth;
    this.elements.progressText.setText(`${Math.round(progress * 100)}%`);

    if (status) {
      this.elements.statusText.setText(status);
    }

    // Animate loading dots
    const dots = '.'.repeat((Math.floor(Date.now() / 300) % 4));
    this.elements.loadingDots.setText(dots);
  }

  showError(count, message = null) {
    if (!this.visible) return;

    if (count > 0) {
      this.elements.errorText.setText(`⚠ ${count} asset(s) failed to load${message ? `: ${message}` : ''}`);
      this.elements.errorContainer.setVisible(true);
    } else {
      this.elements.errorContainer.setVisible(false);
    }
  }

  showComplete(success = true) {
    if (!this.visible) return;

    if (success) {
      this.elements.progressFill.setFillStyle(0x44ff88);
      this.elements.statusText.setText('Ready!');
      this.elements.statusText.setFill('#44ff88');
    } else {
      this.elements.progressFill.setFillStyle(0xff4444);
      this.elements.statusText.setText('Load failed');
      this.elements.statusText.setFill('#ff4444');
    }
  }

  destroy() {
    Object.values(this.elements).forEach(el => {
      if (el && el.destroy) el.destroy();
    });
    this.visible = false;
  }
}

/**
 * Asset Loader Class
 * Handles loading of all game assets with progress tracking and fallbacks
 */
export class AssetLoader {
  constructor(scene) {
    this.scene = scene;
    this.ui = null;
    this.state = LOAD_STATE.IDLE;
    this.loadedAssets = new Map();
    this.failedAssets = new Map();
    this.fallbackAssets = new Set();
    this.totalAssets = 0;
    this.loadedCount = 0;
  }

  /**
   * Initialize and start loading all assets
   * @param {Object} options - Loading options
   * @returns {Promise<boolean>} True if all required assets loaded
   */
  async loadAll(options = {}) {
    const {
      showUI = true,
      onProgress = null,
      onComplete = null,
      onError = null
    } = options;

    this.state = LOAD_STATE.LOADING;
    loaderDiagnostics.start();

    // Create UI if requested
    if (showUI) {
      this.ui = new LoadingScreenUI(this.scene);
      this.ui.create();
    }

    // Get assets sorted by priority
    const assets = getAssetsByPriority();
    this.totalAssets = assets.length;

    if (this.ui) {
      this.ui.updateProgress(0, 'Starting asset load...');
    }

    // Load assets in priority order
    const results = [];
    for (const asset of assets) {
      const result = await this.loadAsset(asset);
      results.push(result);
      loaderDiagnostics.recordResult(result);

      this.loadedCount++;
      const progress = this.loadedCount / this.totalAssets;

      if (this.ui) {
        this.ui.updateProgress(progress, `Loading ${asset.category}: ${asset.key}`);
      }

      if (onProgress) {
        onProgress(progress, asset);
      }
    }

    // Check for required asset failures
    const requiredFailures = results.filter(r => !r.success && r.asset.required);
    
    if (requiredFailures.length > 0) {
      this.state = LOAD_STATE.FAILED;
      loaderDiagnostics.end();
      
      if (this.ui) {
        this.ui.showComplete(false);
        this.ui.showError(requiredFailures.length, 'Required assets missing');
      }

      if (onError) {
        onError(requiredFailures);
      }

      if (typeof window !== 'undefined' && window.DEBUG_LOADER) {
        loaderDiagnostics.logSummary();
      }

      return false;
    }

    // Success
    this.state = LOAD_STATE.COMPLETE;
    loaderDiagnostics.end();

    const fallbackCount = results.filter(r => r.fallbackUsed).length;
    const failureCount = results.filter(r => !r.success).length;

    if (this.ui) {
      this.ui.showComplete(true);
      if (failureCount > 0) {
        this.ui.showError(failureCount, 'Using fallbacks');
      }
    }

    if (onComplete) {
      onComplete(results);
    }

    if (typeof window !== 'undefined' && window.DEBUG_LOADER) {
      loaderDiagnostics.logSummary();
    }

    return true;
  }

  /**
   * Load a single asset with fallback support
   * @param {Object} asset - Asset definition
   * @returns {Promise<AssetLoadResult>} Load result
   */
  async loadAsset(asset) {
    // Check if already loaded
    if (this.scene.textures.exists(asset.key)) {
      loaderDiagnostics.recordCacheHit();
      return new AssetLoadResult(asset, true, null, false);
    }

    loaderDiagnostics.recordCacheMiss();

    // Add cache-busting query param for version
    const versionedPath = `${asset.path}?v=${asset.version || ASSET_VERSION}`;

    try {
      await this.loadAssetByType(asset, versionedPath);
      this.loadedAssets.set(asset.key, asset);
      return new AssetLoadResult(asset, true, null, false);
    } catch (error) {
      // Asset failed to load
      console.warn(`[AssetLoader] Failed to load ${asset.key}:`, error.message);

      // Try fallback if available
      if (hasProceduralFallback(asset)) {
        this.fallbackAssets.add(asset.key);
        this.failedAssets.set(asset.key, { asset, error, fallbackUsed: true });
        
        // For UI assets, we'll use procedural rendering in the scenes
        // Mark as "successful with fallback"
        return new AssetLoadResult(asset, true, error, true);
      }

      // No fallback available
      this.failedAssets.set(asset.key, { asset, error, fallbackUsed: false });
      return new AssetLoadResult(asset, false, error, false);
    }
  }

  /**
   * Load asset based on type
   * @param {Object} asset - Asset definition
   * @param {string} path - Versioned path
   * @returns {Promise<void>}
   */
  loadAssetByType(asset, path) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Load timeout'));
      }, 10000); // 10 second timeout per asset

      const onComplete = () => {
        clearTimeout(timeout);
        resolve();
      };

      const onError = (file) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load: ${file?.src || path}`));
      };

      try {
        // Check if already in loader queue
        if (this.scene.load.isLoading()) {
          // Add to existing load
          this.queueAssetLoad(asset, path, onComplete, onError);
        } else {
          // Start fresh load
          this.queueAssetLoad(asset, path, onComplete, onError);
          this.scene.load.start();
        }
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });
  }

  /**
   * Queue an asset for loading
   * @param {Object} asset - Asset definition
   * @param {string} path - Asset path
   * @param {Function} onComplete - Success callback
   * @param {Function} onError - Error callback
   */
  queueAssetLoad(asset, path, onComplete, onError) {
    // Set up listeners before adding to queue
    // Use 'filecomplete' event which fires for any file type
    const successKey = `filecomplete`;
    
    const handleSuccess = (key, type, data) => {
      if (key === asset.key) {
        this.scene.load.off(successKey, handleSuccess);
        this.scene.load.off('loaderror', handleError);
        onComplete();
      }
    };

    const handleError = (file) => {
      if (file.key === asset.key) {
        this.scene.load.off(successKey, handleSuccess);
        this.scene.load.off('loaderror', handleError);
        onError(file);
      }
    };

    this.scene.load.on(successKey, handleSuccess);
    this.scene.load.on('loaderror', handleError);

    // Add to loader queue based on type
    switch (asset.type) {
      case 'image':
        this.scene.load.image(asset.key, path);
        break;
      case 'svg':
        this.scene.load.svg(asset.key, path, { scale: 1 });
        break;
      case 'spritesheet':
        this.scene.load.spritesheet(asset.key, path, asset.frameConfig || {});
        break;
      case 'audio':
        this.scene.load.audio(asset.key, path);
        break;
      default:
        this.scene.load.off(successKey, handleSuccess);
        this.scene.load.off('loaderror', handleError);
        throw new Error(`Unknown asset type: ${asset.type}`);
    }
  }

  /**
   * Check if an asset is available (loaded or has fallback)
   * @param {string} key - Asset key
   * @returns {boolean} True if available
   */
  isAssetAvailable(key) {
    return this.scene.textures.exists(key) || this.fallbackAssets.has(key);
  }

  /**
   * Check if an asset is using fallback
   * @param {string} key - Asset key
   * @returns {boolean} True if using fallback
   */
  isUsingFallback(key) {
    return this.fallbackAssets.has(key);
  }

  /**
   * Get load statistics
   * @returns {Object} Load stats
   */
  getStats() {
    return {
      total: this.totalAssets,
      loaded: this.loadedAssets.size,
      failed: this.failedAssets.size,
      fallbacks: this.fallbackAssets.size,
      state: this.state
    };
  }

  /**
   * Destroy UI and cleanup
   */
  destroy() {
    if (this.ui) {
      this.ui.destroy();
      this.ui = null;
    }
  }
}

/**
 * Ready Gate - Validates that required assets are loaded before scene transitions
 */
export class ReadyGate {
  constructor(scene) {
    this.scene = scene;
    this.validated = false;
    this.blockingAssets = [];
  }

  /**
   * Validate that all required assets are available
   * @returns {Object} { ready, blockingAssets, canProceedWithFallbacks }
   */
  validate() {
    const requiredAssets = getRequiredAssets();
    this.blockingAssets = [];

    for (const asset of requiredAssets) {
      if (!this.scene.textures.exists(asset.key)) {
        this.blockingAssets.push(asset);
      }
    }

    this.validated = this.blockingAssets.length === 0;

    return {
      ready: this.validated,
      blockingAssets: this.blockingAssets,
      canProceedWithFallbacks: this.blockingAssets.every(a => hasProceduralFallback(a))
    };
  }

  /**
   * Wait for assets to be ready, with optional timeout
   * @param {number} timeout - Max wait time in ms
   * @returns {Promise<boolean>} True if ready
   */
  async waitForReady(timeout = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = this.validate();
      if (result.ready || result.canProceedWithFallbacks) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
  }
}

// Export singleton instances for convenience
export const createAssetLoader = (scene) => new AssetLoader(scene);
export const createReadyGate = (scene) => new ReadyGate(scene);
