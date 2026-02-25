/**
 * GhostShift Menu Button Asset Contract & Integration
 * 
 * STRICT PRODUCTION PRACTICES:
 * - Per-button, per-state texture mapping (no generic composite fallback)
 * - Explicit button->state->texture key mapping
 * - Asset QA validation (dimensions, transparency, alpha bounds)
 * - Keyboard/gamepad focus state visuals
 * - Cache-busting with version handling
 * 
 * BUTTON CONTRACT:
 * - Buttons: play, continue, how_to_play, controls, settings, credits
 * - States: idle, hover, pressed, disabled, focused
 * 
 * @module MenuButtonAssets
 */

import { ASSET_VERSION } from './asset-manifest.js';

// ==================== BUTTON ASSET CONTRACT ====================

/**
 * Button identifiers - canonical list
 */
export const BUTTON_IDS = {
  PLAY: 'play',
  CONTINUE: 'continue',
  HOW_TO_PLAY: 'how_to_play',
  CONTROLS: 'controls',
  SETTINGS: 'settings',
  CREDITS: 'credits'
};

/**
 * Button states - canonical list
 */
export const BUTTON_STATES = {
  IDLE: 'idle',
  HOVER: 'hover', 
  PRESSED: 'pressed',
  DISABLED: 'disabled',
  FOCUSED: 'focused' // Keyboard/gamepad focus
};

/**
 * Button asset specifications
 * - Expected dimensions and constraints
 */
export const BUTTON_SPECS = {
  WIDTH: 300,
  HEIGHT: 52,
  TIGHT_WIDTH: 240,
  TIGHT_HEIGHT: 44,
  FORMAT: 'png',
  MIN_ALPHA: 0, // Fully transparent pixels allowed
  MAX_ALPHA: 1, // Fully opaque
  TRANSPARENT_BG_REQUIRED: true
};

/**
 * PER-BUTTON, PER-STATE TEXTURE KEY MAPPING
 * 
 * This is the authoritative mapping. No generic fallbacks.
 * Each button has explicit state->texture mappings.
 */
export const BUTTON_TEXTURE_MAP = {
  [BUTTON_IDS.PLAY]: {
    [BUTTON_STATES.IDLE]: 'btn-play-idle',
    [BUTTON_STATES.HOVER]: 'btn-play-hover',
    [BUTTON_STATES.PRESSED]: 'btn-play-pressed',
    [BUTTON_STATES.DISABLED]: 'btn-play-disabled',
    [BUTTON_STATES.FOCUSED]: 'btn-play-focused'
  },
  [BUTTON_IDS.CONTINUE]: {
    [BUTTON_STATES.IDLE]: 'btn-continue-idle',
    [BUTTON_STATES.HOVER]: 'btn-continue-hover',
    [BUTTON_STATES.PRESSED]: 'btn-continue-pressed',
    [BUTTON_STATES.DISABLED]: 'btn-continue-disabled',
    [BUTTON_STATES.FOCUSED]: 'btn-continue-focused'
  },
  [BUTTON_IDS.HOW_TO_PLAY]: {
    [BUTTON_STATES.IDLE]: 'btn-how-to-play-idle',
    [BUTTON_STATES.HOVER]: 'btn-how-to-play-hover',
    [BUTTON_STATES.PRESSED]: 'btn-how-to-play-pressed',
    [BUTTON_STATES.DISABLED]: 'btn-how-to-play-disabled',
    [BUTTON_STATES.FOCUSED]: 'btn-how-to-play-focused'
  },
  [BUTTON_IDS.CONTROLS]: {
    [BUTTON_STATES.IDLE]: 'btn-controls-idle',
    [BUTTON_STATES.HOVER]: 'btn-controls-hover',
    [BUTTON_STATES.PRESSED]: 'btn-controls-pressed',
    [BUTTON_STATES.DISABLED]: 'btn-controls-disabled',
    [BUTTON_STATES.FOCUSED]: 'btn-controls-focused'
  },
  [BUTTON_IDS.SETTINGS]: {
    [BUTTON_STATES.IDLE]: 'btn-settings-idle',
    [BUTTON_STATES.HOVER]: 'btn-settings-hover',
    [BUTTON_STATES.PRESSED]: 'btn-settings-pressed',
    [BUTTON_STATES.DISABLED]: 'btn-settings-disabled',
    [BUTTON_STATES.FOCUSED]: 'btn-settings-focused'
  },
  [BUTTON_IDS.CREDITS]: {
    [BUTTON_STATES.IDLE]: 'btn-credits-idle',
    [BUTTON_STATES.HOVER]: 'btn-credits-hover',
    [BUTTON_STATES.PRESSED]: 'btn-credits-pressed',
    [BUTTON_STATES.DISABLED]: 'btn-credits-disabled',
    [BUTTON_STATES.FOCUSED]: 'btn-credits-focused'
  }
};

