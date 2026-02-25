/**
 * GhostShift Asset Manifest
 * 
 * Centralized registry of all game assets with:
 * - Grouped categories (ui, backgrounds, game, audio)
 * - Required/optional classification
 * - Fallback support for optional assets
 * - Version/cache-busting strategy
 * 
 * @module AssetManifest
 */

// DETERMINISTIC VERSION: Timestamp-based for cache-busting
// Format: vMAJOR.MINOR.PATCH-TIMESTAMP (updates on each build)
export const ASSET_VERSION = 'v0.8.2-20250225T2320UTC';

/**
 * Asset categories for loading organization
 */
export const ASSET_CATEGORIES = {
  CORE: 'core',           // Required for boot - blocks everything
  UI: 'ui',               // Menu buttons and UI elements
  BACKGROUNDS: 'backgrounds', // Scene backgrounds
  GAME: 'game',           // Game-specific assets (player, enemies, items)
  AUDIO: 'audio'          // Sound effects (optional with fallbacks)
};

/**
 * Asset priority levels (lower = higher priority)
 */
export const ASSET_PRIORITY = {
  CRITICAL: 0,    // Must load before any scene
  HIGH: 1,        // Must load before main menu
  NORMAL: 2,      // Must load before gameplay
  LOW: 3          // Optional, can load in background
};

/**
 * Asset Manifest Definition
 * Each asset has:
 * - key: Phaser texture key
 * - path: File path
 * - type: 'image' | 'svg' | 'audio' | 'spritesheet'
 * - category: Asset category for grouping
 * - required: If true, failure blocks game; if false, uses fallback
 * - fallback: Fallback strategy or null
 * - priority: Loading priority
 * - version: Cache-busting version
 */
