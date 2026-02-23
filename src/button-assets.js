/**
 * GhostShift Button Asset Loader
 * 
 * Provides button asset loading with fallback to procedural buttons.
 * Assets are loaded from public/assets/ui/buttons/ if available.
 * 
 * Usage:
 *   import { ButtonAssets } from './button-assets.js';
 *   
 *   // Check if assets are available
 *   if (ButtonAssets.isLoaded()) {
 *     // Use asset-based buttons
 *   } else {
 *     // Use procedural buttons (existing createMenuButton)
 *   }
 */

export const ButtonAssets = {
  assets: {},
  loaded: false,
  basePath: 'assets/ui/buttons/',
  
  /**
   * Load all button assets
   * @param {Phaser.Scene} scene - Phaser scene instance
   * @returns {Promise<boolean>} - True if assets loaded successfully
   */
  async load(scene) {
    if (this.loaded) return true;
    
    const variants = ['primary', 'secondary', 'neutral', 'locked'];
    const states = ['default', 'hover', 'pressed', 'selected', 'disabled'];
    
    // Preload all potential assets to check availability
    let availableCount = 0;
    let totalChecks = 0;
    
    for (const variant of variants) {
      this.assets[variant] = {};
      
      for (const state of states) {
        const key = `${variant}_${state}`;
        const path = `${this.basePath}${variant}-${state}.png`;
        totalChecks++;
        
        // Check if texture exists by attempting to load it
        try {
          await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              scene.textures.addBase64(key, scene.canvas.toDataURL());
              this.assets[variant][state] = key;
              availableCount++;
              resolve();
            };
            img.onerror = () => resolve(); // Silently fail, will use fallback
            img.src = path;
          });
        } catch (e) {
          // Asset not available, will use fallback
        }
      }
    }
    
    this.loaded = availableCount > 0;
    console.log(`[ButtonAssets] Loaded ${availableCount}/${totalChecks} assets`);
    return this.loaded;
  },
  
  /**
   * Check if assets are loaded and available
   * @returns {boolean}
   */
  isLoaded() {
    return this.loaded;
  },
  
  /**
   * Get asset key for variant/state
   * @param {string} variant - primary, secondary, neutral, locked
   * @param {string} state - default, hover, pressed, selected, disabled
   * @returns {string|null} - Texture key or null if not available
   */
  getKey(variant, state) {
    if (!this.loaded) return null;
    return this.assets[variant]?.[state] || null;
  },
  
  /**
   * Create an asset-based button
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} text - Button text
   * @param {string} variant - primary, secondary, neutral, locked
   * @param {Function} onClick - Click handler
   * @param {boolean} disabled - Disabled state
   * @returns {Phaser.GameObjects.Container}
   */
  createButton(scene, x, y, width, height, text, variant, onClick, disabled = false) {
    const state = disabled ? 'disabled' : 'default';
    const key = this.getKey(variant, state);
    
    if (key) {
      // Use asset-based button
      const container = scene.add.container(x, y);
      
      const bg = scene.add.image(0, 0, key);
      bg.setDisplaySize(width, height);
      container.add(bg);
      
      const label = scene.add.text(0, 0, text, {
        fontSize: '16px',
        fill: disabled ? '#666677' : '#ffffff',
        fontFamily: 'Courier New',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      container.add(label);
      
      // Add interactivity
      if (!disabled) {
        bg.setInteractive({ useHandCursor: true });
        
        // Hover effects
        bg.on('pointerover', () => {
          const hoverKey = this.getKey(variant, 'hover');
          if (hoverKey) {
            bg.setTexture(hoverKey);
          }
        });
        
        bg.on('pointerout', () => {
          const defaultKey = this.getKey(variant, 'default');
          if (defaultKey) {
            bg.setTexture(defaultKey);
          }
        });
        
        // Press effects
        bg.on('pointerdown', () => {
          const pressedKey = this.getKey(variant, 'pressed');
          if (pressedKey) {
            bg.setTexture(pressedKey);
          }
        });
        
        bg.on('pointerup', () => {
          const defaultKey = this.getKey(variant, 'default');
          if (defaultKey) {
            bg.setTexture(defaultKey);
          }
          onClick();
        });
      }
      
      return container;
    }
    
    // Fallback to procedural button (should not happen if this method is called after checking isLoaded)
    return null;
  },
  
  /**
   * Determine appropriate variant based on button colors
   * @param {number} bgColor - Background color (hex)
   * @param {number} strokeColor - Stroke color (hex)
   * @returns {string} - primary, secondary, neutral, or locked
   */
  inferVariant(bgColor, strokeColor) {
    // Primary: Blue tones (0x2244aa, 0x66aaff)
    if ((bgColor & 0xFFFF00) > 0x4400) {
      return 'primary';
    }
    
    // Locked: Dark with lock indicators
    if (bgColor < 0x202020) {
      return 'locked';
    }
    
    // Neutral: Very dark slate
    if (bgColor < 0x2a2a3a) {
      return 'neutral';
    }
    
    // Secondary: Everything else
    return 'secondary';
  }
};

/**
 * Hybrid button factory that uses assets when available, falls back to procedural
 */
export function createButtonWithFallback(scene, x, y, width, height, text, bgColor, strokeColor, onClick, disabled = false) {
  // Try to use asset-based button
  if (ButtonAssets.isLoaded()) {
    const variant = ButtonAssets.inferVariant(bgColor, strokeColor);
    const button = ButtonAssets.createButton(scene, x, y, width, height, text, variant, onClick, disabled);
    
    if (button) {
      return button;
    }
  }
  
  // Fallback to procedural buttons - delegate to scene's createMenuButton
  if (typeof scene.createMenuButton === 'function') {
    return scene.createMenuButton(x, y, width, height, text, bgColor, strokeColor, onClick, disabled);
  }
  
  // Ultimate fallback: create basic button
  console.warn('[ButtonAssets] No createMenuButton fallback available');
  return null;
}