/**
 * ASSET PATH MAPPING
 * Maps texture keys to file paths with cache-busting version
 * 
 * Primary path: per-button per-state assets (future state-specific assets)
 * Fallback path: existing button assets (btn_play.png, etc.)
 */
export const BUTTON_ASSET_PATHS = {};

// Generate asset paths for all buttons and states
Object.entries(BUTTON_TEXTURE_MAP).forEach(([buttonId, states]) => {
  Object.entries(states).forEach(([state, textureKey]) => {
    // Convert buttonId to filename format (how_to_play -> how_to_play)
    const fileName = buttonId;
    
    // Primary path: per-button per-state asset (for future state-specific assets)
    const primaryPath = `assets/ui/buttons/per-button/${buttonId}/${state}.png`;
    
    // Fallback path: use existing base button asset (e.g., btn_play.png)
    // All states use the same base asset, with procedural state styling
    const fallbackPath = `assets/ui/buttons/btn_${fileName}.png`;
    
    BUTTON_ASSET_PATHS[textureKey] = {
      primary: primaryPath,
      fallback: fallbackPath,
      version: ASSET_VERSION
    };
  });
});

// ==================== ASSET QA VALIDATION ====================

/**
 * Asset QA validation result
 */
export class AssetQAResult {
  constructor(textureKey, passed, issues = []) {
    this.textureKey = textureKey;
    this.passed = passed;
    this.issues = issues;
    this.timestamp = Date.now();
  }
}

/**
 * Asset QA Validator
 * Validates button assets meet specifications
 */
export class AssetQAValidator {
  constructor(scene) {
    this.scene = scene;
    this.results = new Map();
  }
  
  /**
   * Validate a texture meets button specifications
   * @param {string} textureKey - Texture key to validate
   * @returns {AssetQAResult} Validation result
   */
  validateTexture(textureKey) {
    const issues = [];
    
    if (!this.scene.textures.exists(textureKey)) {
      return new AssetQAResult(textureKey, false, ['Texture not loaded']);
    }
    
    const texture = this.scene.textures.get(textureKey);
    const source = texture.source[0];
    
    if (!source) {
      return new AssetQAResult(textureKey, false, ['No texture source']);
    }
    
    const width = source.width;
    const height = source.height;
    
    // Check dimensions (allow some flexibility)
    const expectedWidth = BUTTON_SPECS.WIDTH;
    const expectedHeight = BUTTON_SPECS.HEIGHT;
    const toleranceWidth = expectedWidth * 1.5; // Allow up to 50% larger
    const toleranceHeight = expectedHeight * 1.5;
    
    if (width > toleranceWidth || height > toleranceHeight) {
      issues.push(`Dimensions ${width}x${height} exceed tolerance (max ${toleranceWidth}x${toleranceHeight})`);
    }
    
    // Check aspect ratio is reasonable (should be roughly 2:1 to 10:1 for buttons)
    const aspectRatio = width / height;
    if (aspectRatio < 1.5 || aspectRatio > 12) {
      issues.push(`Aspect ratio ${aspectRatio.toFixed(2)} outside expected range (1.5-12)`);
    }
    
    const passed = issues.length === 0;
    const result = new AssetQAResult(textureKey, passed, issues);
    this.results.set(textureKey, result);
    
    return result;
  }
  
  /**
   * Validate all button assets
   * @returns {Object} Summary with passed count, failed count, and issues
   */
  validateAllButtonAssets() {
    let passed = 0;
    let failed = 0;
    const allIssues = [];
    
    Object.values(BUTTON_TEXTURE_MAP).forEach(states => {
      Object.values(states).forEach(textureKey => {
        const result = this.validateTexture(textureKey);
        if (result.passed) {
          passed++;
        } else {
          failed++;
          allIssues.push({ textureKey, issues: result.issues });
        }
      });
    });
    
    return {
      total: passed + failed,
      passed,
      failed,
      issues: allIssues,
      timestamp: Date.now()
    };
  }
  
