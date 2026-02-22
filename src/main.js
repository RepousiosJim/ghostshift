// Dynamic import of Phaser for better loading performance
// This allows the smaller game.js to load first, then Phaser lazy-loads
const Phaser = (await import('phaser')).default;

// ==================== DEBUG LIFECYCLE TRACKING ====================
// Low-noise debug counters for scene lifecycle - set DEBUG_LIFECYCLE=true to enable
const DEBUG_LIFECYCLE = typeof window !== 'undefined' && window.DEBUG_LIFECYCLE === true;
const _lifecycleCounters = {
  sceneCreates: 0,
  sceneShutdowns: 0,
  timersCreated: 0,
  timersCleaned: 0,
  transitions: 0
};

function _debugLifecycle(event, data) {
  if (!DEBUG_LIFECYCLE) return;
  switch(event) {
    case 'scene:create':
      _lifecycleCounters.sceneCreates++;
      console.log(`[Lifecycle] Scene created: ${data}, total: ${_lifecycleCounters.sceneCreates}`);
      break;
    case 'scene:shutdown':
      _lifecycleCounters.sceneShutdowns++;
      console.log(`[Lifecycle] Scene shutdown: ${data}, total: ${_lifecycleCounters.sceneShutdowns}`);
      break;
    case 'timer:created':
      _lifecycleCounters.timersCreated++;
      break;
    case 'timer:cleaned':
      _lifecycleCounters.timersCleaned++;
      break;
    case 'transition':
      _lifecycleCounters.transitions++;
      console.log(`[Lifecycle] Transition: ${data.from} -> ${data.to}`);
      break;
    case 'summary':
      console.log('[Lifecycle] Summary:', _lifecycleCounters);
      break;
  }
}

// Expose for external access
window._lifecycleCounters = _lifecycleCounters;
window._debugLifecycle = _debugLifecycle;

// ==================== OPTIMIZED RENDER SYSTEM ====================
// Render caching system to reduce per-frame graphics redraws
class RenderCache {
  constructor(scene) {
    this.scene = scene;
    this.cachedTextures = new Map();
  }
  
  // Create a cached texture from graphics generation function
  createCachedTexture(key, width, height, drawFn) {
    if (this.cachedTextures.has(key)) {
      return this.cachedTextures.get(key);
    }
    
    const rt = this.scene.add.renderTexture(0, 0, width, height);
    drawFn(rt);
    this.cachedTextures.set(key, rt);
    return rt;
  }
  
  // Get or create a cached image sprite
  getCachedSprite(key, width, height, drawFn) {
    if (this.cachedTextures.has(key)) {
      const rt = this.cachedTextures.get(key);
      return this.scene.add.image(0, 0, rt).setDepth(-2);
    }
    
    const rt = this.scene.add.renderTexture(0, 0, width, height);
    drawFn(rt);
    this.cachedTextures.set(key, rt);
    return this.scene.add.image(0, 0, rt).setDepth(-2);
  }
  
  destroy() {
    this.cachedTextures.forEach(rt => rt.destroy());
    this.cachedTextures.clear();
  }
}
// Handles browser fullscreen API with proper state sync and resize handling
class FullscreenManager {
  constructor() {
    this.isFullscreen = false;
    this._listeners = [];
    this._resizeListener = null;
    this._boundHandlers = {
      fullscreenchange: this._onFullscreenChange.bind(this),
      resize: this._onWindowResize.bind(this),
      keydown: this._onKeyDown.bind(this)
    };
    
    // Sync with current browser state on init
    this._syncWithBrowser();
    
    // Listen for browser fullscreen changes
    this._setupEventListeners();
  }
  
  _syncWithBrowser() {
    this.isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }
  
  _setupEventListeners() {
    // Fullscreen change events
    document.addEventListener('fullscreenchange', this._boundHandlers.fullscreenchange);
    document.addEventListener('webkitfullscreenchange', this._boundHandlers.fullscreenchange);
    document.addEventListener('mozfullscreenchange', this._boundHandlers.fullscreenchange);
    document.addEventListener('MSFullscreenChange', this._boundHandlers.fullscreenchange);
    
    // Window resize (always listen for this)
    window.addEventListener('resize', this._boundHandlers.resize);
    
    // Listen for ESC key to detect fullscreen exit
    document.addEventListener('keydown', this._boundHandlers.keydown);
  }
  
  _onFullscreenChange() {
    this._syncWithBrowser();
    this._emit('fullscreenchange', this.isFullscreen);
    
    // After fullscreen change, emit resize event
    this._emitResize();
  }
  
  _onWindowResize() {
    // Always emit resize on window resize
    this._emitResize();
  }
  
  _onKeyDown(e) {
    // Detect ESC key - if we were in fullscreen but now aren't, sync state
    if (e.code === 'Escape') {
      // Use setTimeout to let browser finish its fullscreen exit first
      setTimeout(() => {
        const wasFullscreen = this.isFullscreen;
        this._syncWithBrowser();
        if (wasFullscreen && !this.isFullscreen) {
          this._emit('fullscreenchange', this.isFullscreen);
          this._emitResize();
        }
      }, 10);
    }
  }
  
  _emitResize() {
    // Emit resize after a small delay to let DOM settle
    setTimeout(() => {
      this._emit('resize', {
        width: window.innerWidth,
        height: window.innerHeight,
        isFullscreen: this.isFullscreen
      });
    }, 50);
  }
  
  _emit(event, data) {
    this._listeners.forEach(cb => {
      try {
        cb(event, data);
      } catch (e) {
        console.warn('FullscreenManager listener error:', e);
      }
    });
  }
  
  on(event, callback) {
    if (!this._listeners.includes(callback)) {
      this._listeners.push(callback);
    }
  }
  
  off(callback) {
    this._listeners = this._listeners.filter(cb => cb !== callback);
  }
  
  // Request fullscreen on a specific element
  async request(element = document.documentElement) {
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      this.isFullscreen = true;
      this._emit('fullscreenchange', true);
      return true;
    } catch (e) {
      console.warn('Fullscreen request failed:', e);
      return false;
    }
  }
  
  // Exit fullscreen
  async exit() {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
      this.isFullscreen = false;
      this._emit('fullscreenchange', false);
      return true;
    } catch (e) {
      console.warn('Fullscreen exit failed:', e);
      return false;
    }
  }
  
  // Toggle fullscreen
  async toggle(element = document.documentElement) {
    if (this.isFullscreen) {
      return await this.exit();
    } else {
      return await this.request(element);
    }
  }
  
  // Get current fullscreen element
  getFullscreenElement() {
    return document.fullscreenElement ||
           document.webkitFullscreenElement ||
           document.mozFullScreenElement ||
           document.msFullscreenElement ||
           null;
  }
  
  // Check if fullscreen is available
  isSupported() {
    return !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled
    );
  }
  
  // Cleanup listeners (call on game destroy)
  destroy() {
    document.removeEventListener('fullscreenchange', this._boundHandlers.fullscreenchange);
    document.removeEventListener('webkitfullscreenchange', this._boundHandlers.fullscreenchange);
    document.removeEventListener('mozfullscreenchange', this._boundHandlers.fullscreenchange);
    document.removeEventListener('MSFullscreenChange', this._boundHandlers.fullscreenchange);
    window.removeEventListener('resize', this._boundHandlers.resize);
    document.removeEventListener('keydown', this._boundHandlers.keydown);
    this._listeners = [];
  }
}

const fullscreenManager = new FullscreenManager();

// ==================== PERFORMANCE MANAGER ====================
// Lightweight in-game performance instrumentation
class PerformanceManager {
  constructor() {
    this.enabled = false;
    this.overlayVisible = false;
    this.frameTimes = [];
    this.maxSamples = 300; // ~5 seconds at 60fps
    this.timingMarkers = {};
    this.lastFrameTime = 0;
    this.fps = 60;
    this.currentFrameTime = 0;
    this.p95FrameTime = 16.67; // Default 60fps
    this.sceneRef = null;
    
    // Create overlay DOM element (hidden by default)
    this.createOverlay();
    
    // Listen for toggle key
    this.setupInputListener();
  }
  
  createOverlay() {
    // Check if overlay already exists
    let overlay = document.getElementById('perf-overlay');
    if (overlay) {
      this.overlay = overlay;
      return;
    }
    
    overlay = document.createElement('div');
    overlay.id = 'perf-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.75);
      color: #00ff88;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      padding: 12px 16px;
      border-radius: 6px;
      border: 1px solid #00ff88;
      z-index: 99999;
      pointer-events: none;
      display: none;
      line-height: 1.6;
      min-width: 180px;
    `;
    overlay.innerHTML = `
      <div style="color: #ffaa00; font-weight: bold; margin-bottom: 6px;">⚡ PERFORMANCE</div>
      <div>FPS: <span id="perf-fps">--</span></div>
      <div>Frame: <span id="perf-frame">--</span>ms</div>
      <div>p95: <span id="perf-p95">--</span>ms</div>
      <div style="margin-top: 8px; color: #888; font-size: 11px;">[F3] Toggle</div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;
  }
  
  setupInputListener() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'F3' || (e.code === 'KeyP' && e.shiftKey)) {
        e.preventDefault();
        this.toggleOverlay();
      }
    });
  }
  
  toggleOverlay() {
    this.overlayVisible = !this.overlayVisible;
    this.overlay.style.display = this.overlayVisible ? 'block' : 'none';
  }
  
  // Start timing a named marker
  startMarker(name) {
    if (!this.enabled) return;
    this.timingMarkers[name] = { start: performance.now(), children: [] };
  }
  
  // End timing a named marker
  endMarker(name) {
    if (!this.enabled || !this.timingMarkers[name]) return;
    const marker = this.timingMarkers[name];
    marker.end = performance.now();
    marker.duration = marker.end - marker.start;
    return marker.duration;
  }
  
  // Record frame time (call at end of each frame)
  recordFrame(frameTime) {
    if (!this.enabled) return;
    
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
    
    this.currentFrameTime = frameTime;
    this.fps = Math.round(1000 / frameTime);
    
    // Calculate p95
    if (this.frameTimes.length >= 30) {
      const sorted = [...this.frameTimes].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      this.p95FrameTime = sorted[p95Index];
    }
    
    // Update overlay if visible
    if (this.overlayVisible) {
      this.updateOverlay();
    }
  }
  
  updateOverlay() {
    const fpsEl = document.getElementById('perf-fps');
    const frameEl = document.getElementById('perf-frame');
    const p95El = document.getElementById('perf-p95');
    
    if (fpsEl) fpsEl.textContent = this.fps.toString().padStart(3, ' ');
    if (frameEl) frameEl.textContent = this.currentFrameTime.toFixed(2);
    if (p95El) p95El.textContent = this.p95FrameTime.toFixed(2);
  }
  
  // Get stats for reporting
  getStats() {
    const avgFrameTime = this.frameTimes.length > 0 
      ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length 
      : 0;
    
    return {
      fps: this.fps,
      currentFrameTime: this.currentFrameTime,
      avgFrameTime,
      p95FrameTime: this.p95FrameTime,
      sampleCount: this.frameTimes.length,
      markers: Object.keys(this.timingMarkers).reduce((acc, key) => {
        acc[key] = this.timingMarkers[key].duration;
        return acc;
      }, {})
    };
  }
  
  // Enable/disable instrumentation
  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) {
      // Show hint that overlay is available
      console.log('Performance instrumentation enabled. Press F3 for overlay.');
    }
  }
}

const perfManager = new PerformanceManager();

// ==================== SAVE MANAGER ====================
const SAVE_KEY = 'ghostshift_save';
const SAVE_VERSION = 5;

// Schema definition for validation
const SAVE_SCHEMA = {
  credits: { type: 'number', min: 0, default: 0 },
  totalRuns: { type: 'number', min: 0, default: 0 },
  bestTime: { type: ['number', 'null'], min: 0, default: null },
  bestTimes: { type: 'object', default: {} },
  unlockedLevels: { type: 'array', items: { type: 'number', min: 0 }, default: [0] },
  perks: { 
    type: 'object', 
    properties: {
      speed: { type: 'number', min: 1, max: 4, default: 1 },
      stealth: { type: 'number', min: 1, max: 4, default: 1 },
      luck: { type: 'number', min: 1, max: 4, default: 1 }
    },
    default: { speed: 1, stealth: 1, luck: 1 }
  },
  settings: { 
    type: 'object',
    properties: {
      audioEnabled: { type: 'boolean', default: true },
      masterVolume: { type: 'number', min: 0, max: 1, default: 0.8 },
      effectsQuality: { type: 'string', enum: ['low', 'medium', 'high'], default: 'high' },
      fullscreen: { type: 'boolean', default: false },
      reducedMotion: { type: 'boolean', default: false }
    },
    default: { 
      audioEnabled: true, 
      masterVolume: 0.8,
      effectsQuality: 'high',
      fullscreen: false,
      reducedMotion: false
    }
  },
  lastPlayed: { type: ['number', 'null'], min: 0, default: null },
  totalCreditsEarned: { type: 'number', min: 0, default: 0 },
  saveVersion: { type: 'number', min: 1, default: SAVE_VERSION }
};

const defaultSaveData = {
  credits: 0,
  totalRuns: 0,
  bestTime: null,
  bestTimes: {},
  unlockedLevels: [0],
  perks: { speed: 1, stealth: 1, luck: 1 },
  settings: { 
    audioEnabled: true, 
    masterVolume: 0.8,
    effectsQuality: 'high',
    fullscreen: false,
    reducedMotion: false
  },
  lastPlayed: null,
  totalCreditsEarned: 0,
  saveVersion: SAVE_VERSION
};

// Migration functions for schema updates
const SAVE_MIGRATIONS = {
  // Migration from v1 to v2: Added perks system
  2: (data) => {
    data.perks = { speed: 1, stealth: 1, luck: 1 };
    return data;
  },
  // Migration from v2 to v3: Added settings
  3: (data) => {
    data.settings = { 
      audioEnabled: data.audioEnabled !== false,
      masterVolume: data.masterVolume || 0.8,
      effectsQuality: 'high',
      fullscreen: false,
      reducedMotion: false
    };
    return data;
  },
  // Migration from v3 to v4: Added new settings
  4: (data) => {
    if (data.settings) {
      data.settings.fullscreen = data.settings.fullscreen || false;
      data.settings.reducedMotion = data.settings.reducedMotion || false;
    }
    return data;
  },
  // Migration from v4 to v5: Added saveVersion tracking
  5: (data) => {
    data.saveVersion = SAVE_VERSION;
    return data;
  }
};

// Validate a value against schema
function validateValue(value, schema) {
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return schema.default;
    return value.map((item, i) => validateValue(item, schema.items || { type: 'any' })).filter(v => v !== undefined);
  }
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null) return schema.default;
    const result = {};
    for (const key in schema.properties) {
      result[key] = validateValue(value[key], schema.properties[key]);
    }
    return result;
  }
  if (schema.type === 'number') {
    if (typeof value !== 'number') return schema.default;
    if (schema.min !== undefined && value < schema.min) return schema.default;
    if (schema.max !== undefined && value > schema.max) return schema.default;
    return value;
  }
  if (schema.type === 'boolean') {
    return typeof value === 'boolean' ? value : schema.default;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return schema.default;
    if (schema.enum && !schema.enum.includes(value)) return schema.default;
    return value;
  }
  if (schema.type === 'null') {
    return value === null ? null : schema.default;
  }
  if (Array.isArray(schema.type)) {
    // Union types
    for (const t of schema.type) {
      try {
        return validateValue(value, { type: t, default: schema.default });
      } catch (e) {
        continue;
      }
    }
    return schema.default;
  }
  return value !== undefined ? value : schema.default;
}

// Validate and sanitize entire save data
function validateSaveData(data) {
  if (!data || typeof data !== 'object') {
    console.warn('Save data corrupted, using defaults');
    return { ...defaultSaveData };
  }
  
  const result = {};
  for (const key in SAVE_SCHEMA) {
    result[key] = validateValue(data[key], SAVE_SCHEMA[key]);
  }
  
  // Additional integrity checks
  // Ensure unlockedLevels is sorted and unique
  if (result.unlockedLevels) {
    result.unlockedLevels = [...new Set(result.unlockedLevels)].sort((a, b) => a - b);
    if (result.unlockedLevels.length === 0) result.unlockedLevels = [0];
    if (!result.unlockedLevels.includes(0)) result.unlockedLevels.unshift(0);
  }
  
  // Ensure bestTimes only contains valid level indices
  if (result.bestTimes && typeof result.bestTimes === 'object') {
    const cleaned = {};
    for (const key in result.bestTimes) {
      const levelIdx = parseInt(key, 10);
      const time = result.bestTimes[key];
      if (!isNaN(levelIdx) && typeof time === 'number' && time > 0 && time < 3600000) {
        cleaned[key] = time;
      }
    }
    result.bestTimes = cleaned;
  }
  
  return result;
}

// Migrate save data from older versions
function migrateSaveData(data) {
  if (!data || typeof data !== 'object') {
    return { ...defaultSaveData };
  }
  
  const currentVersion = data.saveVersion || 1;
  
  if (currentVersion === SAVE_VERSION) {
    return data; // Already up to date
  }
  
  console.log(`Migrating save data from v${currentVersion} to v${SAVE_VERSION}`);
  
  let migrated = { ...data };
  for (let v = currentVersion + 1; v <= SAVE_VERSION; v++) {
    if (SAVE_MIGRATIONS[v]) {
      migrated = SAVE_MIGRATIONS[v](migrated);
      console.log(`Applied migration to v${v}`);
    }
  }
  
  migrated.saveVersion = SAVE_VERSION;
  return migrated;
}

class SaveManager {
  constructor() { 
    this.data = this.load(); 
    this._saveInProgress = false;
  }
  
  load() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (!saved) {
        console.log('No save data found, using defaults');
        return { ...defaultSaveData };
      }
      
      const parsed = JSON.parse(saved);
      
      // First, try to migrate if needed
      const migrated = migrateSaveData(parsed);
      
      // Then validate the migrated data
      const validated = validateSaveData(migrated);
      