export const ASSET_MANIFEST = {
  // ==================== CORE ASSETS ====================
  // Required for boot - these MUST load or game cannot start
  core: [
    {
      key: 'favicon',
      path: 'favicon-32x32.png',
      type: 'image',
      category: ASSET_CATEGORIES.CORE,
      required: true,
      fallback: null,
      priority: ASSET_PRIORITY.CRITICAL,
      version: ASSET_VERSION
    }
  ],

  // ==================== UI ASSETS ====================
  // PLAY button uses asset-only rendering (menu_btn_play.png)
  // Other buttons use primary/secondary state textures
  ui: [
    {
      key: 'menu_btn_play',
      path: 'assets/ui/buttons_v2/menu_btn_play.png',
      type: 'image',
      category: ASSET_CATEGORIES.UI,
      required: true, // PLAY button must load
      fallback: null,
      priority: ASSET_PRIORITY.HIGH,
      version: ASSET_VERSION
    },
    // Primary button state textures (CONTINUE uses these)
    {
      key: 'btn-continue-idle',
      path: 'assets/ui/buttons/primary-default.png',
      type: 'image',
      category: ASSET_CATEGORIES.UI,
      required: false,
      fallback: null,
      priority: ASSET_PRIORITY.NORMAL,
      version: ASSET_VERSION
    },
    {
      key: 'btn-continue-hover',
      path: 'assets/ui/buttons/primary-hover.png',
      type: 'image',
      category: ASSET_CATEGORIES.UI,
      required: false,
      fallback: null,
      priority: ASSET_PRIORITY.NORMAL,
      version: ASSET_VERSION
    },
    {
      key: 'btn-continue-pressed',
      path: 'assets/ui/buttons/primary-pressed.png',
      type: 'image',
      category: ASSET_CATEGORIES.UI,
      required: false,
      fallback: null,
      priority: ASSET_PRIORITY.NORMAL,
      version: ASSET_VERSION
    },
    {
      key: 'btn-continue-disabled',
      path: 'assets/ui/buttons/primary-disabled.png',
      type: 'image',
      category: ASSET_CATEGORIES.UI,
      required: false,
      fallback: null,
      priority: ASSET_PRIORITY.NORMAL,
      version: ASSET_VERSION
    },
    {
      key: 'btn-continue-focused',
      path: 'assets/ui/buttons/primary-selected.png',
      type: 'image',
      category: ASSET_CATEGORIES.UI,
      required: false,
      fallback: null,
      priority: ASSET_PRIORITY.NORMAL,
      version: ASSET_VERSION
    },
    // Secondary button state textures (HOW_TO_PLAY, CONTROLS, SETTINGS, CREDITS use these)
    {
      key: 'btn-secondary-idle',
      path: 'assets/ui/buttons/secondary-default.png',
      type: 'image',
      category: ASSET_CATEGORIES.UI,
      required: false,
      fallback: null,
      priority: ASSET_PRIORITY.LOW,
      version: ASSET_VERSION
    },
    {
      key: 'btn-secondary-hover',
      path: 'assets/ui/buttons/secondary-hover.png',
      type: 'image',
      category: ASSET_CATEGORIES.UI,
      required: false,
      fallback: null,
      priority: ASSET_PRIORITY.LOW,
      version: ASSET_VERSION
    },
    {
      key: 'btn-secondary-pressed',
      path: 'assets/ui/buttons/secondary-pressed.png',
      type: 'image',
      category: ASSET_CATEGORIES.UI,
      required: false,
      fallback: null,
      priority: ASSET_PRIORITY.LOW,
      version: ASSET_VERSION
    },
    {
      key: 'btn-secondary-disabled',
      path: 'assets/ui/buttons/secondary-disabled.png',
      type: 'image',
      category: ASSET_CATEGORIES.UI,
      required: false,
      fallback: null,
      priority: ASSET_PRIORITY.LOW,
      version: ASSET_VERSION
    },
    {
      key: 'btn-secondary-focused',
      path: 'assets/ui/buttons/secondary-selected.png',
      type: 'image',
      category: ASSET_CATEGORIES.UI,
      required: false,
      fallback: null,
      priority: ASSET_PRIORITY.LOW,
      version: ASSET_VERSION
    }
  ],

  // ==================== BACKGROUND ASSETS ====================
  // Scene backgrounds (SVG) - keys match BACKGROUND_IMAGE_PATHS from background-composer.js
  backgrounds: [
    {
      key: 'assets/backgrounds/main-menu.svg',
      path: 'assets/backgrounds/main-menu.svg',
      type: 'svg',
      category: ASSET_CATEGORIES.BACKGROUNDS,
      required: false,
      fallback: 'procedural',
      priority: ASSET_PRIORITY.HIGH,
      version: ASSET_VERSION
    },
    {
      key: 'assets/backgrounds/level-select.svg',
      path: 'assets/backgrounds/level-select.svg',
      type: 'svg',
      category: ASSET_CATEGORIES.BACKGROUNDS,
      required: false,
      fallback: 'procedural',
      priority: ASSET_PRIORITY.HIGH,
      version: ASSET_VERSION
    },
    {
      key: 'assets/backgrounds/settings.svg',
      path: 'assets/backgrounds/settings.svg',
      type: 'svg',
      category: ASSET_CATEGORIES.BACKGROUNDS,
      required: false,
      fallback: 'procedural',
      priority: ASSET_PRIORITY.HIGH,
      version: ASSET_VERSION
    },
    {
      key: 'assets/backgrounds/controls.svg',
      path: 'assets/backgrounds/controls.svg',
      type: 'svg',
      category: ASSET_CATEGORIES.BACKGROUNDS,
      required: false,
      fallback: 'procedural',
      priority: ASSET_PRIORITY.HIGH,
      version: ASSET_VERSION
    },
    {
      key: 'assets/backgrounds/results.svg',
      path: 'assets/backgrounds/results.svg',
      type: 'svg',
      category: ASSET_CATEGORIES.BACKGROUNDS,
      required: false,
      fallback: 'procedural',
      priority: ASSET_PRIORITY.HIGH,
      version: ASSET_VERSION
    },
    {
      key: 'assets/backgrounds/victory.svg',
      path: 'assets/backgrounds/victory.svg',
      type: 'svg',
      category: ASSET_CATEGORIES.BACKGROUNDS,
      required: false,
      fallback: 'procedural',
      priority: ASSET_PRIORITY.HIGH,
      version: ASSET_VERSION
    }
  ],

  // ==================== GAME ASSETS ====================
  // In-game sprites and elements
  game: [
    // Future game assets will be added here
    // Currently using procedural rendering
  ],

  // ==================== AUDIO ASSETS ====================
  // Sound effects (optional, WebAudio synthesis fallback)
  audio: [
    // Currently using procedural WebAudio synthesis
    // Future audio files will be added here
  ]
};