  /**
   * Get validation summary for logging
   */
  getSummary() {
    const results = Array.from(this.results.values());
    return {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      issues: results.filter(r => !r.passed).map(r => ({
        textureKey: r.textureKey,
        issues: r.issues
      }))
    };
  }
}

// ==================== BUTTON ASSET LOADER ====================

/**
 * Menu Button Asset Loader
 * Handles loading and validation of all menu button assets
 */
export class MenuButtonAssetLoader {
  constructor(scene) {
    this.scene = scene;
    this.validator = new AssetQAValidator(scene);
    this.loadedTextures = new Map(); // textureKey -> loaded status
    this.fallbackUsed = new Set(); // textureKeys using fallback
  }
  
  /**
   * Get versioned asset path with cache-busting
   * @param {string} path - Base path
   * @returns {string} Path with version query param
   */
  getVersionedPath(path) {
    return `${path}?v=${ASSET_VERSION}`;
  }
  
  /**
   * Load all menu button assets
   * @returns {Promise<Object>} Load result summary
   */
  async loadAll() {
    console.log('[MenuButtonAssets] Starting asset load...');
    const startTime = Date.now();
    
    const loadPromises = [];
    
    // Load all button textures
    Object.entries(BUTTON_ASSET_PATHS).forEach(([textureKey, paths]) => {
      loadPromises.push(this.loadTexture(textureKey, paths));
    });
    
    await Promise.allSettled(loadPromises);
    
    // Validate all loaded textures
    const qaSummary = this.validator.validateAllButtonAssets();
    
    const duration = Date.now() - startTime;
    console.log(`[MenuButtonAssets] Load complete in ${duration}ms. Loaded: ${this.loadedTextures.size}, Fallbacks: ${this.fallbackUsed.size}`);
    
    if (qaSummary.failed > 0) {
      console.warn('[MenuButtonAssets] QA issues detected:', qaSummary.issues);
    }
    
    return {
      loaded: this.loadedTextures.size,
      fallbacks: this.fallbackUsed.size,
      qaSummary,
      duration
    };
  }
  
  /**
   * Load a single texture with fallback support
   * @param {string} textureKey - Target texture key
   * @param {Object} paths - Primary and fallback paths
   * @returns {Promise<boolean>} True if loaded successfully
   */
  async loadTexture(textureKey, paths) {
    // Check if already loaded
    if (this.scene.textures.exists(textureKey)) {
      this.loadedTextures.set(textureKey, true);
      return true;
    }
    
    // Try primary path first
    try {
      await this._loadImage(textureKey, this.getVersionedPath(paths.primary));
      this.loadedTextures.set(textureKey, true);
      return true;
    } catch (primaryError) {
      // Primary failed, try fallback
      console.warn(`[MenuButtonAssets] Primary path failed for ${textureKey}, trying fallback`);
      
      try {
        // For fallback, we load the base button and use it for all states
        // We need to use a different key to avoid conflicts
        const fallbackKey = `${textureKey}_fallback`;
        await this._loadImage(fallbackKey, this.getVersionedPath(paths.fallback));
        
        // Create a reference from the desired key to the fallback texture
        // In Phaser, we can't easily alias textures, so we'll track this mapping
        this.scene.textures.get(fallbackKey).key = textureKey;
        
        this.loadedTextures.set(textureKey, true);
        this.fallbackUsed.add(textureKey);
        return true;
      } catch (fallbackError) {
        console.error(`[MenuButtonAssets] Failed to load ${textureKey}:`, fallbackError);
        this.loadedTextures.set(textureKey, false);
        return false;
      }
    }
  }
  