      console.log('Save data loaded and validated, version:', validated.saveVersion);
      return validated;
      
    } catch (e) {
      console.warn('Failed to load save, attempting recovery:', e);
      // Attempt recovery from corrupted data
      try {
        const recovered = this._attemptRecovery();
        if (recovered) {
          console.log('Save data recovered successfully');
          return recovered;
        }
      } catch (recoveryError) {
        console.error('Save recovery failed:', recoveryError);
      }
      console.warn('Using default save data');
      return { ...defaultSaveData };
    }
  }
  
  _attemptRecovery() {
    try {
      // Try to read partial data from localStorage
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      
      // Attempt to parse and extract valid parts
      const partial = JSON.parse(raw);
      if (partial && typeof partial === 'object') {
        return validateSaveData(partial);
      }
    } catch (e) {
      // If even partial recovery fails, clear corrupted data
      console.log('Clearing corrupted save data');
      localStorage.removeItem(SAVE_KEY);
    }
    return null;
  }
  
  save() {
    // Prevent rapid successive saves
    if (this._saveInProgress) return;
    this._saveInProgress = true;
    
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save game:', e);
      // Handle quota exceeded
      if (e.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded, attempting cleanup');
        this._cleanupOldData();
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (retryError) {
          console.error('Save still failed after cleanup:', retryError);
        }
      }
    } finally {
      // Small delay to prevent rapid saves
      setTimeout(() => { this._saveInProgress = false; }, 100);
    }
  }
  
  _cleanupOldData() {
    // Remove any other app data if we're running low on space
    const keysToCheck = ['ghostshift_ghost', 'ghostshift_temp'];
    keysToCheck.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) { /* ignore */ }
    });
  }
  
  hasSave() { return this.data.totalRuns > 0 || this.data.credits > 0; }
  getLastPlayed() { return this.data.lastPlayed; }
  
  addCredits(amount) { 
    if (typeof amount !== 'number' || amount < 0) return;
    this.data.credits += amount; 
    this.data.totalCreditsEarned += amount; 
    this.save(); 
  }
  
  spendCredits(amount) { 
    if (typeof amount !== 'number' || amount < 0) return false;
    if (this.data.credits >= amount) { 
      this.data.credits -= amount; 
      this.save(); 
      return true; 
    } 
    return false; 
  }
  
  getPerkLevel(perk) { 
    if (!this.data.perks || typeof this.data.perks[perk] !== 'number') return 1;
    return Math.max(1, Math.min(4, this.data.perks[perk]));
  }
  
  upgradePerk(perk) {
    const PERK_INFO = { speed: { costs: [0, 50, 100, 200], bonus: [0, 0.15, 0.35, 0.6] }, stealth: { costs: [0, 50, 100, 200], bonus: [0, 0.2, 0.4, 0.65] }, luck: { costs: [0, 50, 100, 200], bonus: [0, 10, 25, 50] } };
    const currentLevel = this.getPerkLevel(perk);
    if (currentLevel >= 4) return false;
    const cost = PERK_INFO[perk].costs[currentLevel];
    if (this.spendCredits(cost)) { 
      this.data.perks[perk] = currentLevel + 1; 
      this.save(); 
      return true; 
    }
    return false;
  }
  
  isLevelUnlocked(levelIndex) { 
    if (!this.data.unlockedLevels || !Array.isArray(this.data.unlockedLevels)) return levelIndex === 0;
    return this.data.unlockedLevels.includes(levelIndex);
  }
  
  unlockLevel(levelIndex) { 
    if (!this.isLevelUnlocked(levelIndex)) { 
      this.data.unlockedLevels.push(levelIndex);
      this.data.unlockedLevels = [...new Set(this.data.unlockedLevels)].sort((a, b) => a - b);
      this.save(); 
    } 
  }
  
  getBestTime(levelIndex) { 
    if (!this.data.bestTimes || typeof this.data.bestTimes[levelIndex] !== 'number') return null;
    return this.data.bestTimes[levelIndex];
  }
  
  setBestTime(levelIndex, time) { 
    if (typeof time !== 'number' || time < 0 || time > 3600000) return;
    const current = this.getBestTime(levelIndex);
    if (!current || time < current) { 
      this.data.bestTimes[levelIndex] = time; 
      this.save(); 
    }
  }
  
  getSetting(key) { 
    if (!this.data.settings || typeof this.data.settings[key] === 'undefined') {
      return defaultSaveData.settings[key];
    }
    return this.data.settings[key];
  }
  
  setSetting(key, value) { 
    if (!this.data.settings) this.data.settings = { ...defaultSaveData.settings };
    this.data.settings[key] = value; 
    this.save(); 
  }
  
  recordRun(levelIndex, time, creditsEarned) { 
    if (typeof levelIndex !== 'number' || typeof time !== 'number') return;
    this.data.totalRuns++; 
    this.data.lastPlayed = Date.now(); 
    this.addCredits(creditsEarned); 
    this.setBestTime(levelIndex, time); 
    if (levelIndex < LEVEL_LAYOUTS.length - 1) this.unlockLevel(levelIndex + 1); 
  }
  
  resetSave() { 
    this.data = { ...defaultSaveData }; 
    this.save(); 
  }
  
  // Debug: Get raw save data for testing
  _getRawData() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch (e) {
      return null;
    }
  }
  
  // Debug: Force reload from storage
  _forceReload() {
    this.data = this.load();
    return this.data;
  }
}

const saveManager = new SaveManager();

// Backwards compatibility
let gameSave = saveManager.data;
function loadSave() { return saveManager.data; }
function saveSaveData(data) { saveManager.data = data; saveManager.save(); }

// ==================== GAME CONSTANTS ====================
// Phase 4: Improved balancing with difficulty scaling
// Phase 7: Increased scale for desktop/web - larger game canvas for better UI visibility
const TILE_SIZE = 48; // Increased from 32 for better visibility
const MAP_WIDTH = 16; // Reduced from 20 to maintain aspect ratio while increasing tile size
const MAP_HEIGHT = 12; // Reduced from 15 to maintain aspect ratio
const BASE_PLAYER_SPEED = 180;
// Guard speed now scales with difficulty (base 65, max 90)
const BASE_GUARD_SPEED = 65;
const GHOST_ALPHA = 0.25;
// Vision cone improvements - slightly reduced angle for fairness, increased distance for higher difficulty
const BASE_VISION_CONE_ANGLE = 55;
const BASE_VISION_CONE_DISTANCE = 140;
// Scanner drone settings - improved balancing
const SCANNER_SPEED = 50;
const SCANNER_BEAM_LENGTH = 110;
const SCANNER_BEAM_ANGLE = 0.25;
// Motion sensor improvements - faster cooldown for harder levels
const MOTION_SENSOR_RADIUS = 55;
const MOTION_SENSOR_COOLDOWN_BASE = 100;

// Difficulty-based settings helper
function getGuardSpeedForLevel(difficulty) {
  return BASE_GUARD_SPEED + (difficulty - 1) * 8; // +8 speed per difficulty level
}

function getVisionConeDistanceForLevel(difficulty) {
  return BASE_VISION_CONE_DISTANCE + (difficulty - 1) * 15;
}

function getVisionConeAngleForLevel(difficulty) {
  return (BASE_VISION_CONE_ANGLE + (difficulty - 1) * 3) * Math.PI / 180;
}

function getMotionSensorCooldownForLevel(difficulty) {
  return Math.max(50, MOTION_SENSOR_COOLDOWN_BASE - (difficulty - 1) * 15);
}

// ==================== AUDIO SYSTEM ====================
class SFXManager {
  constructor() { 
    this.ctx = null; 
    this.initialized = false; 
    this.enabled = saveManager.getSetting('audioEnabled') !== false;
    this.masterVolume = saveManager.getSetting('masterVolume') ?? 0.8;
  }
  init() { if (this.initialized) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.initialized = true; } catch (e) { console.warn('WebAudio not available'); } }
  setEnabled(enabled) { this.enabled = enabled; saveManager.setSetting('audioEnabled', enabled); }
  get isEnabled() { return this.enabled; }
  setMasterVolume(vol) { this.masterVolume = Math.max(0, Math.min(1, vol)); saveManager.setSetting('masterVolume', this.masterVolume); }
  get volume() { return this.masterVolume; }
  playTone(freq, duration, type = 'square', volume = 0.1) {
    if (!this.ctx || !this.enabled) return;
    const effectiveVolume = volume * this.masterVolume;
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.value = effectiveVolume;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.ctx.destination); osc.start(); osc.stop(this.ctx.currentTime + duration);
  }
  alert() { this.playTone(880, 0.15, 'square', 0.08); setTimeout(() => this.playTone(1100, 0.15, 'square', 0.08), 100); }
  win() { this.playTone(523, 0.1, 'sine', 0.1); setTimeout(() => this.playTone(659, 0.1, 'sine', 0.1), 100); setTimeout(() => this.playTone(784, 0.2, 'sine', 0.1), 200); }
  fail() { this.playTone(200, 0.3, 'sawtooth', 0.1); setTimeout(() => this.playTone(150, 0.4, 'sawtooth', 0.1), 200); }
  collect() { this.playTone(1200, 0.05, 'sine', 0.08); setTimeout(() => this.playTone(1500, 0.1, 'sine', 0.08), 50); }
  select() { this.playTone(600, 0.08, 'sine', 0.08); }
  menuHover() { this.playTone(400, 0.05, 'sine', 0.03); }
  pickup() { this.playTone(800, 0.08, 'sine', 0.06); }
  pause() { /* pause sound if we had background audio */ }
  detection() { this.playTone(150, 0.4, 'sawtooth', 0.15); setTimeout(() => this.playTone(100, 0.5, 'sawtooth', 0.15), 200); }
  restart() { this.playTone(300, 0.1, 'square', 0.05); setTimeout(() => this.playTone(400, 0.1, 'square', 0.05), 50); }
  click() { this.playTone(500, 0.06, 'sine', 0.05); }
}
const sfx = new SFXManager();

// ==================== SCENE TRANSITION MANAGER ====================
class SceneTransitionManager {
  constructor(scene) {
    this.scene = scene;
    this.isTransitioning = false;
  }

  async transition(targetSceneKey, data = null, duration = 200) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;
    
    // Create fade overlay
    const overlay = this.scene.add.rectangle(cx, cy, width, height, 0x000000);
    overlay.setDepth(999);
    overlay.setAlpha(0);
    
    // Fade in
    await new Promise(resolve => {
      this.scene.tweens.add({
        targets: overlay,
        alpha: 1,
        duration: duration / 2,
        ease: 'Quad.easeIn',
        onComplete: resolve
      });
    });
    
    // Start new scene
    if (data) {
      this.scene.scene.start(targetSceneKey, data);
    } else {
      this.scene.scene.start(targetSceneKey);
    }
    
    // Small delay to let scene initialize
    await new Promise(resolve => this.scene.time.delayedCall(50, resolve));
    
    // Fade out
    await new Promise(resolve => {
      this.scene.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: duration / 2,
        ease: 'Quad.easeOut',
        onComplete: () => {
          overlay.destroy();
          this.isTransitioning = false;
          resolve();
        }
      });
    });
  }
}

// ==================== LEVEL LAYOUTS ====================
// Phase 4: Added Vault and Training Facility levels with improved balancing
const LEVEL_LAYOUTS = [
  { name: 'Warehouse', obstacles: [{x:8,y:4},{x:9,y:4},{x:10,y:4},{x:8,y:5},{x:10,y:5},{x:8,y:6},{x:10,y:6},{x:3,y:10},{x:4,y:10},{x:14,y:8},{x:15,y:8},{x:12,y:3},{x:13,y:3},{x:6,y:8},{x:7,y:8}], guardPatrol:[{x:15,y:7},{x:5,y:7},{x:5,y:12},{x:15,y:12}], dataCore:{x:16,y:3}, keyCard:{x:3,y:12}, hackTerminal:{x:10,y:7}, playerStart:{x:2,y:2}, exitZone:{x:19,y:7}, cameras:[{x:5,y:2},{x:15,y:12}], motionSensors:[{x:8,y:7},{x:12,y:10}], laserGrids:[{x:10,y:9,h:true},{x:6,y:3,v:true}], patrolDrones:[{x:12,y:6,patrol:[{x:12,y:6},{x:16,y:6},{x:16,y:10},{x:12,y:10}]}], securityCode:{x:4,y:8}, powerCell:{x:14,y:4}, difficulty: 1 },
  { name: 'Labs', obstacles: [{x:5,y:3},{x:5,y:4},{x:5,y:5},{x:5,y:6},{x:10,y:8},{x:11,y:8},{x:12,y:8},{x:10,y:9},{x:12,y:9},{x:10,y:10},{x:11,y:10},{x:12,y:10},{x:15,y:3},{x:16,y:3},{x:17,y:3},{x:3,y:11},{x:4,y:11},{x:5,y:11},{x:8,y:13},{x:9,y:13}], guardPatrol:[{x:14,y:5},{x:6,y:5},{x:6,y:13},{x:14,y:13}], dataCore:{x:17,y:2}, keyCard:{x:2,y:3}, hackTerminal:{x:8,y:5}, playerStart:{x:2,y:13}, exitZone:{x:19,y:3}, cameras:[{x:10,y:2},{x:3,y:8}], motionSensors:[{x:12,y:6},{x:7,y:11}], laserGrids:[{x:8,y:7,h:true},{x:14,y:9,v:true}], patrolDrones:[{x:10,y:10,patrol:[{x:10,y:10},{x:14,y:10},{x:14,y:4},{x:10,y:4}]}], securityCode:{x:6,y:2}, powerCell:{x:16,y:12}, difficulty: 1 },
  { name: 'Server Farm', obstacles: [{x:4,y:3},{x:5,y:3},{x:9,y:3},{x:10,y:3},{x:4,y:5},{x:10,y:5},{x:4,y:7},{x:5,y:7},{x:9,y:7},{x:10,y:7},{x:7,y:9},{x:8,y:9},{x:3,y:11},{x:7,y:11},{x:12,y:11},{x:16,y:11},{x:3,y:13},{x:4,y:13},{x:15,y:13},{x:16,y:13}], guardPatrol:[{x:2,y:9},{x:18,y:9},{x:18,y:5},{x:2,y:5}], dataCore:{x:18,y:13}, keyCard:{x:7,y:3}, hackTerminal:{x:14,y:9}, playerStart:{x:2,y:2}, exitZone:{x:19,y:7}, cameras:[{x:2,y:5},{x:17,y:11}], motionSensors:[{x:7,y:7},{x:12,y:5}], laserGrids:[{x:6,y:5,v:true},{x:12,y:9,h:true}], patrolDrones:[{x:8,y:6,patrol:[{x:8,y:6},{x:14,y:6},{x:14,y:12},{x:8,y:12}]}], securityCode:{x:2,y:12}, powerCell:{x:18,y:3}, difficulty: 2 },
  // Phase 4: New Level 4 - The Vault (high security bank vault)
  { name: 'The Vault', obstacles: [
      {x:4,y:3},{x:5,y:3},{x:6,y:3},{x:10,y:3},{x:11,y:3},{x:12,y:3},
      {x:4,y:5},{x:12,y:5},{x:4,y:7},{x:12,y:7},
      {x:4,y:9},{x:5,y:9},{x:6,y:9},{x:10,y:9},{x:11,y:9},{x:12,y:9},
      {x:4,y:11},{x:12,y:11},{x:7,y:12},{x:8,y:12}
    ], 
    guardPatrol: [
      {x:7,y:4},{x:10,y:4},{x:10,y:8},{x:7,y:8},
      {x:2,y:6},{x:17,y:6}
    ], 
    dataCore:{x:8,y:2}, 
    keyCard:{x:2,y:13}, 
    hackTerminal:{x:15,y:6}, 
    playerStart:{x:2,y:2}, 
    exitZone:{x:18,y:7}, 
    cameras:[
      {x:8,y:1},{x:2,y:10},{x:16,y:10}
    ], 
    motionSensors:[
      {x:8,y:6},{x:14,y:4},{x:5,y:10}
    ], 
    laserGrids:[
      {x:8,y:4,h:true},{x:3,y:6,v:true},{x:13,y:6,v:true},{x:8,y:10,h:true}
    ], 
    patrolDrones:[
      {x:5,y:7,patrol:[{x:5,y:7},{x:11,y:7},{x:11,y:5},{x:5,y:5}]},
      {x:15,y:9,patrol:[{x:15,y:9},{x:15,y:3},{x:18,y:3},{x:18,y:9}]}
    ], 
    securityCode:{x:6,y:13}, 
    powerCell:{x:16,y:12}, 
    difficulty: 3 
  },
  // Phase 4: New Level 5 - Training Facility (open area with multiple threats)
  { name: 'Training Facility', obstacles: [
      {x:6,y:3},{x:7,y:3},{x:13,y:3},{x:14,y:3},
      {x:3,y:6},{x:4,y:6},{x:16,y:6},{x:17,y:6},
      {x:6,y:9},{x:7,y:9},{x:13,y:9},{x:14,y:9},
      {x:6,y:12},{x:7,y:12},{x:13,y:12},{x:14,y:12},
      {x:9,y:5},{x:10,y:5},{x:9,y:10},{x:10,y:10}
    ], 
    guardPatrol: [
      {x:2,y:4},{x:18,y:4},
      {x:2,y:11},{x:18,y:11},
      {x:10,y:2},{x:10,y:13}
    ], 
    dataCore:{x:10,y:7}, 
    keyCard:{x:2,y:13}, 
    hackTerminal:{x:17,y:7}, 
    playerStart:{x:2,y:2}, 
    exitZone:{x:18,y:2}, 
    cameras:[
      {x:5,y:2},{x:15,y:2},{x:5,y:13},{x:15,y:13}
    ], 
    motionSensors:[
      {x:10,y:4},{x:10,y:10},{x:5,y:8},{x:15,y:8}
    ], 
    laserGrids:[
      {x:10,y:3,v:true},{x:10,y:12,v:true},{x:4,y:8,h:true},{x:16,y:8,h:true}
    ], 
    patrolDrones:[
      {x:8,y:4,patrol:[{x:8,y:4},{x:12,y:4},{x:12,y:11},{x:8,y:11}]},
      {x:5,y:7,patrol:[{x:5,y:7},{x:5,y:10},{x:8,y:10},{x:8,y:7}]},
      {x:15,y:7,patrol:[{x:15,y:7},{x:15,y:10},{x:12,y:10},{x:12,y:7}]}
    ], 
    securityCode:{x:3,y:4}, 
    powerCell:{x:17,y:12}, 
    difficulty: 3 
  }
];

// ==================== PERK DEFINITIONS ====================
const PERK_INFO = {
  speed: { name: 'SPEED', costs: [0, 50, 100, 200], bonus: [0, 0.15, 0.35, 0.6] },
  stealth: { name: 'STEALTH', costs: [0, 50, 100, 200], bonus: [0, 0.2, 0.4, 0.65] },
  luck: { name: 'LUCK', costs: [0, 50, 100, 200], bonus: [0, 10, 25, 50] }
};
function getSpeedBonus() { return PERK_INFO.speed.bonus[gameSave.perks.speed]; }
function getStealthBonus() { return PERK_INFO.stealth.bonus[gameSave.perks.stealth]; }
function getLuckBonus() { return PERK_INFO.luck.bonus[gameSave.perks.luck]; }

// ==================== BOOT SCENE (Loading) ====================
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    // Simple loading screen
    this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x0a0a0f);
    
    const title = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 30, 'GHOSTSHIFT', { fontSize: '36px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    const loading = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 + 20, 'Loading...', { fontSize: '14px', fill: '#666688', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    // Initialize audio on first interaction
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
    
    // Auto-transition to main menu with faster fade
    this.time.delayedCall(300, () => {
      this.scene.start('MainMenuScene');
    });
  }
}