/**
 * Get all assets in a specific category
 * @param {string} category - Asset category
 * @returns {Array} Array of asset definitions
 */
export function getAssetsByCategory(category) {
  return ASSET_MANIFEST[category] || [];
}

/**
 * Get all required assets across all categories
 * @returns {Array} Array of required asset definitions
 */
export function getRequiredAssets() {
  return Object.values(ASSET_MANIFEST)
    .flat()
    .filter(asset => asset.required);
}

/**
 * Get all assets sorted by priority
 * @returns {Array} Array of asset definitions sorted by priority
 */
export function getAssetsByPriority() {
  return Object.values(ASSET_MANIFEST)
    .flat()
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Get total asset count
 * @returns {number} Total number of assets
 */
export function getTotalAssetCount() {
  return Object.values(ASSET_MANIFEST)
    .reduce((sum, arr) => sum + arr.length, 0);
}

/**
 * Get asset by key
 * @param {string} key - Asset key
 * @returns {Object|null} Asset definition or null
 */
export function getAssetByKey(key) {
  for (const category of Object.values(ASSET_MANIFEST)) {
    const asset = category.find(a => a.key === key);
    if (asset) return asset;
  }
  return null;
}

/**
 * Check if an asset has a procedural fallback
 * @param {Object} asset - Asset definition
 * @returns {boolean} True if procedural fallback is available
 */
export function hasProceduralFallback(asset) {
  return asset && asset.fallback === 'procedural';
}

/**
 * Validate manifest integrity
 * @returns {Object} Validation result { valid, errors, warnings }
 */
export function validateManifest() {
  const errors = [];
  const warnings = [];
  const seenKeys = new Set();

  for (const [category, assets] of Object.entries(ASSET_MANIFEST)) {
    if (!Array.isArray(assets)) {
      errors.push(`Category ${category} is not an array`);
      continue;
    }

    for (const asset of assets) {
      // Check required fields
      if (!asset.key) {
        errors.push(`Asset in ${category} missing key`);
        continue;
      }

      // Check for duplicate keys
      if (seenKeys.has(asset.key)) {
        errors.push(`Duplicate asset key: ${asset.key}`);
      }
      seenKeys.add(asset.key);

      // Check path
      if (!asset.path) {
        errors.push(`Asset ${asset.key} missing path`);
      }

      // Check type
      const validTypes = ['image', 'svg', 'audio', 'spritesheet'];
      if (!validTypes.includes(asset.type)) {
        errors.push(`Asset ${asset.key} has invalid type: ${asset.type}`);
      }

      // Check required assets have no fallback
      if (asset.required && asset.fallback) {
        warnings.push(`Required asset ${asset.key} has fallback defined (will be ignored)`);
      }

      // Check priority
      if (typeof asset.priority !== 'number') {
        warnings.push(`Asset ${asset.key} missing priority, defaulting to NORMAL`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Run validation on module load
const validation = validateManifest();
if (!validation.valid) {
  console.error('[AssetManifest] Validation errors:', validation.errors);
}
if (validation.warnings.length > 0) {
  console.warn('[AssetManifest] Validation warnings:', validation.warnings);
}