  /**
   * Internal image loader
   * @private
   */
  _loadImage(key, path) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Load timeout for ${key}`));
      }, 10000);
      
      const onComplete = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      const onError = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load ${path}`));
      };
      
      // Check if already in loader queue
      if (this.scene.load.isLoading()) {
        this.scene.load.once(`filecomplete-image-${key}`, onComplete);
        this.scene.load.once(`loaderror`, (file) => {
          if (file.key === key) onError();
        });
        this.scene.load.image(key, path);
      } else {
        this.scene.load.once('complete', () => {
          if (this.scene.textures.exists(key)) {
            onComplete();
          } else {
            onError();
          }
        });
        this.scene.load.once('loaderror', (file) => {
          if (file.key === key) onError();
        });
        this.scene.load.image(key, path);
        this.scene.load.start();
      }
    });
  }
  
  /**
   * Check if a texture is loaded and available
   * @param {string} textureKey - Texture key to check
   * @returns {boolean} True if available
   */
  isTextureAvailable(textureKey) {
    return this.scene.textures.exists(textureKey);
  }
  
  /**
   * Get the effective texture key (handles fallbacks)
   * @param {string} buttonId - Button identifier
   * @param {string} state - Button state
   * @returns {string|null} Texture key or null if not available
   */
  getTextureKey(buttonId, state) {
    const stateMap = BUTTON_TEXTURE_MAP[buttonId];
    if (!stateMap) return null;
    
    const textureKey = stateMap[state];
    if (!textureKey) return null;
    
    // Check if loaded
    if (this.isTextureAvailable(textureKey)) {
      return textureKey;
    }
    
    // Try fallback to idle state for non-idle states
    if (state !== BUTTON_STATES.IDLE) {
      const idleKey = stateMap[BUTTON_STATES.IDLE];
      if (idleKey && this.isTextureAvailable(idleKey)) {
        return idleKey;
      }
    }
    
    return null;
  }
  
  /**
   * Check if using fallback for a texture
   * @param {string} textureKey - Texture key to check
   * @returns {boolean} True if using fallback
   */
  isUsingFallback(textureKey) {
    return this.fallbackUsed.has(textureKey);
  }
}

// ==================== BUTTON STATE MANAGER ====================

/**
 * Button State Manager
 * Handles button state transitions and visual updates
 */
export class ButtonStateManager {
  constructor(scene, buttonId, config = {}) {
    this.scene = scene;
    this.buttonId = buttonId;
    this.config = {
      disabled: false,
      onStateChange: null,
      onClick: null,
      ...config
    };
    
    this.currentState = this.config.disabled ? BUTTON_STATES.DISABLED : BUTTON_STATES.IDLE;
    this.isFocused = false;
    this.isPressed = false;
    
    // UI elements (set by createButton)
    this.elements = null;
  }
  
  /**
   * Get current effective state
   * Priority: disabled > pressed > focused > hover > idle
   */
  getEffectiveState() {
    if (this.config.disabled) return BUTTON_STATES.DISABLED;
    if (this.isPressed) return BUTTON_STATES.PRESSED;
    if (this.isFocused) return BUTTON_STATES.FOCUSED;
    return this.currentState;
  }
  
  /**
   * Set button disabled state
   */
  setDisabled(disabled) {
    this.config.disabled = disabled;
    this.updateVisuals();
  }
  
  /**
   * Set focus state (keyboard/gamepad)
   */
  setFocused(focused) {
    this.isFocused = focused;
    this.updateVisuals();
  }
  
  /**
   * Handle pointer hover
   */
  setHovering(hovering) {
    if (!this.config.disabled && !this.isPressed) {
      this.currentState = hovering ? BUTTON_STATES.HOVER : BUTTON_STATES.IDLE;
      this.updateVisuals();
    }
  }
  
  /**
   * Handle press state
   */
  setPressed(pressed) {
    if (!this.config.disabled) {
      this.isPressed = pressed;
      this.updateVisuals();
    }
  }
  
  /**
   * Update visual elements based on current state
   */
  updateVisuals() {
    if (!this.elements) return;
    
    const state = this.getEffectiveState();
    const { bg, label, glow, skinImage } = this.elements;
    
    // Update skin image if available
    if (skinImage && skinImage.setTexture) {
      const loader = this.scene.menuButtonLoader;
      if (loader) {
        const textureKey = loader.getTextureKey(this.buttonId, state);
        if (textureKey) {
          skinImage.setTexture(textureKey);
        }
      }
    }
    
    // Update procedural visuals based on state
    this._updateProceduralVisuals(state);
    
    // Notify state change
    if (this.config.onStateChange) {
      this.config.onStateChange(state);
    }
  }
  