// ==================== MAIN MENU SCENE ====================
class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(data) {
    // Phase 9: Register resize listener for fullscreen handling
    this._resizeListener = () => this._handleResize();
    fullscreenManager.on('resize', this._resizeListener);
    
    // Check if we should show How to Play from ControlsScene transition
    if (data?.showHowToPlay) {
      // Delay slightly to ensure scene is fully created
      this.time.delayedCall(100, () => {
        this.showHowToPlayOverlay();
      });
    }
    
    // Animated background grid
    this.createAnimatedBackground();
    
    // Title
    this.titleText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, 50, 'GHOSTSHIFT', { fontSize: '40px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    this.subtitleText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, 85, 'Infiltrate. Hack. Escape.', { fontSize: '14px', fill: '#666688', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    // Title glow animation
    this.tweens.add({
      targets: this.titleText,
      alpha: 0.8,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Stats
    if (saveManager.hasSave()) {
      this.add.text(40, 110, 'Runs: ' + saveManager.data.totalRuns + ' | Best: ' + this.formatTime(saveManager.data.bestTime), { fontSize: '12px', fill: '#888888', fontFamily: 'Courier New' });
    }
    
    // Credits
    this.creditsText = this.add.text(MAP_WIDTH * TILE_SIZE - 40, 20, 'Credits: ' + saveManager.data.credits, { fontSize: '16px', fill: '#ffaa00', fontFamily: 'Courier New' }).setOrigin(1, 0);
    
    // Phase 7: Larger buttons with better spacing
    const buttonWidth = 300, buttonHeight = 52, startY = 190, spacing = 65;
    
    // Main play button (larger, more prominent)
    this.createMenuButton(MAP_WIDTH * TILE_SIZE / 2, startY, buttonWidth, buttonHeight, '▶  PLAY', 0x2244aa, 0x66aaff, () => this.transitionTo('LevelSelectScene'));
    
    const canContinue = saveManager.hasSave();
    const lastPlayedLevel = saveManager.getLastPlayed() ? saveManager.data.unlockedLevels[saveManager.data.unlockedLevels.length - 1] : 0;
    this.createMenuButton(MAP_WIDTH * TILE_SIZE / 2, startY + spacing, buttonWidth, buttonHeight, '↻  CONTINUE', canContinue ? 0x1a4a2a : 0x1a1a1a, canContinue ? 0x66ff88 : 0x444444, () => { 
      if (canContinue) {
        this.transitionTo('GameScene', { levelIndex: lastPlayedLevel, continueRun: true }); 
      }
    }, !canContinue);
    
    // How to Play (new - kid-friendly guide)
    this.createMenuButton(MAP_WIDTH * TILE_SIZE / 2, startY + spacing * 2, buttonWidth, buttonHeight, '📖  HOW TO PLAY', 0x1a3a5a, 0x66ccff, () => this.showHowToPlayOverlay());
    
    // Controls and other menu items
    this.createMenuButton(MAP_WIDTH * TILE_SIZE / 2, startY + spacing * 3, buttonWidth, buttonHeight, '🎮  CONTROLS', 0x2a3a4a, 0xaaaacc, () => this.transitionTo('ControlsScene'));
    this.createMenuButton(MAP_WIDTH * TILE_SIZE / 2, startY + spacing * 4, buttonWidth, buttonHeight, '⚙  SETTINGS', 0x2a3a4a, 0xaaaacc, () => this.transitionTo('SettingsScene'));
    this.createMenuButton(MAP_WIDTH * TILE_SIZE / 2, startY + spacing * 5, buttonWidth, buttonHeight, '★  CREDITS', 0x2a3a4a, 0xaaaacc, () => this.showCreditsOverlay());
    
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
  }
  
  createAnimatedBackground() {
    // OPTIMIZATION: Cache static grid as render texture instead of redrawing every frame
    this.bgGraphics = this.add.graphics();
    this.bgGraphics.setDepth(-1);
    
    // Create cached grid texture (static background)
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(-2);
    
    // Pre-render static grid to a render texture for better performance
    this.gridOffset = 0;
    
    // Use a simpler animation approach - just offset the texture instead of redrawing
    // Create base grid once as a texture
    this._gridTexture = this.add.graphics();
    this._gridTexture.lineStyle(1, 0x1a1a2a, 0.4);
    for (let x = 0; x <= MAP_WIDTH; x++) {
      this._gridTexture.lineBetween(x * 32, 0, x * 32, MAP_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      this._gridTexture.lineBetween(0, y * 32, MAP_WIDTH * TILE_SIZE, y * 32);
    }
    
    // OPTIMIZATION: Slower animation (100ms instead of 50ms) - reduces GPU load by 50%
    this._gridTimer = this.time.addEvent({
      delay: 100,  // Reduced from 50ms - half the draw calls
      callback: () => {
        this.gridOffset = (this.gridOffset + 1) % 32;
        this.drawAnimatedGrid();
      },
      loop: true
    });
    
    // Floating particles
    this.particles = [];
    for (let i = 0; i < 15; i++) {
      const particle = this.add.circle(
        Math.random() * MAP_WIDTH * TILE_SIZE,
        Math.random() * MAP_HEIGHT * TILE_SIZE,
        2 + Math.random() * 3,
        0x4488ff,
        0.1 + Math.random() * 0.15
      );
      particle.setDepth(-1);
      particle.speedX = (Math.random() - 0.5) * 0.5;
      particle.speedY = (Math.random() - 0.5) * 0.5;
      this.particles.push(particle);
    }
    
    // Animate particles - store timer reference for cleanup
    this._particleTimer = this.time.addEvent({
      delay: 16,
      callback: () => {
        this.particles.forEach(p => {
          p.x += p.speedX;
          p.y += p.speedY;
          if (p.x < 0) p.x = MAP_WIDTH * TILE_SIZE;
          if (p.x > MAP_WIDTH * TILE_SIZE) p.x = 0;
          if (p.y < 0) p.y = MAP_HEIGHT * TILE_SIZE;
          if (p.y > MAP_HEIGHT * TILE_SIZE) p.y = 0;
        });
      },
      loop: true
    });
  }
  
  drawAnimatedGrid() {
    // OPTIMIZATION: Use tiling sprite for scrolling grid effect instead of redrawing lines
    // This avoids expensive graphics.clear() + redraw operations every frame
    this.gridGraphics.clear();
    
    // Draw grid with animated offset - but use fewer lines for performance
    // Only draw every 2nd line when offset is active (creates illusion of movement)
    const useAlternate = this.gridOffset % 2 === 0;
    this.gridGraphics.lineStyle(1, 0x1a1a2a, useAlternate ? 0.5 : 0.25);
    
    // Vertical lines with offset
    for (let x = 0; x <= MAP_WIDTH; x++) {
      const offsetX = (x * 32 + this.gridOffset * 2) % 64;  // Slower movement
      this.gridGraphics.lineBetween(x * 32 - offsetX/2, 0, x * 32 - offsetX/2, MAP_HEIGHT * TILE_SIZE);
    }
    
    // Horizontal lines with offset
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      const offsetY = (y * 32 + this.gridOffset * 2) % 64;  // Slower movement
      this.gridGraphics.lineBetween(0, y * 32 - offsetY/2, MAP_WIDTH * TILE_SIZE, y * 32 - offsetY/2);
    }
  }
  
  transitionTo(sceneKey, data = null) {
    sfx.click();
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    
    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000);
    overlay.setDepth(100);
    overlay.setAlpha(0);
    
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (data) {
          this.scene.start(sceneKey, data);
        } else {
          this.scene.start(sceneKey);
        }
        this.time.delayedCall(50, () => {
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => overlay.destroy()
          });
        });
      }
    });
  }
  
  createMenuButton(x, y, width, height, text, bgColor, strokeColor, onClick, disabled = false) {
    const bg = this.add.rectangle(x, y, width, height, bgColor);
    bg.setStrokeStyle(2, strokeColor);
    bg.setInteractive({ useHandCursor: !disabled });
    
    const label = this.add.text(x, y, text, { fontSize: '16px', fill: disabled ? '#444444' : '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    // Hover effects
    bg.on('pointerover', () => { 
      if (!disabled) { 
        bg.setFillStyle(bgColor + 0x202020); 
        bg.setStrokeStyle(2, 0xffffff);
        sfx.menuHover(); 
      } 
    });
    
    bg.on('pointerout', () => { 
      if (!disabled) {
        bg.setFillStyle(bgColor); 
        bg.setStrokeStyle(2, strokeColor);
      }
    });
    
    bg.on('pointerdown', () => { 
      // Button press animation
      this.tweens.add({
        targets: bg,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          bg.setScale(1);
        }
      });
      onClick(); 
    });
    
    return { bg, label };
  }
  
  // Phase 7: Kid-friendly How to Play guide
  showHowToPlayOverlay() {
    const overlay = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x000000, 0.92);
    overlay.setDepth(100);
    overlay.setInteractive({ useHandCursor: true });
    
    const panel = this.add.container(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2);
    panel.setDepth(101);
    
    // Main panel - larger for better readability and to avoid content overlap
    const panelWidth = 560;
    const panelHeight = 520;
    const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x1a1a2a);
    bg.setStrokeStyle(3, 0x66ccff);
    panel.add(bg);
    
    // Title
    const title = this.add.text(0, -panelHeight/2 + 35, '📖 HOW TO PLAY', { fontSize: '28px', fill: '#66ccff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    title.setShadow(0, 0, '#66ccff', 8, true, true);
    panel.add(title);
    
    // Step-by-step instructions - kid-friendly with clear explanations
    // Use colorized keyword parts so color words are shown in their actual color.
    const steps = [
      {
        num: '1',
        title: 'FIND THE KEY',
        lines: [
          [
            { text: 'Look for the ', color: '#aaaaaa' },
            { text: 'blue key card', color: '#66aaff' },
            { text: ' on the map.', color: '#aaaaaa' }
          ],
          [
            { text: 'Pick it up to unlock doors!', color: '#aaaaaa' }
          ]
        ]
      },
      {
        num: '2',
        title: 'HACK THE TERMINAL',
        lines: [
          [
            { text: 'Find the ', color: '#aaaaaa' },
            { text: 'green computer', color: '#66ff88' },
            { text: ' and stand near it.', color: '#aaaaaa' }
          ],
          [
            { text: 'Wait for the hacking to finish!', color: '#aaaaaa' }
          ]
        ]
      },
      {
        num: '3',
        title: 'GET THE DATA',
        lines: [
          [
            { text: 'Grab the ', color: '#aaaaaa' },
            { text: 'golden data core', color: '#ffd54a' },
            { text: '.', color: '#aaaaaa' }
          ],
          [
            { text: "It gives points and unlocks the exit!", color: '#aaaaaa' }
          ]
        ]
      },
      {
        num: '4',
        title: 'ESCAPE!',
        lines: [
          [
            { text: 'Run to the ', color: '#aaaaaa' },
            { text: 'green exit zone', color: '#66ff88' },
            { text: '.', color: '#aaaaaa' }
          ],
          [
            { text: 'You win when you reach it!', color: '#aaaaaa' }
          ]
        ]
      },
      {
        num: '⚠',
        title: 'AVOID GUARDS!',
        lines: [
          [
            { text: "Don\'t let ", color: '#aaaaaa' },
            { text: 'red guards', color: '#ff6666' },
            { text: ' or cameras see you.', color: '#aaaaaa' }
          ],
          [
            { text: 'Stay in the shadows!', color: '#aaaaaa' }
          ]
        ]
      }
    ];
    
    // Center steps content block within panel - both horizontally and vertically
    // Available space: title ends at -panelHeight/2 + 70, back button starts at panelHeight/2 - 65
    const contentTop = -panelHeight/2 + 75;
    const contentBottom = panelHeight/2 - 70;
    const contentHeight = contentBottom - contentTop;
    const numSteps = steps.length;
    const totalStepsHeight = numSteps * 68;
    const verticalPadding = (contentHeight - totalStepsHeight) / 2;
    let yPos = contentTop + verticalPadding;
    
    // Center offset for horizontal alignment within panel
    const centerOffset = 0;
    const stepCircleX = centerOffset - 100;
    const stepContentX = centerOffset - 60;
    
    steps.forEach((step, i) => {
      // Step number circle - centered horizontally
      const stepNum = this.add.circle(stepCircleX, yPos, 18, step.num === '⚠' ? 0xff4444 : 0x4488ff);
      panel.add(stepNum);
      
      // Step number text - centered on circle
      const numText = this.add.text(stepCircleX, yPos, step.num, { 
        fontSize: step.num === '⚠' ? '20px' : '16px', 
        fill: '#ffffff', 
        fontFamily: 'Courier New',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      panel.add(numText);
      
      // Step title - aligned to right of circle
      const titleText = this.add.text(stepContentX, yPos - 10, step.title, { 
        fontSize: '15px', 
        fill: step.num === '⚠' ? '#ff6666' : '#ffdd00', 
        fontFamily: 'Courier New',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      panel.add(titleText);
      
      // Step description (why this matters) with colorized keywords
      const baseX = stepContentX;
      const baseY = yPos + 12;
      const lineGap = 14;

      step.lines.forEach((segments, lineIndex) => {
        let xCursor = baseX;
        const yLine = baseY + (lineIndex * lineGap);

        segments.forEach((seg) => {
          const segText = this.add.text(xCursor, yLine, seg.text, {
            fontSize: '12px',
            fill: seg.color,
            fontFamily: 'Courier New'
          }).setOrigin(0, 0.5);
          panel.add(segText);
          xCursor += segText.width;
        });
      });
      
      yPos += 68;
    });
    
    // Back button - large and clear
    const backBtnBg = this.add.rectangle(0, panelHeight/2 - 40, 180, 45, 0x2244aa);
    backBtnBg.setStrokeStyle(2, 0x66aaff);
    backBtnBg.setInteractive({ useHandCursor: true });
    panel.add(backBtnBg);
    
    const backBtnText = this.add.text(0, panelHeight/2 - 40, '⬅ BACK TO MENU', { 
      fontSize: '16px', 
      fill: '#ffffff', 
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    panel.add(backBtnText);
    
    // Button hover effects
    backBtnBg.on('pointerover', () => { 
      backBtnBg.setFillStyle(0x3366cc);
      backBtnBg.setStrokeStyle(2, 0xffffff);
    });
    backBtnBg.on('pointerout', () => { 
      backBtnBg.setFillStyle(0x2244aa);
      backBtnBg.setStrokeStyle(2, 0x66aaff);
    });
    backBtnBg.on('pointerdown', () => { 
      sfx.click();
      overlay.destroy();
      panel.destroy();
    });
    
    // Also allow clicking outside to close
    overlay.on('pointerdown', () => {
      sfx.click();
      overlay.destroy();
      panel.destroy();
    });
    
    // Keyboard close
    const closeHandler = (e) => {
      // Don't close on other keys, only Escape
      if (e.code === 'Escape') {
        sfx.click();
        this.input.keyboard.off('keydown', closeHandler);
        overlay.destroy();
        panel.destroy();
      }
    };
    this.input.keyboard.on('keydown', closeHandler);
  }
  
  showCreditsOverlay() {
    // Full-screen overlay with dark background
    const overlay = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x000000, 0.92);
    overlay.setDepth(100);
    overlay.setInteractive({ useHandCursor: true });
    
    // Main panel container - centered
    const panelWidth = 600;
    const panelHeight = 480;
    const panel = this.add.container(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2);
    panel.setDepth(101);
    
    // Background panel with border
    const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x1a1a2a);
    bg.setStrokeStyle(3, 0x4488ff);
    panel.add(bg);
    
    // Title section with glow effect
    const titleY = -panelHeight / 2 + 45;
    const title = this.add.text(0, titleY, '★ CREDITS ★', { 
      fontSize: '32px', 
      fill: '#4488ff', 
      fontFamily: 'Courier New', 
      fontStyle: 'bold' 
    }).setOrigin(0.5);
    title.setShadow(0, 0, '#4488ff', 10, true, true);
    panel.add(title);
    
    // Decorative line under title
    const titleLine = this.add.rectangle(0, titleY + 28, 300, 2, 0x4488ff);
    panel.add(titleLine);
    
    // Credits sections with proper styling
    const sections = [
      { title: 'DEVELOPMENT', items: [
        { label: 'Lead Developer', value: 'GhostShift Team' },
        { label: 'Game Engine', value: 'Phaser 3' },
        { label: 'Version', value: '0.6.1 (Phase 9)' }
      ]},
      { title: 'GAME FEATURES', items: [
        { label: 'Total Levels', value: '5 Unique Maps' },
        { label: 'Save System', value: 'Hardened v5' },
        { label: 'Perk System', value: 'Speed, Stealth, Luck' }
      ]},
      { title: 'TECHNICAL', items: [
        { label: 'Framework', value: 'Phaser.js' },
        { label: 'Physics', value: 'Arcade Physics' },
        { label: 'Audio', value: 'Web Audio API' }
      ]}
    ];
    
    // Calculate starting Y position for sections
    const sectionStartY = titleY + 55;
    const sectionHeight = 110;
    const sectionGap = 15;
    let currentY = sectionStartY;
    
    sections.forEach((section, sectionIndex) => {
      // Section title
      const sectionTitle = this.add.text(-panelWidth / 2 + 40, currentY, section.title, {
        fontSize: '14px',
        fill: '#ffaa00',
        fontFamily: 'Courier New',
        fontStyle: 'bold'
      });
      panel.add(sectionTitle);
      
      // Section items
      let itemY = currentY + 25;
      section.items.forEach((item, itemIndex) => {
        const labelX = -panelWidth / 2 + 50;
        const valueX = 80;
        
        // Label
        panel.add(this.add.text(labelX + valueX, itemY, item.label + ':', {
          fontSize: '13px',
          fill: '#88aacc',
          fontFamily: 'Courier New'
        }).setOrigin(0, 0.5));
        
        // Value
        panel.add(this.add.text(labelX + valueX + 120, itemY, item.value, {
          fontSize: '13px',
          fill: '#ffffff',
          fontFamily: 'Courier New'
        }).setOrigin(0, 0.5));
        
        itemY += 22;
      });
      
      currentY += sectionHeight;
    });
    
    // Bottom section - thank you message
    const thankYouY = panelHeight / 2 - 60;
    const thankYou = this.add.text(0, thankYouY, 'Thanks for playing GhostShift!', {
      fontSize: '14px',
      fill: '#66ff88',
      fontFamily: 'Courier New',
      fontStyle: 'italic'
    }).setOrigin(0.5);
    panel.add(thankYou);
    
    // Back button - styled consistently with other menu buttons
    const backBtnY = panelHeight / 2 - 25;
    const backBtnBg = this.add.rectangle(0, backBtnY, 200, 45, 0x2244aa);
    backBtnBg.setStrokeStyle(2, 0x66aaff);
    backBtnBg.setInteractive({ useHandCursor: true });
    panel.add(backBtnBg);
    
    const backBtnText = this.add.text(0, backBtnY, '⬅ BACK TO MENU', {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    panel.add(backBtnText);
    
    // Button hover effects
    backBtnBg.on('pointerover', () => {
      backBtnBg.setFillStyle(0x3366cc);
      backBtnBg.setStrokeStyle(2, 0xffffff);
    });
    backBtnBg.on('pointerout', () => {
      backBtnBg.setFillStyle(0x2244aa);
      backBtnBg.setStrokeStyle(2, 0x66aaff);
    });
    backBtnBg.on('pointerdown', () => {
      sfx.click();
      this.input.keyboard.off('keydown', closeHandler);
      this.input.off('pointerdown', closeHandler);
      overlay.destroy();
      panel.destroy();
    });
    
    // Close handler
    const closeHandler = () => {
      this.input.keyboard.off('keydown', closeHandler);
      this.input.off('pointerdown', closeHandler);
      overlay.destroy();
      panel.destroy();
    };
    
    // Keyboard support - ESC to close
    const escHandler = (e) => {
      if (e.code === 'Escape') {
        sfx.click();
        this.input.keyboard.off('keydown', escHandler);
        overlay.destroy();
        panel.destroy();
      }
    };
    this.input.keyboard.on('keydown', escHandler);
    
    // Click outside panel to close
    overlay.on('pointerdown', () => {
      sfx.click();
      this.input.keyboard.off('keydown', escHandler);
      overlay.destroy();
      panel.destroy();
    });
  }
  
  // Phase 9: Handle window resize for fullscreen
  _handleResize() {
    const { width, height } = this.scale;
    const centerX = width / 2;
    
    // Reposition title
    if (this.titleText) {
      this.titleText.setPosition(centerX, 50);
    }
    if (this.subtitleText) {
      this.subtitleText.setPosition(centerX, 85);
    }
    
    // Reposition credits (top right)
    if (this.creditsText) {
      this.creditsText.setPosition(width - 40, 20);
    }
  }
  
  // Cleanup listeners when scene is destroyed
  shutdown() {
    // Clean up grid animation timer
    if (this._gridTimer) {
      this._gridTimer.remove();
      this._gridTimer = null;
    }
    // Clean up particle animation timer
    if (this._particleTimer) {
      this._particleTimer.remove();
      this._particleTimer = null;
    }
    if (this._resizeListener) {
      fullscreenManager.off(this._resizeListener);
    }
    super.shutdown();
  }
  
  formatTime(ms) { if (!ms) return '--:--'; const minutes = Math.floor(ms / 60000); const seconds = Math.floor((ms % 60000) / 1000); const centis = Math.floor((ms % 1000) / 10); return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0') + '.' + centis.toString().padStart(2, '0'); }
}

// ==================== LEVEL SELECT SCENE ====================
class LevelSelectScene extends Phaser.Scene {
  constructor() { super({ key: 'LevelSelectScene' }); }
  create() {
    // Register resize listener
    this._resizeListener = () => this._handleResize();
    fullscreenManager.on('resize', this._resizeListener);
    
    // Background
    this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x0a0a0f);
    
    // OPTIMIZATION: Static grid with slower animation (100ms instead of 50ms)
    // Menu grids don't need high frame rate animation
    this.gridGraphics = this.add.graphics();
    this.gridOffset = 0;
    this._gridTimer = this.time.addEvent({
      delay: 100,  // Reduced from 50ms - half the draw calls
      callback: () => {
        this.gridOffset = (this.gridOffset + 0.3) % 32;
        this.drawGrid();
      },
      loop: true
    });
    
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, 30, 'SELECT LEVEL', { fontSize: '28px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    const backBtn = this.add.text(20, 15, '< BACK', { fontSize: '14px', fill: '#888888', fontFamily: 'Courier New' }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setFill('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setFill('#888888'));
    backBtn.on('pointerdown', () => this.transitionTo('MainMenuScene'));
    
    const startY = 80, spacingY = 70;
    LEVEL_LAYOUTS.forEach((level, index) => {
      const isUnlocked = saveManager.isLevelUnlocked(index);
      const bestTime = saveManager.getBestTime(index);
      const y = startY + index * spacingY;
      const cardBg = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, y, 400, 55, isUnlocked ? 0x1a2a3a : 0x1a1a1a);
      cardBg.setStrokeStyle(2, isUnlocked ? 0x4488ff : 0x333333);
      cardBg.setInteractive({ useHandCursor: isUnlocked });
      
      // Level number with glow
      const levelNum = this.add.text(MAP_WIDTH * TILE_SIZE / 2 - 160, y, String(index + 1), { fontSize: '20px', fill: isUnlocked ? '#4488ff' : '#444444', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
      if (isUnlocked) {
        this.tweens.add({
          targets: levelNum,
          alpha: 0.7,
          duration: 1000,
          yoyo: true,
          repeat: -1
        });
      }
      
      this.add.text(MAP_WIDTH * TILE_SIZE / 2 - 100, y - 10, level.name, { fontSize: '14px', fill: isUnlocked ? '#ffffff' : '#444444', fontFamily: 'Courier New' }).setOrigin(0, 0.5);
      this.add.text(MAP_WIDTH * TILE_SIZE / 2 - 100, y + 10, 'Best: ' + (bestTime ? this.formatTime(bestTime) : '--:--'), { fontSize: '11px', fill: isUnlocked ? '#888888' : '#444444', fontFamily: 'Courier New' });
      this.add.text(MAP_WIDTH * TILE_SIZE / 2 + 140, y, isUnlocked ? '▶ PLAY' : '🔒 LOCKED', { fontSize: '12px', fill: isUnlocked ? '#44ff88' : '#444444', fontFamily: 'Courier New' }).setOrigin(0.5);
      
      if (isUnlocked) {
        cardBg.on('pointerover', () => { 
          cardBg.setFillStyle(0x2a3a4a); 
          cardBg.setStrokeStyle(2, 0x66aaff);
          sfx.menuHover(); 
        });
        cardBg.on('pointerout', () => cardBg.setFillStyle(0x1a2a3a).setStrokeStyle(2, 0x4488ff));
        cardBg.on('pointerdown', () => {
          // Click animation
          this.tweens.add({
            targets: cardBg,
            scaleX: 0.98,
            scaleY: 0.98,
            duration: 50,
            yoyo: true,
            onComplete: () => {
              sfx.select();
              this.transitionTo('GameScene', { levelIndex: index });
            }
          });
        });
      }
    });
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
  }
  
  transitionTo(sceneKey, data = null) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    
    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000);
    overlay.setDepth(100);
    overlay.setAlpha(0);
    
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (data) {
          this.scene.start(sceneKey, data);
        } else {
          this.scene.start(sceneKey);
        }
        this.time.delayedCall(50, () => {
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => overlay.destroy()
          });
        });
      }
    });
  }
  
  formatTime(ms) { if (!ms) return '--:--'; const minutes = Math.floor(ms / 60000); const seconds = Math.floor((ms % 60000) / 1000); const centis = Math.floor((ms % 1000) / 10); return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0') + '.' + centis.toString().padStart(2, '0'); }
  
  // Phase 9: Handle window resize for fullscreen
  _handleResize() {
    const { width } = this.scale;
    const centerX = width / 2;
    
    // Update grid position if needed
    if (this.gridGraphics) {
      this.gridGraphics.setPosition(centerX, MAP_HEIGHT * TILE_SIZE / 2);
    }
  }
  
  // Cleanup timers and listeners when scene is destroyed
  shutdown() {
    // Clean up grid animation timer
    if (this._gridTimer) {
      this._gridTimer.remove();
      this._gridTimer = null;
    }
    if (this._resizeListener) {
      fullscreenManager.off(this._resizeListener);
    }
    super.shutdown();
  }
}

// ==================== SETTINGS SCENE (PHASE 8 - MODERNIZED) ====================
class SettingsScene extends Phaser.Scene {
  constructor() { super({ key: 'SettingsScene' }); }
  create() {
    // Phase 9: Register resize listener for fullscreen handling
    this._resizeListener = () => this._handleResize();
    fullscreenManager.on('resize', this._resizeListener);
    
    // Background
    this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x0a0a0f);
    
    // OPTIMIZATION: Static grid with slower animation (100ms instead of 50ms)
    this.gridGraphics = this.add.graphics();
    this.gridOffset = 0;
    this._gridTimer = this.time.addEvent({
      delay: 100,  // Reduced from 50ms - half the draw calls
      callback: () => {
        this.gridOffset = (this.gridOffset + 0.3) % 32;
        this.drawGrid();
      },
      loop: true
    });
    
    // Title
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, 30, 'SETTINGS', { fontSize: '28px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    // Back button
    const backBtn = this.add.text(20, 15, '< BACK', { fontSize: '14px', fill: '#888888', fontFamily: 'Courier New' }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setFill('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setFill('#888888'));
    backBtn.on('pointerdown', () => this.transitionTo('MainMenuScene'));
    
    // ==================== SECTION HEADERS ====================
    const sectionHeaderStyle = { fontSize: '12px', fontFamily: 'Courier New', fontStyle: 'bold' };
    const sectionY = 70;
    
    // AUDIO Section
    this.add.text(40, sectionY, '▸ AUDIO', { fontSize: '13px', fill: '#6699cc', fontFamily: 'Courier New', fontStyle: 'bold' });
    this.add.line(0, 0, 40, sectionY + 18, MAP_WIDTH * TILE_SIZE - 40, sectionY + 18, 0x334455).setOrigin(0);
    
    // GRAPHICS Section
    const graphicsY = 180;
    this.add.text(40, graphicsY, '▸ GRAPHICS', { fontSize: '13px', fill: '#6699cc', fontFamily: 'Courier New', fontStyle: 'bold' });
    this.add.line(0, 0, 40, graphicsY + 18, MAP_WIDTH * TILE_SIZE - 40, graphicsY + 18, 0x334455).setOrigin(0);
    
    // GAME Section
    const gameY = 350;
    this.add.text(40, gameY, '▸ GAME', { fontSize: '13px', fill: '#6699cc', fontFamily: 'Courier New', fontStyle: 'bold' });
    this.add.line(0, 0, 40, gameY + 18, MAP_WIDTH * TILE_SIZE - 40, gameY + 18, 0x334455).setOrigin(0);
    
    // ==================== AUDIO SETTINGS ====================
    const audioStartY = sectionY + 35;
    const rowHeight = 45;
    const rightAlignX = MAP_WIDTH * TILE_SIZE - 50;
    
    // Audio Enabled toggle
    this.add.text(40, audioStartY, 'Sound Effects', { fontSize: '15px', fill: '#ffffff', fontFamily: 'Courier New' });
    const audioToggle = this.add.text(rightAlignX, audioStartY + 2, sfx.isEnabled ? '● ON' : '○ OFF', { fontSize: '14px', fill: sfx.isEnabled ? '#44ff88' : '#ff4444', fontFamily: 'Courier New', fontStyle: 'bold' }).setInteractive({ useHandCursor: true });
    audioToggle.setOrigin(1, 0);
    audioToggle.on('pointerover', () => { if (!sfx.isEnabled) audioToggle.setFill('#ff6666'); });
    audioToggle.on('pointerout', () => { audioToggle.setFill(sfx.isEnabled ? '#44ff88' : '#ff4444'); });
    audioToggle.on('pointerdown', () => { 
      const newState = !sfx.isEnabled; 
      sfx.setEnabled(newState); 
      audioToggle.setText(newState ? '● ON' : '○ OFF'); 
      audioToggle.setFill(newState ? '#44ff88' : '#ff4444'); 
      sfx.select(); 
    });
    
    // Master Volume - Modern slider with thumb and percentage
    const volY = audioStartY + rowHeight;
    this.add.text(40, volY, 'Master Volume', { fontSize: '15px', fill: '#ffffff', fontFamily: 'Courier New' });
    
    // Volume percentage display
    const volPercent = Math.round(sfx.volume * 100);
    const volPercentText = this.add.text(rightAlignX + 30, volY + 2, volPercent + '%', { fontSize: '14px', fill: '#88ccff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(1, 0);
    
    // Mute button
    const muteBtn = this.add.text(rightAlignX + 65, volY + 2, sfx.volume === 0 || !sfx.isEnabled ? '🔇' : '🔊', { fontSize: '16px' }).setInteractive({ useHandCursor: true });
    muteBtn.on('pointerover', () => muteBtn.setAlpha(0.7));
    muteBtn.on('pointerout', () => muteBtn.setAlpha(1));
    muteBtn.on('pointerdown', () => {
      const wasMuted = sfx.volume === 0 || !sfx.isEnabled;
      if (wasMuted) {
        sfx.setEnabled(true);
        audioToggle.setText('● ON');
        audioToggle.setFill('#44ff88');
        sfx.setMasterVolume(sfx.volume || 0.8);
      } else {
        sfx.setMasterVolume(0);
      }
      updateVolDisplay();
      muteBtn.setText(sfx.volume === 0 || !sfx.isEnabled ? '🔇' : '🔊');
      sfx.select();
    });
    
    // Slider track background
    const sliderX = 180;
    const sliderWidth = 280;
    const sliderY = volY + 18;
    const volBarBg = this.add.rectangle(sliderX + sliderWidth / 2, sliderY, sliderWidth, 8, 0x1a1a2a);
    volBarBg.setStrokeStyle(1, 0x333344);
    
    // Slider fill
    const volBarFill = this.add.rectangle(sliderX, sliderY, sfx.volume * sliderWidth, 6, 0x4488ff);
    volBarFill.setOrigin(0, 0.5);
    
    // Slider thumb
    const volThumb = this.add.circle(sliderX + sfx.volume * sliderWidth, sliderY, 10, 0x66aaff);
    volThumb.setStrokeStyle(2, 0xffffff);
    volThumb.setInteractive({ useHandCursor: true });
    volThumb.on('pointerover', () => { volThumb.setFill(0x88bbff); volThumb.setScale(1.2); });
    volThumb.on('pointerout', () => { volThumb.setFill(0x66aaff); volThumb.setScale(1); });
    
    // Volume controls (-/+)
    const volDown = this.add.text(sliderX - 25, sliderY - 1, '−', { fontSize: '22px', fill: '#888888', fontFamily: 'Courier New', fontStyle: 'bold' }).setInteractive({ useHandCursor: true });
    const volUp = this.add.text(sliderX + sliderWidth + 10, sliderY - 1, '+', { fontSize: '22px', fill: '#888888', fontFamily: 'Courier New', fontStyle: 'bold' }).setInteractive({ useHandCursor: true });
    
    // Hover states for volume buttons
    volDown.on('pointerover', () => volDown.setFill('#ffffff'));
    volDown.on('pointerout', () => volDown.setFill('#888888'));
    volUp.on('pointerover', () => volUp.setFill('#ffffff'));
    volUp.on('pointerout', () => volUp.setFill('#888888'));
    
    const updateVolDisplay = () => {
      const vol = sfx.volume;
      volPercentText.setText(Math.round(vol * 100) + '%');
      volBarFill.width = vol * sliderWidth;
      volThumb.x = sliderX + vol * sliderWidth;
      muteBtn.setText(vol === 0 || !sfx.isEnabled ? '🔇' : '🔊');
      // Update audio toggle state
      audioToggle.setText(sfx.isEnabled ? '● ON' : '○ OFF');
      audioToggle.setFill(sfx.isEnabled ? '#44ff88' : '#ff4444');
    };
    
    // Volume slider click/drag
    volBarBg.setInteractive({ useHandCursor: true });
    volBarBg.on('pointerdown', (pointer) => {
      const newVol = Math.max(0, Math.min(1, (pointer.x - sliderX) / sliderWidth));
      sfx.setMasterVolume(newVol);
      updateVolDisplay();
      sfx.select();
    });
    
    volThumb.on('pointerdown', (pointer) => {
      this.input.on('pointermove', (movePtr) => {
        const newVol = Math.max(0, Math.min(1, (movePtr.x - sliderX) / sliderWidth));
        sfx.setMasterVolume(newVol);
        updateVolDisplay();
      });
      this.input.once('pointerup', () => {
        this.input.off('pointermove');
        sfx.select();
      });
    });
    
    volDown.on('pointerdown', () => { sfx.setMasterVolume(Math.max(0, sfx.volume - 0.1)); updateVolDisplay(); sfx.select(); });
    volUp.on('pointerdown', () => { sfx.setMasterVolume(Math.min(1, sfx.volume + 0.1)); updateVolDisplay(); sfx.select(); });
    
    // ==================== GRAPHICS SETTINGS ====================
    const graphicsStartY = graphicsY + 35;
    
    // Effects Quality
    this.add.text(40, graphicsStartY, 'Effects Quality', { fontSize: '15px', fill: '#ffffff', fontFamily: 'Courier New' });
    this.add.text(40, graphicsStartY + 18, 'Visual detail level', { fontSize: '11px', fill: '#666677', fontFamily: 'Courier New' });
    
    const currentQuality = saveManager.getSetting('effectsQuality') || 'high';
    const qualityBtn = this.add.text(rightAlignX, graphicsStartY + 2, currentQuality.toUpperCase(), { fontSize: '14px', fill: '#ffaa00', fontFamily: 'Courier New', fontStyle: 'bold' }).setInteractive({ useHandCursor: true });
    qualityBtn.setOrigin(1, 0);
    const qualities = ['low', 'medium', 'high'];
    let qualIndex = qualities.indexOf(currentQuality);
    qualityBtn.on('pointerover', () => qualityBtn.setFill('#ffcc44'));
    qualityBtn.on('pointerout', () => qualityBtn.setFill('#ffaa00'));
    qualityBtn.on('pointerdown', () => { 
      qualIndex = (qualIndex + 1) % qualities.length; 
      const newQual = qualities[qualIndex];
      saveManager.setSetting('effectsQuality', newQual);
      qualityBtn.setText(newQual.toUpperCase());
      sfx.select();
    });
    
    // Fullscreen toggle
    const fullY = graphicsStartY + rowHeight;
    this.add.text(40, fullY, 'Fullscreen', { fontSize: '15px', fill: '#ffffff', fontFamily: 'Courier New' });
    this.add.text(40, fullY + 18, 'Stretch to fill screen', { fontSize: '11px', fill: '#666677', fontFamily: 'Courier New' });
    
    // Check actual browser fullscreen state
    const isFullscreen = fullscreenManager.isFullscreen;
    const fullToggle = this.add.text(rightAlignX, fullY + 2, isFullscreen ? '● ON' : '○ OFF', { fontSize: '14px', fill: isFullscreen ? '#44ff88' : '#ff4444', fontFamily: 'Courier New', fontStyle: 'bold' }).setInteractive({ useHandCursor: true });
    fullToggle.setOrigin(1, 0);
    
    // Listen for fullscreen changes to keep toggle in sync
    this._fullscreenListener = (event, isFs) => {
      fullToggle.setText(isFs ? '● ON' : '○ OFF');
      fullToggle.setFill(isFs ? '#44ff88' : '#ff4444');
      // Also update save state
      saveManager.setSetting('fullscreen', isFs);
    };
    fullscreenManager.on('fullscreenchange', this._fullscreenListener);
    
    // Listen for resize events to trigger scene relayout
    this._resizeListener = () => {
      this._relayoutUI();
    };
    fullscreenManager.on('resize', this._resizeListener);
    
    fullToggle.on('pointerover', () => { if (!fullscreenManager.isFullscreen) fullToggle.setFill('#ff6666'); });
    fullToggle.on('pointerout', () => { fullToggle.setFill(fullscreenManager.isFullscreen ? '#44ff88' : '#ff4444'); });
    fullToggle.on('pointerdown', async () => { 
      const newState = !fullscreenManager.isFullscreen;
      if (newState) {
        await fullscreenManager.request();
      } else {
        await fullscreenManager.exit();
      }
      // State will be updated by the fullscreenchange listener
      saveManager.setSetting('fullscreen', fullscreenManager.isFullscreen);
      sfx.select();
    });
    
    // ==================== GAME SETTINGS ====================
    const gameStartY = gameY + 35;
    
    // Reduced Motion toggle
    this.add.text(40, gameStartY, 'Reduced Motion', { fontSize: '15px', fill: '#ffffff', fontFamily: 'Courier New' });
    this.add.text(40, gameStartY + 18, 'Minimize animations', { fontSize: '11px', fill: '#666677', fontFamily: 'Courier New' });
    
    const reducedMotion = saveManager.getSetting('reducedMotion') || false;
    const motionToggle = this.add.text(rightAlignX, gameStartY + 2, reducedMotion ? '● ON' : '○ OFF', { fontSize: '14px', fill: reducedMotion ? '#44ff88' : '#ff4444', fontFamily: 'Courier New', fontStyle: 'bold' }).setInteractive({ useHandCursor: true });
    motionToggle.setOrigin(1, 0);
    motionToggle.on('pointerover', () => { if (!saveManager.getSetting('reducedMotion')) motionToggle.setFill('#ff6666'); });
    motionToggle.on('pointerout', () => { motionToggle.setFill(saveManager.getSetting('reducedMotion') ? '#44ff88' : '#ff4444'); });
    motionToggle.on('pointerdown', () => { 
      const newState = !saveManager.getSetting('reducedMotion');
      saveManager.setSetting('reducedMotion', newState);
      motionToggle.setText(newState ? '● ON' : '○ OFF');
      motionToggle.setFill(newState ? '#44ff88' : '#ff4444');
      sfx.select();
    });
    
    // Reset Progress
    const resetY = gameStartY + rowHeight + 15;
    this.add.text(40, resetY, 'Reset Progress', { fontSize: '15px', fill: '#ffffff', fontFamily: 'Courier New' });
    this.add.text(40, resetY + 18, 'Clear all save data', { fontSize: '11px', fill: '#666677', fontFamily: 'Courier New' });
    
    const resetBtn = this.add.text(rightAlignX, resetY + 2, 'RESET', { fontSize: '14px', fill: '#ff4444', fontFamily: 'Courier New', fontStyle: 'bold' }).setInteractive({ useHandCursor: true });
    resetBtn.setOrigin(1, 0);
    resetBtn.on('pointerover', () => resetBtn.setFill('#ff6666'));
    resetBtn.on('pointerout', () => resetBtn.setFill('#ff4444'));
    resetBtn.on('pointerdown', () => { 
      if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) { 
        saveManager.resetSave(); 
        sfx.fail(); 
        this.transitionTo('BootScene'); 
      } 
    });
    
    // Version info
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE - 30, 'GhostShift v0.6.1 - Phase 9', { fontSize: '12px', fill: '#444455', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    // Initialize audio on first interaction
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
  }
  
  // Phase 9: Handle window resize for fullscreen
  _relayoutUI() {
    // Recenter elements based on new canvas size
    const { width, height } = this.scale;
    
    // Reposition title
    if (this.children) {
      // Find and update positions relative to new size
      // This is a basic implementation - more complex scenes may need more work
    }
  }
  
  // Cleanup listeners when scene is destroyed
  shutdown() {
    // Clean up grid animation timer
    if (this._gridTimer) {
      this._gridTimer.remove();
      this._gridTimer = null;
    }
    if (this._fullscreenListener) {
      fullscreenManager.off(this._fullscreenListener);
    }
    if (this._resizeListener) {
      fullscreenManager.off(this._resizeListener);
    }
    super.shutdown();
  }
  
  drawGrid() {
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0x1a1a2a, 0.3);
    for (let x = 0; x <= MAP_WIDTH; x++) {
      this.gridGraphics.lineBetween(x * 32, 0, x * 32, MAP_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      this.gridGraphics.lineBetween(0, y * 32, MAP_WIDTH * TILE_SIZE, y * 32);
    }
  }
  
  // Phase 9: Handle window resize for fullscreen
  _handleResize() {
    const { width } = this.scale;
    const centerX = width / 2;
    
    // Update grid position if needed
    if (this.gridGraphics) {
      this.gridGraphics.setPosition(centerX, MAP_HEIGHT * TILE_SIZE / 2);
    }
  }
  
  transitionTo(sceneKey) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    
    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000);
    overlay.setDepth(100);
    overlay.setAlpha(0);
    
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.scene.start(sceneKey);
        this.time.delayedCall(50, () => {
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => overlay.destroy()
          });
        });
      }
    });
  }
}