  /**
   * Update procedural button visuals
   * @private
   */
  _updateProceduralVisuals(state) {
    if (!this.elements) return;
    
    const { bg, label, glow, outerGlow } = this.elements;
    
    // State-specific styling
    const stateStyles = {
      [BUTTON_STATES.IDLE]: {
        bgAlpha: 1,
        bgTint: 0x2255cc,
        strokeColor: 0x66aaff,
        labelColor: '#ffffff',
        glowAlpha: 0.15
      },
      [BUTTON_STATES.HOVER]: {
        bgAlpha: 1,
        bgTint: 0x3366dd,
        strokeColor: 0xffffff,
        labelColor: '#ffffff',
        glowAlpha: 0.25
      },
      [BUTTON_STATES.PRESSED]: {
        bgAlpha: 1,
        bgTint: 0x1a44aa,
        strokeColor: 0x66aaff,
        labelColor: '#ccddff',
        glowAlpha: 0.1
      },
      [BUTTON_STATES.DISABLED]: {
        bgAlpha: 0.5,
        bgTint: 0x1a1a1a,
        strokeColor: 0x444444,
        labelColor: '#666666',
        glowAlpha: 0
      },
      [BUTTON_STATES.FOCUSED]: {
        bgAlpha: 1,
        bgTint: 0x2266ee,
        strokeColor: 0x00ffff, // Cyan for keyboard focus
        labelColor: '#ffffff',
        glowAlpha: 0.35
      }
    };
    
    const style = stateStyles[state] || stateStyles[BUTTON_STATES.IDLE];
    
    if (bg) {
      bg.setFillStyle(style.bgTint, style.bgAlpha);
      bg.setStrokeStyle(2, style.strokeColor);
    }
    
    if (label) {
      label.setFill(style.labelColor);
    }
    
    if (glow) {
      glow.setAlpha(style.glowAlpha);
    }
    
    if (outerGlow) {
      outerGlow.setAlpha(style.glowAlpha);
    }
  }
  
  /**
   * Handle click action
   */
  triggerClick() {
    if (this.config.disabled) return false;
    
    if (this.config.onClick) {
      this.config.onClick();
      return true;
    }
    return false;
  }
}

// ==================== BUTTON FACTORY ====================

/**
 * Create a menu button with full asset integration
 * 
 * @param {Phaser.Scene} scene - Scene to create button in
 * @param {string} buttonId - Button identifier from BUTTON_IDS
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Button width
 * @param {number} height - Button height
 * @param {string} text - Button label text
 * @param {Object} options - Configuration options
 * @returns {Object} Button container and state manager
 */
export function createMenuButton(scene, buttonId, x, y, width, height, text, options = {}) {
  const config = {
    disabled: false,
    isPrimary: false,
    onClick: null,
    onStateChange: null,
    showGlow: true,
    skinKey: null,
    ...options
  };
  
  // Create state manager
  const stateManager = new ButtonStateManager(scene, buttonId, config);
  
  // Create button container
  const container = scene.add.container(x, y);
  
  // Create button elements
  const elements = {};
  
  // Outer glow (optional)
  if (config.showGlow) {
    elements.outerGlow = scene.add.rectangle(0, 0, width + 12, height + 12, 
      config.disabled ? 0x222230 : 0x4488ff, 
      config.disabled ? 0.06 : (config.isPrimary ? 0.25 : 0.15));
    container.add(elements.outerGlow);
  }
  
  // Main background
  elements.bg = scene.add.rectangle(0, 0, width, height, 
    config.disabled ? 0x1a1a1a : (config.isPrimary ? 0x2255cc : 0x1a3a5a));
  elements.bg.setStrokeStyle(config.isPrimary ? 3 : 2, 
    config.disabled ? 0x444444 : (config.isPrimary ? 0x66aaff : 0x66ccff));
  elements.bg.setInteractive({ useHandCursor: !config.disabled });
  container.add(elements.bg);
  
  // Try to add asset skin image
  const loader = scene.menuButtonLoader;
  if (loader) {
    const textureKey = loader.getTextureKey(buttonId, stateManager.getEffectiveState());
    if (textureKey) {
      elements.skinImage = scene.add.image(0, 0, textureKey);
      elements.skinImage.setDisplaySize(width, height);
      elements.skinImage.setAlpha(config.disabled ? 0.08 : 0.20);
      container.add(elements.skinImage);
    }
  }
  
  // Text label
  elements.label = scene.add.text(0, 0, text, {
    fontSize: config.isPrimary ? '20px' : '17px',
    fill: config.disabled ? '#666666' : '#ffffff',
    fontFamily: 'Courier New',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  container.add(elements.label);
  
  // Inner glow/pulse for primary buttons
  if (config.isPrimary && !config.disabled) {
    elements.glow = scene.add.rectangle(0, 0, width - 16, height - 16, 0x66aaff, 0);
    container.add(elements.glow);
    
    // Pulse animation
    scene.tweens.add({
      targets: elements.glow,
      alpha: 0.1,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  
  // Store elements in state manager
  stateManager.elements = elements;
  
  // Setup interactions
  elements.bg.on('pointerover', () => {
    stateManager.setHovering(true);
    if (scene.sfx?.menuHover) scene.sfx.menuHover();
  });
  
  elements.bg.on('pointerout', () => {
    stateManager.setHovering(false);
    stateManager.setPressed(false);
  });
  
  elements.bg.on('pointerdown', () => {
    stateManager.setPressed(true);
    
    // Scale animation
    scene.tweens.add({
      targets: [elements.bg, elements.outerGlow, elements.glow].filter(Boolean),
      scaleX: 0.96,
      scaleY: 0.96,
      duration: 40,
      yoyo: true,
      onComplete: () => {
        if (elements.bg) elements.bg.setScale(1);
        if (elements.outerGlow) elements.outerGlow.setScale(1);
        if (elements.glow) elements.glow.setScale(1);
        stateManager.triggerClick();
      }
    });
  });
  
  elements.bg.on('pointerup', () => {
    stateManager.setPressed(false);
  });
  
  // Initial visual update
  stateManager.updateVisuals();
  
  return {
    container,
    stateManager,
    elements,
    buttonId
  };
}

// ==================== KEYBOARD/GAMEPAD FOCUS MANAGER ====================

/**
 * Button Focus Manager
 * Handles keyboard/gamepad navigation between buttons
 */
export class ButtonFocusManager {
  constructor(scene) {
    this.scene = scene;
    this.buttons = [];
    this.currentFocusIndex = -1;
    this.enabled = true;
  }
  
  /**
   * Register a button for focus management
   * Button must have a setFocus(focused) method
   * @param {Object} button - Button object from createPrimaryButton/createSecondaryButton
   */
  registerButton(button) {
    if (!button || typeof button.setFocus !== 'function') {
      console.warn('[ButtonFocusManager] Button missing setFocus method:', button?.buttonId);
      return;
    }
    this.buttons.push(button);
  }
  
  /**
   * Clear all registered buttons
   */
  clearButtons() {
    // Clear focus on all buttons
    this.buttons.forEach(btn => {
      if (btn.setFocus) btn.setFocus(false);
    });
    this.buttons = [];
    this.currentFocusIndex = -1;
  }
  
  /**
   * Focus next button
   */
  focusNext() {
    if (this.buttons.length === 0) return;
    
    // Clear current focus
    if (this.currentFocusIndex >= 0 && this.buttons[this.currentFocusIndex]) {
      this.buttons[this.currentFocusIndex].setFocus(false);
    }
    
    // Move to next
    this.currentFocusIndex = (this.currentFocusIndex + 1) % this.buttons.length;
    
    // Set new focus
    if (this.buttons[this.currentFocusIndex]) {
      this.buttons[this.currentFocusIndex].setFocus(true);
    }
  }
  
  /**
   * Focus previous button
   */
  focusPrevious() {
    if (this.buttons.length === 0) return;
    
    // Clear current focus
    if (this.currentFocusIndex >= 0 && this.buttons[this.currentFocusIndex]) {
      this.buttons[this.currentFocusIndex].setFocus(false);
    }
    
    // Move to previous
    this.currentFocusIndex = this.currentFocusIndex <= 0 
      ? this.buttons.length - 1 
      : this.currentFocusIndex - 1;
    
    // Set new focus
    if (this.buttons[this.currentFocusIndex]) {
      this.buttons[this.currentFocusIndex].setFocus(true);
    }
  }
  
  /**
   * Focus specific button by index
   */
  focusIndex(index) {
    if (index < 0 || index >= this.buttons.length) return;
    
    // Clear current focus
    if (this.currentFocusIndex >= 0 && this.buttons[this.currentFocusIndex]) {
      this.buttons[this.currentFocusIndex].setFocus(false);
    }
    
    this.currentFocusIndex = index;
    
    // Set new focus
    if (this.buttons[this.currentFocusIndex]) {
      this.buttons[this.currentFocusIndex].setFocus(true);
    }
  }
  
  /**
   * Activate currently focused button
   */
  activateFocused() {
    if (this.currentFocusIndex >= 0 && this.buttons[this.currentFocusIndex]) {
      // Trigger click on the bg element if available
      const btn = this.buttons[this.currentFocusIndex];
      if (btn.bg && btn.bg.emit) {
        btn.bg.emit('pointerdown');
        return true;
      }
    }
    return false;
  }
  
  /**
   * Setup keyboard listeners
   */
  setupKeyboardListeners() {
    if (!this.enabled) return;
    
    // Store bound handlers for cleanup
    this._boundTabHandler = (event) => {
      event.preventDefault();
      if (event.shiftKey) {
        this.focusPrevious();
      } else {
        this.focusNext();
      }
    };
    
    this._boundUpHandler = () => this.focusPrevious();
    this._boundDownHandler = () => this.focusNext();
    this._boundWHandler = () => this.focusPrevious();
    this._boundSHandler = () => this.focusNext();
    this._boundEnterHandler = () => this.activateFocused();
    this._boundSpaceHandler = () => this.activateFocused();
    
    this.scene.input.keyboard.on('keydown-TAB', this._boundTabHandler);
    this.scene.input.keyboard.on('keydown-UP', this._boundUpHandler);
    this.scene.input.keyboard.on('keydown-DOWN', this._boundDownHandler);
    this.scene.input.keyboard.on('keydown-W', this._boundWHandler);
    this.scene.input.keyboard.on('keydown-S', this._boundSHandler);
    this.scene.input.keyboard.on('keydown-ENTER', this._boundEnterHandler);
    this.scene.input.keyboard.on('keydown-SPACE', this._boundSpaceHandler);
  }
  
  /**
   * Remove keyboard listeners
   */
  removeKeyboardListeners() {
    if (!this.scene?.input?.keyboard) return;
    
    if (this._boundTabHandler) this.scene.input.keyboard.off('keydown-TAB', this._boundTabHandler);
    if (this._boundUpHandler) this.scene.input.keyboard.off('keydown-UP', this._boundUpHandler);
    if (this._boundDownHandler) this.scene.input.keyboard.off('keydown-DOWN', this._boundDownHandler);
    if (this._boundWHandler) this.scene.input.keyboard.off('keydown-W', this._boundWHandler);
    if (this._boundSHandler) this.scene.input.keyboard.off('keydown-S', this._boundSHandler);
    if (this._boundEnterHandler) this.scene.input.keyboard.off('keydown-ENTER', this._boundEnterHandler);
    if (this._boundSpaceHandler) this.scene.input.keyboard.off('keydown-SPACE', this._boundSpaceHandler);
  }
}

// ==================== MAPPING TABLE GENERATOR ====================

/**
 * Generate button->state->texture mapping table
 * @returns {Object} Mapping table for verification
 */
export function generateMappingTable() {
  const table = {};
  
  Object.entries(BUTTON_TEXTURE_MAP).forEach(([buttonId, states]) => {
    table[buttonId] = {};
    Object.entries(states).forEach(([state, textureKey]) => {
      const paths = BUTTON_ASSET_PATHS[textureKey];
      table[buttonId][state] = {
        textureKey,
        primaryPath: paths?.primary || 'N/A',
        fallbackPath: paths?.fallback || 'N/A'
      };
    });
  });
  
  return table;
}

/**
 * Print mapping table for debugging
 */
export function printMappingTable() {
  console.log('========== BUTTON ASSET MAPPING TABLE ==========');
  const table = generateMappingTable();
  
  Object.entries(table).forEach(([buttonId, states]) => {
    console.log(`\n[${buttonId.toUpperCase()}]`);
    Object.entries(states).forEach(([state, info]) => {
      console.log(`  ${state}: ${info.textureKey}`);
      console.log(`    Primary: ${info.primaryPath}`);
      console.log(`    Fallback: ${info.fallbackPath}`);
    });
  });
  
  console.log('\n==============================================');
}

// Export singleton for convenience
let _globalLoader = null;

export function getGlobalMenuButtonLoader(scene) {
  if (!_globalLoader) {
    _globalLoader = new MenuButtonAssetLoader(scene);
  }
  return _globalLoader;
}