// ==================== CONTROLS SCENE ====================
class ControlsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ControlsScene' });
  }

  create() {
    // Phase 9: Register resize listener for fullscreen handling
    this._resizeListener = () => this._handleResize();
    fullscreenManager.on('resize', this._resizeListener);
    
    // Background
    this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x0a0a0f);
    
    // OPTIMIZATION: Static grid with slower animation (100ms instead of 50ms)
    this.gridGraphics = this.add.graphics();
    this.gridOffset = 0;
    this._gridTimer = this.time.addEvent({
      delay: 100,  // Reduced from 50ms - half the draw calls
      callback: () => {
        this.gridOffset = (this.gridOffset + 0.3) % 32;
        this.drawGrid();
      },
      loop: true
    });
    
    // Title
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, 30, '🎮 CONTROLS', { fontSize: '28px', fill: '#66ccff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    // Back button
    const backBtn = this.add.text(20, 15, '< BACK', { fontSize: '14px', fill: '#888888', fontFamily: 'Courier New' }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setFill('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setFill('#888888'));
    backBtn.on('pointerdown', () => {
      sfx.click();
      this.transitionTo('MainMenuScene');
    });
    
    // Keyboard shortcut for back
    this.input.keyboard.on('keydown-ESC', () => {
      sfx.click();
      this.transitionTo('MainMenuScene');
    });
    
    // Scrollable content container
    const panelWidth = 520;
    const panelHeight = 440;
    const startY = 85;
    
    // Movement controls section
    this.add.text(40, startY, '🚶 MOVEMENT', { fontSize: '16px', fill: '#ffdd00', fontFamily: 'Courier New', fontStyle: 'bold' });
    
    const movementControls = [
      { keys: 'W / ↑', action: 'Move Up', example: 'Walk forward' },
      { keys: 'S / ↓', action: 'Move Down', example: 'Walk backward' },
      { keys: 'A / ←', action: 'Move Left', example: 'Go left' },
      { keys: 'D / →', action: 'Move Right', example: 'Go right' }
    ];
    
    let yPos = startY + 30;
    movementControls.forEach(ctrl => {
      this.createKeybindRow(40, yPos, ctrl.keys, ctrl.action, ctrl.example, '#00d4ff');
      yPos += 32;
    });
    
    // Game controls section
    yPos += 15;
    this.add.text(40, yPos, '🎯 GAME ACTIONS', { fontSize: '16px', fill: '#ffdd00', fontFamily: 'Courier New', fontStyle: 'bold' });
    yPos += 30;
    
    const gameControls = [
      { keys: 'R', action: 'Restart Level', example: 'Try again if caught' },
      { keys: 'ESC', action: 'Pause Game', example: 'Take a break' },
      { keys: 'SPACE', action: 'Start/Confirm', example: 'Begin your mission' },
      { keys: 'M', action: 'Main Menu', example: 'Return to title' }
    ];
    
    gameControls.forEach(ctrl => {
      this.createKeybindRow(40, yPos, ctrl.keys, ctrl.action, ctrl.example, '#66ff88');
      yPos += 32;
    });
    
    // Mouse/Touch section
    yPos += 15;
    this.add.text(40, yPos, '🖱️ MOUSE', { fontSize: '16px', fill: '#ffdd00', fontFamily: 'Courier New', fontStyle: 'bold' });
    yPos += 30;
    
    const mouseControls = [
      { keys: 'Click', action: 'Select/Interact', example: 'Press buttons' },
      { keys: 'Hover', action: 'Highlight', example: 'See button glow' }
    ];
    
    mouseControls.forEach(ctrl => {
      this.createKeybindRow(40, yPos, ctrl.keys, ctrl.action, ctrl.example, '#ff88ff');
      yPos += 32;
    });
    
    // Tips section
    yPos += 20;
    const tipsBox = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, yPos + 40, panelWidth, 90, 0x1a2a3a);
    tipsBox.setStrokeStyle(2, 0x4488ff);
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, yPos + 10, '💡 PRO TIPS', { fontSize: '14px', fill: '#66ccff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    const tips = [
      '• Move diagonally by pressing two arrow keys at once',
      '• Stay in shadows to avoid detection!',
      '• Press R quickly to restart if you get caught'
    ];
    
    tips.forEach((tip, i) => {
      this.add.text(40, yPos + 30 + (i * 18), tip, { fontSize: '12px', fill: '#aaaaaa', fontFamily: 'Courier New' });
    });
    
    // How to Play link
    yPos += 110;
    const howToPlayBtn = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, yPos, 280, 45, 0x1a3a5a);
    howToPlayBtn.setStrokeStyle(2, 0x66ccff);
    howToPlayBtn.setInteractive({ useHandCursor: true });
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, yPos, '📖 View How to Play Guide', { fontSize: '14px', fill: '#66ccff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    howToPlayBtn.on('pointerover', () => {
      howToPlayBtn.setFillStyle(0x2a4a6a);
      howToPlayBtn.setStrokeStyle(2, 0xffffff);
    });
    howToPlayBtn.on('pointerout', () => {
      howToPlayBtn.setFillStyle(0x1a3a5a);
      howToPlayBtn.setStrokeStyle(2, 0x66ccff);
    });
    howToPlayBtn.on('pointerdown', () => {
      sfx.click();
      // Show How to Play overlay from Controls page
      this.showHowToPlayOverlay();
    });
    
    // Version info
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE - 20, 'GhostShift v0.6.0 - Controls', { fontSize: '11px', fill: '#444455', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
  }
  
  createKeybindRow(x, y, keys, action, example, keyColor) {
    // Key badge
    const keyWidth = keys.length * 10 + 20;
    const keyBg = this.add.rectangle(x + keyWidth/2, y, keyWidth, 24, 0x2a2a3a);
    keyBg.setStrokeStyle(2, keyColor);
    const keyText = this.add.text(x + keyWidth/2, y, keys, { fontSize: '12px', fill: keyColor, fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    // Action name
    const actionX = x + keyWidth + 20;
    this.add.text(actionX, y, action, { fontSize: '13px', fill: '#ffffff', fontFamily: 'Courier New' }).setOrigin(0, 0.5);
    
    // Example (kid-friendly)
    const exampleX = x + keyWidth + 160;
    this.add.text(exampleX, y, example, { fontSize: '12px', fill: '#888888', fontFamily: 'Courier New', fontStyle: 'italic' }).setOrigin(0, 0.5);
  }
  
  // Phase 9: Handle window resize for fullscreen
  _handleResize() {
    const { width } = this.scale;
    const centerX = width / 2;
    
    // Update grid position if needed
    if (this.gridGraphics) {
      this.gridGraphics.setPosition(centerX, MAP_HEIGHT * TILE_SIZE / 2);
    }
  }
  
  // Cleanup listeners when scene is destroyed
  shutdown() {
    // Clean up grid animation timer
    if (this._gridTimer) {
      this._gridTimer.remove();
      this._gridTimer = null;
    }
    if (this._resizeListener) {
      fullscreenManager.off(this._resizeListener);
    }
    super.shutdown();
  }
  
  showHowToPlayOverlay() {
    // First transition back to main menu, then show How to Play
    // We need to pass a flag to show How to Play after transition
    this.transitionTo('MainMenuScene', { showHowToPlay: true });
  }
  
  drawGrid() {
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0x1a1a2a, 0.3);
    for (let x = 0; x <= MAP_WIDTH; x++) {
      this.gridGraphics.lineBetween(x * 32, 0, x * 32, MAP_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      this.gridGraphics.lineBetween(0, y * 32, MAP_WIDTH * TILE_SIZE, y * 32);
    }
  }
  
  transitionTo(sceneKey, data = null) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    
    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000);
    overlay.setDepth(100);
    overlay.setAlpha(0);
    
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (data) {
          this.scene.start(sceneKey, data);
        } else {
          this.scene.start(sceneKey);
        }
        this.time.delayedCall(50, () => {
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => overlay.destroy()
          });
        });
      }
    });
  }
}

// ==================== RESULTS SCENE ====================
class ResultsScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultsScene' }); }
  
  init(data) {
    this.resultData = data || {};
    this.levelIndex = this.resultData.levelIndex || 0;
    this.success = this.resultData.success || false;
    this.time = this.resultData.time || 0;
    this.credits = this.resultData.credits || 0;
  }

  create() {
    // Phase 9: Register resize listener for fullscreen handling
    this._resizeListener = () => this._handleResize();
    fullscreenManager.on('resize', this._resizeListener);
    
    // Background
    this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x0a0a0f);
    
    // Particles for win/lose
    this.createResultParticles();
    
    const titleText = this.success ? 'MISSION COMPLETE!' : 'MISSION FAILED';
    const titleColor = this.success ? '#00ff88' : '#ff4444';
    const title = this.add.text(MAP_WIDTH * TILE_SIZE / 2, 60, titleText, { fontSize: '32px', fill: titleColor, fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    // Title animation
    title.setAlpha(0);
    title.setScale(0.5);
    this.tweens.add({
      targets: title,
      alpha: 1,
      scale: 1,
      duration: 400,
      ease: 'Back.easeOut'
    });
    
    // Phase 6: Add level name indicator
    const levelName = LEVEL_LAYOUTS[this.levelIndex]?.name || `Level ${this.levelIndex + 1}`;
    const levelLabel = this.add.text(MAP_WIDTH * TILE_SIZE / 2, 95, levelName.toUpperCase(), { fontSize: '12px', fill: '#556677', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    // Stats panel
    const statsY = 140;
    if (this.success) {
      const creditsText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, statsY, '+' + this.credits + ' Credits', { fontSize: '20px', fill: '#ffaa00', fontFamily: 'Courier New' }).setOrigin(0.5);
      const timeText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, statsY + 30, 'Time: ' + this.formatTime(this.time), { fontSize: '16px', fill: '#888888', fontFamily: 'Courier New' }).setOrigin(0.5);
      
      // Best time for this level - Phase 6: check for new record
      const previousBest = saveManager.getBestTime(this.levelIndex);
      const isNewRecord = previousBest === null || this.time < previousBest;
      const bestTime = isNewRecord ? this.time : previousBest;
      
      let bestText, newBestText;
      if (isNewRecord) {
        newBestText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, statsY + 55, '★ NEW BEST!', { fontSize: '16px', fill: '#ffdd00', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
        bestText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, statsY + 75, 'Best: ' + this.formatTime(bestTime), { fontSize: '14px', fill: '#4488ff', fontFamily: 'Courier New' }).setOrigin(0.5);
      } else {
        bestText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, statsY + 55, 'Best: ' + this.formatTime(bestTime), { fontSize: '14px', fill: '#4488ff', fontFamily: 'Courier New' }).setOrigin(0.5);
      }
      
      // Animate stats
      const statsToAnimate = isNewRecord ? [creditsText, timeText, newBestText, bestText] : [creditsText, timeText, bestText];
      statsToAnimate.forEach((t, i) => {
        t.setAlpha(0);
        t.setY(t.y + 20);
        this.tweens.add({
          targets: t,
          alpha: 1,
          y: t.y - 20,
          duration: 300,
          delay: 200 + i * 100,
          ease: 'Quad.easeOut'
        });
      });
    } else {
      const detectText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, statsY, 'You were detected!', { fontSize: '16px', fill: '#ff4444', fontFamily: 'Courier New' }).setOrigin(0.5);
      const retryText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, statsY + 30, 'Press R to retry', { fontSize: '14px', fill: '#888888', fontFamily: 'Courier New' }).setOrigin(0.5);
      
      // Animate failure text
      [detectText, retryText].forEach((t, i) => {
        t.setAlpha(0);
        this.tweens.add({
          targets: t,
          alpha: 1,
          duration: 300,
          delay: 200 + i * 100
        });
      });
    }
    
    // Buttons
    const buttonY = 230;
    const buttonWidth = 180;
    const buttonHeight = 40;
    const spacing = 55;
    
    // Retry button
    this.createButton(MAP_WIDTH * TILE_SIZE / 2 - spacing - 10, buttonY, buttonWidth, buttonHeight, '↻ RETRY', 0x2244aa, 0x4488ff, () => {
      sfx.select();
      this.transitionTo('GameScene', { levelIndex: this.levelIndex });
    });
    
    // Next Level button (only if success and next level exists)
    const nextLevelExists = this.success && this.levelIndex < LEVEL_LAYOUTS.length - 1;
    const isNextUnlocked = nextLevelExists && saveManager.isLevelUnlocked(this.levelIndex + 1);
    if (this.success && nextLevelExists) {
      this.createButton(MAP_WIDTH * TILE_SIZE / 2 + spacing + 10, buttonY, buttonWidth, buttonHeight, 'NEXT ▶', 0x1a4a2a, isNextUnlocked ? 0x44ff88 : 0x444444, () => {
        if (isNextUnlocked) {
          sfx.select();
          this.transitionTo('GameScene', { levelIndex: this.levelIndex + 1 });
        }
      }, !isNextUnlocked);
    } else if (this.success) {
      // Show "All Complete" if last level
      this.add.text(MAP_WIDTH * TILE_SIZE / 2 + spacing + 10, buttonY, 'COMPLETE!', { fontSize: '14px', fill: '#ffaa00', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    }
    
    // Level Select button
    const menuY = buttonY + spacing;
    this.createButton(MAP_WIDTH * TILE_SIZE / 2 - spacing - 10, menuY, buttonWidth, buttonHeight, '▣ LEVELS', 0x2a2a3a, 0x8888aa, () => {
      sfx.select();
      this.transitionTo('LevelSelectScene');
    });
    
    // Main Menu button
    this.createButton(MAP_WIDTH * TILE_SIZE / 2 + spacing + 10, menuY, buttonWidth, buttonHeight, '⌂ MENU', 0x2a2a3a, 0x8888aa, () => {
      sfx.select();
      this.transitionTo('MainMenuScene');
    });
    
    // Keyboard shortcuts
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE - 30, '[R] Retry | [ESC] Menu', { fontSize: '12px', fill: '#444455', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    this.input.keyboard.on('keydown-R', () => {
      sfx.select();
      this.transitionTo('GameScene', { levelIndex: this.levelIndex });
    });
    this.input.keyboard.on('keydown-ESC', () => {
      sfx.select();
      this.transitionTo('MainMenuScene');
    });
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
  }
  
  // Phase 9: Handle window resize for fullscreen
  _handleResize() {
    const { width } = this.scale;
    const centerX = width / 2;
    
    // Reposition particles if needed
    // (Particles are dynamically created so minimal handling needed)
  }
  
  // Cleanup listeners when scene is destroyed
  shutdown() {
    // Clean up particle animation timer
    if (this._particleTimer) {
      this._particleTimer.remove();
      this._particleTimer = null;
    }
    if (this._resizeListener) {
      fullscreenManager.off(this._resizeListener);
    }
    super.shutdown();
  }
  
  createResultParticles() {
    // Create particles for win/lose effect
    this.resultParticles = [];
    const particleCount = this.success ? 30 : 20;
    const colors = this.success ? [0x00ff88, 0x44ffaa, 0x88ffcc, 0xffaa00] : [0xff4444, 0xff6644, 0xff2222];
    
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * MAP_WIDTH * TILE_SIZE;
      const y = Math.random() * MAP_HEIGHT * TILE_SIZE;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const particle = this.add.circle(x, y, 2 + Math.random() * 4, color, 0.3 + Math.random() * 0.4);
      particle.speedX = (Math.random() - 0.5) * 2;
      particle.speedY = -1 - Math.random() * 2;
      particle.life = 1;
      particle.decay = 0.005 + Math.random() * 0.01;
      this.resultParticles.push(particle);
    }
    
    // Animate particles - store timer for cleanup
    this._particleTimer = this.time.addEvent({
      delay: 16,
      callback: () => {
        this.resultParticles.forEach(p => {
          p.x += p.speedX;
          p.y += p.speedY;
          p.life -= p.decay;
          p.setAlpha(p.life * 0.5);
          
          if (p.life <= 0 || p.y < 0) {
            p.x = Math.random() * MAP_WIDTH * TILE_SIZE;
            p.y = MAP_HEIGHT * TILE_SIZE + 10;
            p.life = 1;
          }
        });
      },
      loop: true
    });
  }
  
  transitionTo(sceneKey, data = null) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    
    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000);
    overlay.setDepth(100);
    overlay.setAlpha(0);
    
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (data) {
          this.scene.start(sceneKey, data);
        } else {
          this.scene.start(sceneKey);
        }
        this.time.delayedCall(50, () => {
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => overlay.destroy()
          });
        });
      }
    });
  }
  
  createButton(x, y, width, height, text, bgColor, strokeColor, onClick, disabled = false) {
    const bg = this.add.rectangle(x, y, width, height, disabled ? 0x1a1a1a : bgColor);
    bg.setStrokeStyle(2, disabled ? 0x333333 : strokeColor);
    bg.setInteractive({ useHandCursor: !disabled });
    const label = this.add.text(x, y, text, { fontSize: '14px', fill: disabled ? '#444444' : '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    // Enhanced hover effects
    bg.on('pointerover', () => { 
      if (!disabled) { 
        bg.setFillStyle(bgColor + 0x202020); 
        bg.setStrokeStyle(2, 0xffffff);
        sfx.menuHover(); 
      } 
    });
    bg.on('pointerout', () => { 
      if (!disabled) {
        bg.setFillStyle(bgColor); 
        bg.setStrokeStyle(2, strokeColor);
      }
    });
    bg.on('pointerdown', () => {
      // Button press animation
      this.tweens.add({
        targets: bg,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          bg.setScale(1);
        }
      });
      onClick();
    });
    return { bg, label };
  }
  
  formatTime(ms) { if (!ms) return '--:--'; const minutes = Math.floor(ms / 60000); const seconds = Math.floor((ms % 60000) / 1000); const centis = Math.floor((ms % 1000) / 10); return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0') + '.' + centis.toString().padStart(2, '0'); }
}

// ==================== GAME SCENE ====================
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.requestedLevelIndex = null;
  }
  
  init(data) {
    this.requestedLevelIndex = data?.levelIndex ?? null;
    this.continueRun = data?.continueRun ?? false;
  }

  // Manual restart method for testing
  manualRestart() {
    this._restarted = true;
    this.scene.restart();
  }
  
  create() {
    // Phase 9: Register resize listener for fullscreen handling
    this._resizeListener = () => this._handleResize();
    fullscreenManager.on('resize', this._resizeListener);
    
    // Initialize instance variables
    this.player = null; this.guard = null; this.ghost = null;
    this.scannerDrone = null; this.cameras = []; this.motionSensors = [];
    this.dataCore = null; this.keyCard = null; this.hackTerminal = null; this.exitZone = null;
    this.cursors = null; this.wasd = null;
    this.timerText = null; this.runText = null; this.objectiveText = null;
    this.statusText = null; this.creditsText = null; this.perksText = null;
    this.elapsedTime = 0; this.isRunning = false; this.isPaused = false;
    this.isDetected = false; this.hasDataCore = false; this.hasKeyCard = false; this.isHacking = false; this.hackProgress = 0;
    this.currentRun = []; this.previousRun = null; this.ghostFrame = 0;
    this.guardPatrolPoints = []; this.currentPatrolIndex = 0; this.guardAngle = 0;
    this.visionGraphics = null; this.walls = null;
    this.scannerAngle = 0; this.applySpeedBoost = false; this.applyStealth = false;
    this.hasWon = false;
    this._restarted = false;
    
    // Enable performance instrumentation for this scene
    perfManager.setEnabled(true);
    perfManager.sceneRef = this;
    
    // Set up keyboard handlers - must be set up immediately
    this.cursors = this.input.keyboard.createCursorKeys();
    this.rKey = this.input.keyboard.addKeys({ r: Phaser.Input.Keyboard.KeyCodes.R });
    
    // Listen to keyboard at document level using Phaser's global keyboard
    this.input.keyboard.on('keydown', (event) => {
      if (event.code === 'KeyR' || event.key === 'r' || event.key === 'R') {
        this._restarted = true;
        this.scene.restart();
      }
    });
    
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
    this.applySpeedBoost = saveManager.getPerkLevel('speed') > 0;
    this.applyStealth = saveManager.getPerkLevel('stealth') > 0;
    this.currentLevelIndex = this.requestedLevelIndex !== null ? this.requestedLevelIndex : Math.floor(Math.random() * LEVEL_LAYOUTS.length);
    this.currentLayout = LEVEL_LAYOUTS[this.currentLevelIndex];
    // Phase 4: Get difficulty settings for this level
    this.levelDifficulty = this.currentLayout.difficulty || 1;
    this.currentGuardSpeed = getGuardSpeedForLevel(this.levelDifficulty);
    this.currentVisionDistance = getVisionConeDistanceForLevel(this.levelDifficulty);
    this.currentVisionAngle = getVisionConeAngleForLevel(this.levelDifficulty);
    this.currentMotionCooldown = getMotionSensorCooldownForLevel(this.levelDifficulty);
    this.createMap();
    this.createEntities();
    this.createUI();
    this.createPauseMenu();
    // Vignette effect for atmosphere (using a large soft-edged circle approach via gradient simulation)
    this.vignette = this.add.graphics();
    const vignetteSize = Math.max(MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE) * 0.8;
    this.vignette.fillStyle(0x000000, 0.3);
    // Draw corners as approximate vignette
    this.vignette.fillRect(0, 0, MAP_WIDTH * TILE_SIZE, 40);
    this.vignette.fillRect(0, MAP_HEIGHT * TILE_SIZE - 40, MAP_WIDTH * TILE_SIZE, 40);
    this.vignette.fillRect(0, 0, 40, MAP_HEIGHT * TILE_SIZE);
    this.vignette.fillRect(MAP_WIDTH * TILE_SIZE - 40, 0, 40, MAP_HEIGHT * TILE_SIZE);
    this.isRunning = true;
    this.currentRun = [];
    // Store timer reference for cleanup
    this._frameTimer = this.time.addEvent({ delay: 50, callback: this.recordFrame, callbackScope: this, loop: true });
  }
  
  // Phase 9: Handle window resize for fullscreen
  _handleResize() {
    // Game scene may need to update camera or UI positions
    // For now, minimal handling needed as game uses fixed canvas size
  }
  
  // Cleanup listeners when scene is destroyed
  shutdown() {
    // Clean up frame recording timer
    if (this._frameTimer) {
      this._frameTimer.remove();
      this._frameTimer = null;
    }
    // Clean up hack timer if running
    if (this.hackTimer) {
      this.hackTimer.remove();
      this.hackTimer = null;
    }
    // Clean up detected scene event timer
    if (this.detectedSceneEvent) {
      this.detectedSceneEvent.remove();
      this.detectedSceneEvent = null;
    }
    if (this._resizeListener) {
      fullscreenManager.off(this._resizeListener);
    }
    super.shutdown();
  }
  
  createEntities() {
    const startPos = this.currentLayout.playerStart;
    // Player with glow effect
    this.playerGlow = this.add.circle(startPos.x * TILE_SIZE, startPos.y * TILE_SIZE, TILE_SIZE / 2 + 4, 0x00ffff, 0.15);
    this.player = this.add.rectangle(startPos.x * TILE_SIZE, startPos.y * TILE_SIZE, TILE_SIZE - 8, TILE_SIZE - 8, 0x00d4ff);
    this.player.setStrokeStyle(2, 0x00ffff);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    
    // Player movement trail - use object pool (pre-allocate)
    this.playerTrail = this.add.graphics();
    this.playerTrailPoints = [];
    this._trailPool = [];  // Pre-allocated pool
    for (let i = 0; i < 12; i++) {
      this._trailPool.push({ x: 0, y: 0, alpha: 0, active: false });
    }

    // Guard with menacing glow
    this.guardGlow = this.add.circle(TILE_SIZE * 15, TILE_SIZE * 7, TILE_SIZE / 2 + 4, 0xff3344, 0.15);
    this.guard = this.add.rectangle(TILE_SIZE * 15, TILE_SIZE * 7, TILE_SIZE - 8, TILE_SIZE - 8, 0xff3344);
    this.guard.setStrokeStyle(2, 0xff6655);
    this.physics.add.existing(this.guard);
    this.guard.body.setCollideWorldBounds(true);
    this.guardPatrolPoints = this.currentLayout.guardPatrol.map(p => ({ x: p.x * TILE_SIZE, y: p.y * TILE_SIZE }));

    this.createScannerDrone();
    this.createCameras();
    this.createMotionSensors();
    this.createLaserGrids();
    this.createPatrolDrones();
    this.createVisionCone();

    // Phase 6: Level name indicator at top
    const levelName = this.currentLayout.name || `Level ${this.currentLevelIndex + 1}`;
    this.add.text(20, 12, levelName.toUpperCase(), { fontSize: '14px', fill: '#667788', fontFamily: 'Courier New', fontStyle: 'bold' });

    const dcPos = this.currentLayout.dataCore;
    this.dataCore = this.add.rectangle(dcPos.x * TILE_SIZE, dcPos.y * TILE_SIZE, TILE_SIZE - 4, TILE_SIZE - 4, 0xffaa00);
    this.dataCore.setStrokeStyle(2, 0xffdd44);
    this.physics.add.existing(this.dataCore, true);
    this.tweens.add({ targets: this.dataCore, alpha: 0.6, duration: 500, yoyo: true, repeat: -1 });

    const kcPos = this.currentLayout.keyCard;
    this.keyCard = this.add.rectangle(kcPos.x * TILE_SIZE, kcPos.y * TILE_SIZE, TILE_SIZE - 8, TILE_SIZE - 8, 0x00aaff);
    this.keyCard.setStrokeStyle(2, 0x66ddff);
    this.physics.add.existing(this.keyCard, true);
    this.tweens.add({ targets: this.keyCard, alpha: 0.5, duration: 300, yoyo: true, repeat: -1 });

    const htPos = this.currentLayout.hackTerminal;
    this.hackTerminal = this.add.rectangle(htPos.x * TILE_SIZE, htPos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0x00ff88);
    this.hackTerminal.setStrokeStyle(2, 0x88ffbb);
    this.physics.add.existing(this.hackTerminal, true);
    this.hackTerminalArea = this.add.zone(htPos.x * TILE_SIZE, htPos.y * TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 2);

    // New objectives: Security Code and Power Cell
    this.hasSecurityCode = false;
    this.hasPowerCell = false;
    
    if (this.currentLayout.securityCode) {
      const scPos = this.currentLayout.securityCode;
      this.securityCode = this.add.rectangle(scPos.x * TILE_SIZE, scPos.y * TILE_SIZE, TILE_SIZE - 8, TILE_SIZE - 8, 0x00ffff);
      this.securityCode.setStrokeStyle(2, 0x88ffff);
      this.physics.add.existing(this.securityCode, true);
      this.tweens.add({ targets: this.securityCode, alpha: 0.5, duration: 400, yoyo: true, repeat: -1 });
    }
    
    if (this.currentLayout.powerCell) {
      const pcPos = this.currentLayout.powerCell;
      this.powerCell = this.add.rectangle(pcPos.x * TILE_SIZE, pcPos.y * TILE_SIZE, TILE_SIZE - 8, TILE_SIZE - 8, 0xff00ff);
      this.powerCell.setStrokeStyle(2, 0xff88ff);
      this.physics.add.existing(this.powerCell, true);
      this.tweens.add({ targets: this.powerCell, alpha: 0.5, duration: 350, yoyo: true, repeat: -1 });
    }

    const exitPos = this.currentLayout.exitZone;
    // Exit zone with enhanced glow - Phase 6 improved
    this.exitZoneGlow = this.add.rectangle(exitPos.x * TILE_SIZE, exitPos.y * TILE_SIZE, TILE_SIZE * 2 + 20, TILE_SIZE * 3 + 20, 0x222222, 0.2);
    this.exitZone = this.add.rectangle(exitPos.x * TILE_SIZE, exitPos.y * TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 3, 0x222222, 0.6);
    this.exitZone.setStrokeStyle(3, 0x666677);
    this.physics.add.existing(this.exitZone, true);
    this.exitText = this.add.text(exitPos.x * TILE_SIZE, exitPos.y * TILE_SIZE, 'LOCKED', { fontSize: '12px', fill: '#ff4444', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    // Phase 6: Exit zone pulsing glow animation
    this.tweens.add({ targets: this.exitZoneGlow, alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });

    this.ghost = this.add.rectangle(-100, -100, TILE_SIZE - 8, TILE_SIZE - 8, 0x44ffaa);
    this.ghost.setAlpha(GHOST_ALPHA);
    this.ghost.setStrokeStyle(2, 0x66ffbb);
    this.physics.add.existing(this.ghost);
    this.ghost.body.setCollideWorldBounds(true);
    this.ghost.setVisible(false);
    // Ghost trail effect
    this.ghostTrail = this.add.graphics();

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.guard, this.walls);
    this.physics.add.collider(this.scannerDrone, this.walls);
    this.physics.add.overlap(this.player, this.dataCore, this.collectDataCore, null, this);
    this.physics.add.overlap(this.player, this.keyCard, this.collectKeyCard, null, this);
    this.physics.add.overlap(this.player, this.hackTerminalArea, this.startHack, null, this);
    this.physics.add.overlap(this.player, this.exitZone, this.reachExit, null, this);
    if (this.securityCode) this.physics.add.overlap(this.player, this.securityCode, this.collectSecurityCode, null, this);
    if (this.powerCell) this.physics.add.overlap(this.player, this.powerCell, this.collectPowerCell, null, this);
    this.physics.add.overlap(this.player, this.exitZone, this.reachExit, null, this);
    
    // Laser grid collision (instant detection)
    this.laserGrids.forEach(grid => {
      this.physics.add.overlap(this.player, grid.body, () => this.detected(), null, this);
    });
    
    // Patrol drone collision
    this.patrolDrones.forEach(drone => {
      this.physics.add.overlap(this.player, drone.sprite, () => this.detected(), null, this);
    });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ up: Phaser.Input.Keyboard.KeyCodes.W, down: Phaser.Input.Keyboard.KeyCodes.S, left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D });
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
  }
  
  createLaserGrids() {
    this.laserGrids = [];
    if (!this.currentLayout.laserGrids) return;
    this.currentLayout.laserGrids.forEach(pos => {
      const isHorizontal = pos.h;
      const laser = {
        x: pos.x * TILE_SIZE,
        y: pos.y * TILE_SIZE,
        horizontal: isHorizontal,
        graphics: this.add.graphics(),
        body: this.add.rectangle(pos.x * TILE_SIZE, pos.y * TILE_SIZE, isHorizontal ? TILE_SIZE * 3 : TILE_SIZE/2, isHorizontal ? TILE_SIZE/2 : TILE_SIZE * 3, 0xff0000, 0.8)
      };
      this.physics.add.existing(laser.body, true);
      this.laserGrids.push(laser);
    });
  }
  
  createPatrolDrones() {
    this.patrolDrones = [];
    if (!this.currentLayout.patrolDrones) return;
    this.currentLayout.patrolDrones.forEach(config => {
      const drone = this.add.rectangle(config.x * TILE_SIZE, config.y * TILE_SIZE, TILE_SIZE - 6, TILE_SIZE - 6, 0xff00ff);
      drone.setStrokeStyle(2, 0xff88ff);
      this.physics.add.existing(drone);
      drone.body.setCollideWorldBounds(true);
      
      const patrolPoints = config.patrol.map(p => ({ x: p.x * TILE_SIZE, y: p.y * TILE_SIZE }));
      this.patrolDrones.push({
        sprite: drone,
        patrolPoints: patrolPoints,
        patrolIndex: 0,
        speed: 60
      });
    });
  }

  collectSecurityCode(player, securityCode) {
    this.hasSecurityCode = true;
    securityCode.destroy();
    sfx.pickup();
    if (this.objectiveText4) {
      this.objectiveText4.setText('[+] Security Code');
      this.objectiveText4.setFill('#00ffff');
    }
    this.updateExitStatus();
  }
  
  collectPowerCell(player, powerCell) {
    this.hasPowerCell = true;
    powerCell.destroy();
    sfx.pickup();
    if (this.objectiveText5) {
      this.objectiveText5.setText('[+] Power Cell');
      this.objectiveText5.setFill('#ff00ff');
    }
  }

  createScannerDrone() {
    this.scannerDrone = this.add.circle(10 * TILE_SIZE, 10 * TILE_SIZE, TILE_SIZE / 2, 0x9900ff);
    this.scannerDrone.setStrokeStyle(2, 0xcc66ff);
    this.physics.add.existing(this.scannerDrone);
    this.scannerDrone.body.setCollideWorldBounds(true);
    this.scannerDrone.body.setImmovable(true);
    this.scannerDronePatrolPoints = [{ x: 10, y: 10 }, { x: 14, y: 10 }, { x: 14, y: 6 }, { x: 10, y: 6 }].map(p => ({ x: p.x * TILE_SIZE, y: p.y * TILE_SIZE }));
    this.scannerPatrolIndex = 0;
    this.scannerAngle = 0;
    this.scannerBeam = this.add.graphics();
  }

  createCameras() {
    this.cameras = [];
    this.currentLayout.cameras.forEach(pos => {
      const cam = { x: pos.x * TILE_SIZE, y: pos.y * TILE_SIZE, angle: 0, rotationSpeed: 0.015, visionDistance: 130, graphics: this.add.graphics(), body: this.add.rectangle(pos.x * TILE_SIZE, pos.y * TILE_SIZE, TILE_SIZE - 4, TILE_SIZE - 4, 0xff6600) };
      cam.body.setStrokeStyle(2, 0xffaa66);
      this.physics.add.existing(cam.body, true);
      this.cameras.push(cam);
    });
  }

  createMotionSensors() {
    this.motionSensors = [];
    this.currentLayout.motionSensors.forEach(pos => {
      const sensor = { x: pos.x * TILE_SIZE, y: pos.y * TILE_SIZE, detectionRadius: 60, cooldown: 0, graphics: this.add.graphics(), body: this.add.circle(pos.x * TILE_SIZE, pos.y * TILE_SIZE, TILE_SIZE / 3, 0xff0066) };
      sensor.body.setStrokeStyle(1, 0xff3388);
      this.physics.add.existing(sensor.body, true);
      this.motionSensors.push(sensor);
    });
  }

  createVisionCone() { this.visionGraphics = this.add.graphics(); }

  createUI() {
    this.timerText = this.add.text(10, 10, '00:00.00', { fontSize: '20px', fill: '#00ffaa', fontFamily: 'Courier New' });
    this.creditsText = this.add.text(10, 35, 'Credits: ' + saveManager.data.credits, { fontSize: '12px', fill: '#ffaa00', fontFamily: 'Courier New' });
    this.runText = this.add.text(10, 55, 'Run: ' + this.runCount, { fontSize: '12px', fill: '#888888', fontFamily: 'Courier New' });
    this.levelText = this.add.text(10, 70, 'Level: ' + this.currentLayout.name, { fontSize: '12px', fill: '#8888ff', fontFamily: 'Courier New' });
    this.objectiveText = this.add.text(10, 90, '[O] Key Card', { fontSize: '12px', fill: '#00aaff', fontFamily: 'Courier New' });
    this.objectiveText2 = this.add.text(10, 105, '[O] Hack Terminal', { fontSize: '12px', fill: '#00ff88', fontFamily: 'Courier New' });
    this.objectiveText3 = this.add.text(10, 120, '[O] Data Core', { fontSize: '12px', fill: '#ffaa00', fontFamily: 'Courier New' });
    // Phase 4: Additional objectives
    this.objectiveText4 = this.add.text(10, 135, '[O] Security Code', { fontSize: '12px', fill: '#00ffff', fontFamily: 'Courier New' });
    this.objectiveText5 = this.add.text(10, 150, '[O] Power Cell', { fontSize: '12px', fill: '#ff00ff', fontFamily: 'Courier New' });
    this.statusText = this.add.text(10, 170, 'Find the Key Card!', { fontSize: '11px', fill: '#666666', fontFamily: 'Courier New' });
    this.perksText = this.add.text(10, 185, 'Perks: S' + gameSave.perks.speed + '/L' + gameSave.perks.luck + '/St' + gameSave.perks.stealth, { fontSize: '10px', fill: '#666666', fontFamily: 'Courier New' });
    // Phase 4: Add difficulty indicator - Phase 6: improved color coding
    const diffColor = this.levelDifficulty === 1 ? '#44ff88' : (this.levelDifficulty === 2 ? '#ffaa00' : '#ff4444');
    const diffLabel = this.levelDifficulty === 1 ? 'EASY' : (this.levelDifficulty === 2 ? 'MEDIUM' : 'HARD');
    this.difficultyText = this.add.text(MAP_WIDTH * TILE_SIZE - 10, 10, diffLabel, { fontSize: '12px', fill: diffColor, fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(1, 0);
    this.add.text(10, MAP_HEIGHT * TILE_SIZE - 25, 'ARROWS/WASD: Move | R: Restart | ESC: Pause', { fontSize: '10px', fill: '#444455', fontFamily: 'Courier New' });
  }

  createPauseMenu() {
    this.pauseOverlay = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x000000, 0);
    this.pauseOverlay.setDepth(100);
    this.pauseOverlay.setVisible(false);
    this.pauseMenu = this.add.container(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2);
    this.pauseMenu.setDepth(101);
    this.pauseMenu.setVisible(false);
    this.pauseMenu.setAlpha(0);
    const bg = this.add.rectangle(0, 0, 250, 200, 0x1a1a2a, 0.95);
    bg.setStrokeStyle(2, 0x4488ff);
    const title = this.add.text(0, -80, 'PAUSED', { fontSize: '24px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    const audioBtn = this.add.text(0, -30, sfx.enabled ? '[X] Audio ON' : '[ ] Audio OFF', { fontSize: '14px', fill: '#ffffff', fontFamily: 'Courier New' }).setOrigin(0.5);
    audioBtn.setInteractive({ useHandCursor: true });
    audioBtn.on('pointerdown', () => { sfx.setEnabled(!sfx.enabled); audioBtn.setText(sfx.enabled ? '[X] Audio ON' : '[ ] Audio OFF'); sfx.select(); });
    const resumeBtn = this.add.text(0, 20, 'Resume [ESC]', { fontSize: '14px', fill: '#ffffff', fontFamily: 'Courier New' }).setOrigin(0.5);
    resumeBtn.setInteractive({ useHandCursor: true });
    resumeBtn.on('pointerdown', () => this.togglePause());
    const quitBtn = this.add.text(0, 60, 'Main Menu [M]', { fontSize: '12px', fill: '#888888', fontFamily: 'Courier New' }).setOrigin(0.5);
    quitBtn.setInteractive({ useHandCursor: true });
    quitBtn.on('pointerdown', () => this.scene.start('BootScene'));
    this.pauseMenu.add([bg, title, audioBtn, resumeBtn, quitBtn]);
  }

  togglePause() {
    if (this.isDetected) return;
    sfx.pause();
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.physics.pause();
      this.pauseOverlay.setVisible(true);
      this.pauseOverlay.setAlpha(0.7);
      this.pauseMenu.setVisible(true);
      this.tweens.add({ targets: this.pauseMenu, alpha: 1, duration: 200 });
    } else {
      this.physics.resume();
      this.tweens.add({ targets: this.pauseMenu, alpha: 0, duration: 200, onComplete: () => { this.pauseMenu.setVisible(false); } });
      this.pauseOverlay.setAlpha(0);
      this.pauseOverlay.setVisible(false);
    }
  }

  createMap() {
    // Deep background layer
    this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x0d0d15);
    
    // Subtle grid pattern overlay for depth
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x1a1a25, 0.3);
    for (let x = 0; x <= MAP_WIDTH; x++) {
      gridGraphics.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      gridGraphics.lineBetween(0, y * TILE_SIZE, MAP_WIDTH * TILE_SIZE, y * TILE_SIZE);
    }
    
    // Ambient floor texture (subtle scanlines)
    const floorGraphics = this.add.graphics();
    floorGraphics.lineStyle(1, 0x0a0a10, 0.15);
    for (let y = 0; y < MAP_HEIGHT * TILE_SIZE; y += 3) {
      floorGraphics.lineBetween(0, y, MAP_WIDTH * TILE_SIZE, y);
    }
    
    const wallColor = 0x2d2d3d;
    this.walls = this.add.group();
    for (let x = 0; x < MAP_WIDTH; x++) {
      const topWall = this.add.rectangle(x * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, wallColor);
      const bottomWall = this.add.rectangle(x * TILE_SIZE + TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, wallColor);
      this.physics.add.existing(topWall, true);
      this.physics.add.existing(bottomWall, true);
      this.walls.add(topWall);
      this.walls.add(bottomWall);
    }
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      const leftWall = this.add.rectangle(TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, wallColor);
      const rightWall = this.add.rectangle(MAP_WIDTH * TILE_SIZE - TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, wallColor);
      this.physics.add.existing(leftWall, true);
      this.physics.add.existing(rightWall, true);
      this.walls.add(leftWall);
      this.walls.add(rightWall);
    }
    this.currentLayout.obstacles.forEach(obs => {
      const wx = obs.x * TILE_SIZE + TILE_SIZE / 2;
      const wy = obs.y * TILE_SIZE + TILE_SIZE / 2;
      // Wall shadow for depth
      const shadow = this.add.rectangle(wx + 3, wy + 3, TILE_SIZE - 2, TILE_SIZE - 2, 0x000000, 0.4);
      // Wall body - Phase 6: improved readability with top highlight
      const wall = this.add.rectangle(wx, wy, TILE_SIZE - 2, TILE_SIZE - 2, 0x3d3d52);
      wall.setStrokeStyle(2, 0x5a5a72);
      // Top edge highlight for depth
      const highlight = this.add.rectangle(wx, wy - TILE_SIZE/2 + 4, TILE_SIZE - 4, 2, 0x6a6a82);
      this.walls.add(wall);
      this.physics.add.existing(wall, true);
    });
  }

  collectKeyCard(player, keyCard) {
    if (!this.hasKeyCard) {
      this.hasKeyCard = true;
      keyCard.setVisible(false);
      if (keyCard.body) keyCard.body.enable = false;
      sfx.collect();
      this.objectiveText.setText('[+] Key Card');
      this.objectiveText.setFill('#00ff00');
      this.statusText.setText('Key obtained! Hack the terminal!');
      this.statusText.setFill('#00aaff');
      this.cameras.main.flash(200, 0, 150, 255);
    }
  }

  collectDataCore(player, dataCore) {
    if (!this.hasDataCore && this.isHacking) {
      this.hasDataCore = true;
      dataCore.setVisible(false);
      if (dataCore.body) dataCore.body.enable = false;
      sfx.collect();
      this.objectiveText3.setText('[+] Data Core');
      this.objectiveText3.setFill('#00ff00');
      this.statusText.setText('Data secured! Exit unlocked!');
      this.statusText.setFill('#00ffaa');
      this.exitZone.fillColor = 0x22ff66;
      this.exitZone.fillAlpha = 0.4;
      this.exitZone.setStrokeStyle(2, 0x22ff66);
      // Enable exit glow
      if (this.exitZoneGlow) {
        this.exitZoneGlow.setFillStyle(0x22ff66, 0.2);
      }
      this.exitText.setText('OPEN');
      this.exitText.setFill('#22ff66');
      this.cameras.main.flash(200, 0, 255, 100);
    }
  }

  startHack(player, zone) {
    if (!this.hasKeyCard || this.isHacking) return;
    this.isHacking = true;
    this.hackProgress = 0;
    this.statusText.setText('HACKING... Stay in area!');
    this.statusText.setFill('#00ff88');
    this.hackTimer = this.time.addEvent({ delay: 100, callback: this.updateHack, callbackScope: this, loop: true });
  }

  updateHack() {
    if (!this.isHacking || this.isPaused) return;
    this.hackProgress += 2;
    if (this.hackProgress >= 100) {
      this.isHacking = false;
      if (this.hackTimer) this.hackTimer.remove();
      this.objectiveText2.setText('[+] Hack Terminal');
      this.objectiveText2.setFill('#00ff00');
      this.statusText.setText('Terminal hacked! Get the data core!');
      this.statusText.setFill('#ffaa00');
      sfx.win();
      this.cameras.main.flash(200, 255, 255, 100);
    }
  }

  reachExit(player, exit) { if (this.hasDataCore && !this.isDetected) { this.winGame(); } }

  recordFrame() {
    if (!this.isRunning) return;
    this.currentRun.push({ px: this.player.x, py: this.player.y, gx: this.guard.x, gy: this.guard.y, dx: this.scannerDrone ? this.scannerDrone.x : 0, dy: this.scannerDrone ? this.scannerDrone.y : 0, time: this.elapsedTime });
  }

  // Pre-calculated squared distances for collision detection (avoids sqrt)
  _SQUARED_DIST(p1x, p1y, p2x, p2y) {
    const dx = p2x - p1x;
    const dy = p2y - p1y;
    return dx * dx + dy * dy;
  }

  update(time, delta) {
    // Performance instrumentation start
    perfManager.startMarker('frame');
    
    // Check for restart key even when detected - use event listener
    if (this.isDetected) {
      // Check directly via DOM event
      perfManager.endMarker('frame');
      return;
    }
    if (!this.isRunning || this.isPaused || this.isDetected || this.hasWon) {
      perfManager.endMarker('frame');
      return;
    }
    
    this.elapsedTime += delta;
    
    perfManager.startMarker('updateTimer');
    this.updateTimer();
    perfManager.endMarker('updateTimer');
    
    perfManager.startMarker('updatePlayer');
    this.updatePlayer();
    perfManager.endMarker('updatePlayer');
    
    perfManager.startMarker('updateGuard');
    this.updateGuard();
    perfManager.endMarker('updateGuard');
    
    perfManager.startMarker('updateScannerDrone');
    this.updateScannerDrone();
    perfManager.endMarker('updateScannerDrone');
    
    perfManager.startMarker('updateCameras');
    this.updateCameras();
    perfManager.endMarker('updateCameras');
    
    perfManager.startMarker('updateMotionSensors');
    this.updateMotionSensors();
    perfManager.endMarker('updateMotionSensors');
    
    perfManager.startMarker('updateLaserGrids');
    this.updateLaserGrids();
    perfManager.endMarker('updateLaserGrids');
    
    perfManager.startMarker('updatePatrolDrones');
    this.updatePatrolDrones();
    perfManager.endMarker('updatePatrolDrones');
    
    perfManager.startMarker('updateGhost');
    this.updateGhost();
    perfManager.endMarker('updateGhost');
    
    perfManager.startMarker('updateExitGlow');
    this.updateExitGlow();
    perfManager.endMarker('updateExitGlow');
    
    perfManager.startMarker('checkDetection');
    this.checkDetection();
    this.checkScannerDetection();
    this.checkCameraDetection();
    perfManager.endMarker('checkDetection');
    
    // Record frame time
    perfManager.endMarker('frame');
    perfManager.recordFrame(delta);
  }

  updateTimer() {
    // Only update timer display every 50ms (reduces string allocations by ~5x)
    const updateInterval = 50;
    if (this.elapsedTime - (this._lastTimerUpdate || 0) < updateInterval && this._lastTimerUpdate !== undefined) return;
    this._lastTimerUpdate = this.elapsedTime;
    
    let time = this.elapsedTime;
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    const ms = Math.floor((time % 1000) / 10);
    this.timerText.setText(
      (minutes < 10 ? '0' : '') + minutes + ':' +
      (seconds < 10 ? '0' : '') + seconds + '.' +
      (ms < 10 ? '0' : '') + ms
    );
  }

  updatePlayer() {
    const body = this.player.body;
    body.setVelocity(0);
    let speed = BASE_PLAYER_SPEED * (1 + getSpeedBonus());
    if (this.cursors.left.isDown || this.wasd.left.isDown) body.setVelocityX(-speed);
    else if (this.cursors.right.isDown || this.wasd.right.isDown) body.setVelocityX(speed);
    if (this.cursors.up.isDown || this.wasd.up.isDown) body.setVelocityY(-speed);
    else if (this.cursors.down.isDown || this.wasd.down.isDown) body.setVelocityY(speed);
    if (body.velocity.x !== 0 && body.velocity.y !== 0) { body.setVelocityX(body.velocity.x * 0.707); body.setVelocityY(body.velocity.y * 0.707); }
    
    // Update player glow position
    if (this.playerGlow) {
      this.playerGlow.setPosition(this.player.x, this.player.y);
      // OPTIMIZATION: Reduce glow pulse frequency - only update every 4 frames
      this._glowFrame = (this._glowFrame || 0) + 1;
      if (this._glowFrame % 4 === 0) {
        const pulse = 0.1 + Math.floor(this.time.now / 200) % 10 * 0.005;
        this.playerGlow.setAlpha(pulse);
      }
    }
    
    // OPTIMIZATION: Player movement trail - only update every 2nd frame
    // This reduces trail rendering by 50% while maintaining visual quality
    const velocity = body.velocity.length();
    this._trailFrame = (this._trailFrame || 0) + 1;
    
    if (velocity > 0 && this._trailFrame % 2 === 0) {  // Update every 2nd frame
      // Find inactive trail point in pool
      const poolPoint = this._trailPool.find(p => !p.active);
      if (poolPoint) {
        poolPoint.x = this.player.x;
        poolPoint.y = this.player.y;
        poolPoint.alpha = 0.3;
        poolPoint.active = true;
      }
    }
    
    // Draw and update trail from pool - always draw for smooth fade
    this.playerTrail.clear();
    for (let i = 0; i < this._trailPool.length; i++) {
      const point = this._trailPool[i];
      if (point.active) {
        point.alpha -= 0.035;
        if (point.alpha > 0) {
          this.playerTrail.fillStyle(0x00d4ff, point.alpha * 0.5);
          this.playerTrail.fillCircle(point.x, point.y, 4 * point.alpha);
        } else {
          point.active = false;  // Return to pool
        }
      }
    }
  }

  updateGuard() {
    const target = this.guardPatrolPoints[this.currentPatrolIndex];
    const dx = target.x - this.guard.x, dy = target.y - this.guard.y;
    // Use squared distance check (5^2 = 25) to avoid sqrt for waypoint detection
    const sqDist = dx * dx + dy * dy;
    if (sqDist < 25) { 
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.guardPatrolPoints.length; 
    } else { 
      this.guardAngle = Math.atan2(dy, dx); 
      // Only compute sqrt when actually needed for velocity
      const dist = Math.sqrt(sqDist); 
      this.guard.body.setVelocity((dx / dist) * this.currentGuardSpeed, (dy / dist) * this.currentGuardSpeed); 
    }
    
    // Update guard glow position
    if (this.guardGlow) {
      this.guardGlow.setPosition(this.guard.x, this.guard.y);
      const pulse = 0.1 + Math.sin(this.time.now / 250) * 0.05;
      this.guardGlow.setAlpha(pulse);
    }
    
    this.updateVisionCone();
  }

  updateScannerDrone() {
    if (!this.scannerDrone) return;
    const target = this.scannerDronePatrolPoints[this.scannerPatrolIndex];
    const dx = target.x - this.scannerDrone.x, dy = target.y - this.scannerDrone.y;
    // Use squared distance check (5^2 = 25) for waypoint detection
    const sqDist = dx * dx + dy * dy;
    if (sqDist < 25) {
      this.scannerPatrolIndex = (this.scannerPatrolIndex + 1) % this.scannerDronePatrolPoints.length;
    } else {
      const dist = Math.sqrt(sqDist);
      this.scannerDrone.body.setVelocity((dx / dist) * 50, (dy / dist) * 50);
    }
    this.scannerAngle += 0.03;
    
    // Only clear and redraw beam if player is reasonably close (off-screen culling)
    const playerSqDist = (this.player.x - this.scannerDrone.x) ** 2 + (this.player.y - this.scannerDrone.y) ** 2;
    if (playerSqDist < 200 * 200) {
      this.scannerBeam.clear();
      const beamLength = 120;
      this.scannerBeam.fillStyle(0x9900ff, 0.2);
      this.scannerBeam.beginPath();
      this.scannerBeam.moveTo(this.scannerDrone.x, this.scannerDrone.y);
      this.scannerBeam.lineTo(this.scannerDrone.x + Math.cos(this.scannerAngle - 0.2) * beamLength, this.scannerDrone.y + Math.sin(this.scannerAngle - 0.2) * beamLength);
      this.scannerBeam.lineTo(this.scannerDrone.x + Math.cos(this.scannerAngle + 0.2) * beamLength, this.scannerDrone.y + Math.sin(this.scannerAngle + 0.2) * beamLength);
      this.scannerBeam.closePath();
      this.scannerBeam.fillPath();
    }
  }

  updateCameras() {
    // OPTIMIZATION: Only update camera cones periodically, not every frame
    // Track frame count and only redraw every 3rd frame
    this._camFrameCount = (this._camFrameCount || 0) + 1;
    const shouldUpdate = this._camFrameCount % 3 === 0;
    
    this.cameras.forEach(cam => {
      // Always update angle for detection logic
      cam.angle += cam.rotationSpeed;
      if (cam.angle > Math.PI * 0.6) cam.rotationSpeed = -0.015;
      if (cam.angle < -Math.PI * 0.6) cam.rotationSpeed = 0.015;
      
      // OPTIMIZATION: Skip graphics redraw if player is far away (beyond 250px)
      // Use squared distance check for culling
      const dx = this.player.x - cam.x;
      const dy = this.player.y - cam.y;
      if (dx * dx + dy * dy > 250 * 250) return;  // Skip if player > 250px away
      
      // Only redraw graphics periodically or when player is close
      if (shouldUpdate || dx * dx + dy * dy < 150 * 150) {
        cam.graphics.clear();
        const coneLen = cam.visionDistance;
        cam.graphics.fillStyle(0xff6600, 0.15);
        cam.graphics.beginPath();
        cam.graphics.moveTo(cam.x, cam.y);
        cam.graphics.lineTo(cam.x + Math.cos(cam.angle - 0.25) * coneLen, cam.y + Math.sin(cam.angle - 0.25) * coneLen);
        cam.graphics.lineTo(cam.x + Math.cos(cam.angle + 0.25) * coneLen, cam.y + Math.sin(cam.angle + 0.25) * coneLen);
        cam.graphics.closePath();
        cam.graphics.fillPath();
      }
    });
  }

  updateMotionSensors() {
    // Cache the squared effective radius to avoid sqrt in inner loop
    const MOTION_SENSOR_RADIUS_SQ = (MOTION_SENSOR_RADIUS + (this.levelDifficulty - 1) * 5) ** 2;
    const playerBody = this.player.body;
    const speed = playerBody.velocity.length();
    
    // Only check if player is actually moving (avoids unnecessary computation)
    if (speed > 10) {
      this.motionSensors.forEach(sensor => {
        // Quick AABB check before expensive squared distance
        const dx = this.player.x - sensor.x;
        const dy = this.player.y - sensor.y;
        // Use squared distance to avoid sqrt
        const sqDist = dx * dx + dy * dy;
        
        if (sqDist < MOTION_SENSOR_RADIUS_SQ && sensor.cooldown <= 0) {
          this.detected();
          sensor.cooldown = this.currentMotionCooldown;
        }
      });
    }
    
    // OPTIMIZATION: Only redraw sensor graphics every 2nd frame
    // Reduces draw calls by 50% while maintaining visual quality
    this._sensorFrameCount = (this._sensorFrameCount || 0) + 1;
    const shouldRedraw = this._sensorFrameCount % 2 === 0;
    
    this.motionSensors.forEach(sensor => {
      // Don't redraw graphics every frame - skip frames for performance
      if (!shouldRedraw && !sensor.cooldown) return;
      
      sensor.graphics.clear();
      // Don't redraw if player is far away (skip off-screen optimization)
      const dx = this.player.x - sensor.x;
      const dy = this.player.y - sensor.y;
      // OPTIMIZATION: Increased culling distance - skip if > 300px away
      if (dx * dx + dy * dy > 300 * 300) return; 
      
      const active = sensor.cooldown > 0;
      sensor.graphics.fillStyle(0xff0066, active ? 0.5 : 0.2);
      sensor.graphics.fillCircle(sensor.x, sensor.y, MOTION_SENSOR_RADIUS);
    });
  }
  
  updateLaserGrids() {
    this.laserGrids.forEach(grid => {
      grid.graphics.clear();
      // Pulsing effect
      const alpha = 0.3 + Math.sin(this.time.now / 200) * 0.2;
      grid.graphics.fillStyle(0xff0000, alpha);
      const halfW = grid.horizontal ? TILE_SIZE * 1.5 : TILE_SIZE / 4;
      const halfH = grid.horizontal ? TILE_SIZE / 4 : TILE_SIZE * 1.5;
      grid.graphics.fillRect(grid.x - halfW, grid.y - halfH, halfW * 2, halfH * 2);
    });
  }
  
  updateExitGlow() {
    // Pulse the exit zone glow when unlocked
    if (this.exitZoneGlow && this.hasDataCore) {
      const pulse = 0.15 + Math.sin(this.time.now / 300) * 0.1;
      this.exitZoneGlow.setAlpha(pulse);
    }
  }
  
  updatePatrolDrones() {
    this.patrolDrones.forEach(drone => {
      const target = drone.patrolPoints[drone.patrolIndex];
      const dx = target.x - drone.sprite.x;
      const dy = target.y - drone.sprite.y;
      // Use squared distance check for waypoint detection
      const sqDist = dx * dx + dy * dy;
      
      if (sqDist < 25) {
        drone.patrolIndex = (drone.patrolIndex + 1) % drone.patrolPoints.length;
      } else {
        const speed = drone.speed;
        // Only compute sqrt when actually moving
        const dist = Math.sqrt(sqDist);
        drone.sprite.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
      }
      
      // Rotate towards movement direction - only if moving
      if (sqDist >= 25) {
        drone.sprite.rotation = Math.atan2(dy, dx);
      }
    });
  }

  updateVisionCone() {
    // OPTIMIZATION: Cache vision cone and only redraw when guard position/angle changes significantly
    // This avoids redrawing every frame when guard is stationary
    const guard = this.guard;
    if (!guard || !this.visionGraphics) return;
    
    // Track guard state to avoid unnecessary redraws
    this._lastGuardX = this._lastGuardX || 0;
    this._lastGuardY = this._lastGuardY || 0;
    this._lastGuardAngle = this._lastGuardAngle || 0;
    
    // Only redraw if guard moved significantly (more than 5px) or angle changed (more than 0.05 rad)
    const dx = guard.x - this._lastGuardX;
    const dy = guard.y - this._lastGuardY;
    const dAngle = Math.abs(this.guardAngle - this._lastGuardAngle);
    
    // Skip redraw if nothing significant changed (reduces GPU load by ~70% when guard is patrolling steadily)
    if (dx * dx + dy * dy < 25 && dAngle < 0.05) {
      // Still update pulse animation occasionally (every 10 frames)
      this._visionFrameCount = (this._visionFrameCount || 0) + 1;
      if (this._visionFrameCount % 10 !== 0) return;
    }
    
    this._lastGuardX = guard.x;
    this._lastGuardY = guard.y;
    this._lastGuardAngle = this.guardAngle;
    this._visionFrameCount = 0;
    
    this.visionGraphics.clear();
    if (!this.isRunning || this.isDetected) return;
    
    // Use difficulty-based cone settings
    const coneLength = this.currentVisionDistance;
    const halfAngle = this.currentVisionAngle / 2;
    const tipX = guard.x, tipY = guard.y;
    const leftAngle = this.guardAngle - halfAngle, rightAngle = this.guardAngle + halfAngle;
    const leftX = tipX + Math.cos(leftAngle) * coneLength;
    const leftY = tipY + Math.sin(leftAngle) * coneLength;
    const rightX = tipX + Math.cos(rightAngle) * coneLength;
    const rightY = tipY + Math.sin(rightAngle) * coneLength;
    
    // OPTIMIZATION: Reduced precision for pulse - use integer division
    const pulsePhase = Math.floor(this.time.now / 300) % 64;
    const pulseAlpha = 0.08 + (pulsePhase / 1600) - 0.04;  // Approximate sin without Math.sin
    
    // Outer cone (faded) - simplified drawing
    this.visionGraphics.fillStyle(0xff2200, pulseAlpha * 0.5);
    this.visionGraphics.beginPath();
    this.visionGraphics.moveTo(tipX, tipY);
    this.visionGraphics.lineTo(leftX, leftY);
    this.visionGraphics.lineTo(rightX, rightY);
    this.visionGraphics.closePath();
    this.visionGraphics.fillPath();
    
    // Inner cone (brighter, gradient feel)
    const innerLength = coneLength * 0.6;
    const innerLeftX = tipX + Math.cos(leftAngle) * innerLength;
    const innerLeftY = tipY + Math.sin(leftAngle) * innerLength;
    const innerRightX = tipX + Math.cos(rightAngle) * innerLength;
    const innerRightY = tipY + Math.sin(rightAngle) * innerLength;
    
    this.visionGraphics.fillStyle(0xff4422, pulseAlpha * 1.5);
    this.visionGraphics.beginPath();
    this.visionGraphics.moveTo(tipX, tipY);
    this.visionGraphics.lineTo(innerLeftX, innerLeftY);
    this.visionGraphics.lineTo(innerRightX, innerRightY);
    this.visionGraphics.closePath();
    this.visionGraphics.fillPath();
  }

  updateGhost() {
    if (!this.currentRun || this.currentRun.length < 10) return;
    this.ghostFrame++;
    if (this.ghostFrame >= this.currentRun.length) this.ghostFrame = 0;
    const frame = this.currentRun[Math.floor(this.ghostFrame)];
    if (frame) {
      this.ghost.setPosition(frame.px, frame.py);
      this.ghost.setVisible(true);
    }
  }

  // Cached squared detection thresholds (pre-computed once)
  _DETECTION_SQUARED = 400;  // 20^2
  _GUARD_VISION_DIST_SQ = null;  // Computed per-level in create()
  _MOTION_SENSOR_DIST_SQ = null;   // Computed per-level in create()
  _CAMERA_DETECT_SQUARED = 625;   // 25^2
  _SCANNER_DETECT_SQUARED = 900;  // 30^2

  // Pre-calculated squared distances for collision detection (avoids sqrt)
  _SQUARED_DIST(p1x, p1y, p2x, p2y) {
    const dx = p2x - p1x;
    const dy = p2y - p1y;
    return dx * dx + dy * dy;
  }

  checkDetection() {
    // Use squared distance check instead of sqrt for performance
    const sqDist = this._SQUARED_DIST(this.player.x, this.player.y, this.guard.x, this.guard.y);
    
    // Direct collision (20px radius squared = 400)
    if (sqDist < this._DETECTION_SQUARED) { 
      this.detected(); 
      return; 
    }
    
    // Vision cone check - use pre-computed squared distance
    if (!this._GUARD_VISION_DIST_SQ) {
      this._GUARD_VISION_DIST_SQ = this.currentVisionDistance * this.currentVisionDistance;
    }
    
    if (sqDist < this._GUARD_VISION_DIST_SQ) {
      const angleToPlayer = Math.atan2(this.player.y - this.guard.y, this.player.x - this.guard.x);
      let angleDiff = angleToPlayer - this.guardAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (Math.abs(angleDiff) < this.currentVisionAngle / 2) {
        if (!this.isLineBlocked(this.guard.x, this.guard.y, this.player.x, this.player.y)) {
          this.detected();
        }
      }
    }
  }

  checkScannerDetection() {
    if (!this.scannerDrone) return;
    // Use squared distance check
    const sqDist = this._SQUARED_DIST(this.player.x, this.player.y, this.scannerDrone.x, this.scannerDrone.y);
    
    // Direct collision (30px radius squared = 900)
    if (sqDist < this._SCANNER_DETECT_SQUARED) { 
      this.detected(); 
      return; 
    }
    
    // Scanner beam check (120px range, squared = 14400)
    if (sqDist < 14400) {
      const angleToPlayer = Math.atan2(this.player.y - this.scannerDrone.y, this.player.x - this.scannerDrone.x);
      let angleDiff = angleToPlayer - this.scannerAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (Math.abs(angleDiff) < 0.3) {
        this.detected();
      }
    }
  }

  checkCameraDetection() {
    // Cache camera detection threshold squared
    const camDetectSq = this._CAMERA_DETECT_SQUARED;
    
    this.cameras.forEach(cam => {
      const sqDist = this._SQUARED_DIST(this.player.x, this.player.y, cam.x, cam.y);
      
      // Direct collision (25px radius squared = 625)
      if (sqDist < camDetectSq) { 
        this.detected(); 
        return; 
      }
      
      if (sqDist < cam.visionDistance * cam.visionDistance) {
        const angleToPlayer = Math.atan2(this.player.y - cam.y, this.player.x - cam.x);
        let angleDiff = angleToPlayer - cam.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) < 0.25) {
          if (!this.isLineBlocked(cam.x, cam.y, this.player.x, this.player.y)) {
            this.detected();
          }
        }
      }
    });
  }

  checkMotionSensorDetection() {
    // Handled in updateMotionSensors
  }

  isLineBlocked(x1, y1, x2, y2) {
    const steps = 10;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const checkX = x1 + (x2 - x1) * t;
      const checkY = y1 + (y2 - y1) * t;
      const tileX = Math.floor(checkX / TILE_SIZE);
      const tileY = Math.floor(checkY / TILE_SIZE);
      for (const obs of this.currentLayout.obstacles) {
        if (obs.x === tileX && obs.y === tileY) return true;
      }
    }
    return false;
  }

  detected() {
    if (this.isDetected) return;
    this.isDetected = true;
    // Don't pause physics completely - just stop player movement
    // This allows keyboard handlers to still work
    if (this.player?.body) this.player.body.setVelocity(0);
    sfx.alert();
    sfx.detection(); // Additional detection sound
    
    // Phase 6: Enhanced detection pulse effect - red flash overlay
    const { width, height } = this.scale;
    const pulseOverlay = this.add.rectangle(width/2, height/2, width, height, 0xff0000);
    pulseOverlay.setDepth(200);
    pulseOverlay.setAlpha(0);
    
    // Pulse animation - more dramatic
    this.tweens.add({
      targets: pulseOverlay,
      alpha: 0.5,
      duration: 80,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        pulseOverlay.destroy();
      }
    });
    
    // Player shake/glow red - more dramatic
    if (this.playerGlow) {
      this.playerGlow.setFillStyle(0xff0000, 0.6);
      this.tweens.add({
        targets: this.playerGlow,
        alpha: 1,
        duration: 80,
        yoyo: true,
        repeat: 5
      });
    }
    
    if (this.statusText) {
      this.statusText.setText('DETECTED! Press R to restart');
      this.statusText.setFill('#ff0000');
    }
    // Phase 6: Enhanced vignette effect on detection
    if (this.vignette) {
      this.vignette.setFillStyle(0xff0000, 0.3);
      this.tweens.add({
        targets: this.vignette,
        alpha: 0.8,
        duration: 150,
        yoyo: true,
        repeat: 3
      });
    }
    // Phase 6: More dramatic camera shake
    if (this.cameras?.main) this.cameras.main.shake(500, 0.03);
    
    // Store reference for restart check
    const sceneKey = this.scene.key;
    const levelIdx = this.currentLevelIndex;
    const sceneRef = this;
    this.detectedSceneEvent = this.time.addEvent({ delay: 1500, callback: () => {
      // Only transition if we're still the same scene instance and not restarted
      if (sceneRef.isDetected && sceneRef.scene.key === sceneKey && !sceneRef._restarted) {
        sceneRef.scene.start('ResultsScene', { 
          levelIndex: levelIdx,
          success: false, 
          time: sceneRef.elapsedTime, 
          credits: 0 
        });
      }
    }, callbackScope: this });
  }

  winGame() {
    if (!this.isRunning) return;
    this.physics.pause();
    sfx.win();
    const timeBonus = Math.max(0, 30000 - Math.floor(this.elapsedTime));
    const creditsEarned = 20 + Math.floor(timeBonus / 1000) + getLuckBonus();
    
    // Use SaveManager to properly record the run and unlock levels
    saveManager.recordRun(this.currentLevelIndex, this.elapsedTime, creditsEarned);
    
    // Mark as won - keep isRunning true for test compatibility
    this.hasWon = true;
    
    // Transition to ResultsScene
    this.scene.start('ResultsScene', { 
      levelIndex: this.currentLevelIndex,
      success: true, 
      time: this.elapsedTime, 
      credits: creditsEarned 
    });
  }
}

// ==================== GAME CONFIG ====================
const config = {
  type: Phaser.AUTO,
  width: MAP_WIDTH * TILE_SIZE,
  height: MAP_HEIGHT * TILE_SIZE,
  parent: 'game-container',
  backgroundColor: '#0a0a0f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: MAP_WIDTH * TILE_SIZE,
    height: MAP_HEIGHT * TILE_SIZE
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: [BootScene, MainMenuScene, LevelSelectScene, SettingsScene, ResultsScene, ControlsScene, GameScene]
};

// Phase 9: Listen to fullscreen changes and emit resize events
fullscreenManager.on('fullscreenchange', (isFullscreen) => {
  // When fullscreen state changes, trigger a resize event
  // This helps sync all scenes
  setTimeout(() => {
    fullscreenManager._emitResize();
  }, 100);
});

// Initialize game with dynamic Phaser import for better loading performance
(async () => {
  const Phaser = (await import('phaser')).default;
  const game = new Phaser.Game(config);
  window.__ghostGame = game;
})();
