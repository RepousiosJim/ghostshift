/**
 * GhostShift Theme Tokens
 * 
 * Auto-generated from docs/ghostshift-theme.md
 * Version: 1.0.0
 * 
 * This is the authoritative source for all theme values in code.
 * Do not hardcode colors/sizes - always reference from here.
 * 
 * @module GhostShiftTheme
 */

export const THEME_VERSION = '1.0.0';

export const GHOSTSHIFT_THEME = {
  version: THEME_VERSION,
  
  // ==================== COLOR PALETTE ====================
  colors: {
    // Primary Action Colors
    primary: 0x2255cc,
    primaryLight: 0x3366dd,
    primaryDark: 0x1a44aa,
    primaryGlow: 0x66aaff,
    
    // Accent Colors
    accentCyan: 0x00d4ff,
    accentGreen: 0x22ff66,
    accentGold: 0xffaa00,
    accentRed: 0xff3344,
    
    // Semantic Colors
    danger: 0xff0044,
    warning: 0xff6655,
    success: 0x22ff66,
    disabled: 0x333340,
    
    // Background Colors
    bgDeep: 0x0d0d15,
    bgBase: 0x1a1a25,
    bgSurface: 0x2d2d3d,
    bgElevated: 0x3d3d52,
    
    // Utility Button Colors
    utilityBg: 0x1a3a5a,
    utilityBgHover: 0x2a4a6a,
    utilityBgPressed: 0x0a2a4a,
    utilityStroke: 0x66ccff,
    utilityGlow: 0x4488ff,
    
    // Stroke Colors by State
    strokeIdle: 0x66aaff,
    strokeHover: 0xffffff,
    strokePressed: 0x66aaff,
    strokeDisabled: 0x444444,
    strokeFocused: 0x00ffff,
    
    // Utility Secondary Strokes
    utilityStrokeIdle: 0x66ccff,
    utilityStrokeDisabled: 0x333340
  },
  
  // ==================== STRING COLORS (for Text) ====================
  textColors: {
    primary: '#ffffff',
    secondary: '#d0d8e0',
    muted: '#aabbcc',
    disabled: '#666677',
    hint: '#555566',
    glow: '#66aaff'
  },
  
  // ==================== TYPOGRAPHY ====================
  typography: {
    fontFamily: "'Courier New', monospace",
    fontFamilyFallback: "'Consolas', 'Monaco', monospace",
    
    sizes: {
      xs: '11px',
      sm: '12px',
      md: '14px',
      lg: '17px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '28px',
      '4xl': '36px'
    },
    
    weights: {
      normal: '400',
      bold: '700'
    },
    
    lineHeights: {
      tight: 1.2,
      normal: 1.5
    }
  },
  
  // ==================== CORNER RADIUS ====================
  radius: {
    none: 0,
    sm: 4,
    md: 6,      // Default button radius
    lg: 8,
    xl: 12,
    full: 9999
  },
  
  // ==================== STROKE WIDTHS ====================
  strokes: {
    thin: 1,      // Secondary buttons
    medium: 2,    // Standard elements
    thick: 3,     // Primary buttons
    focus: 4      // Keyboard/gamepad focus
  },
  
  // ==================== BUTTON SPECS ====================
  buttons: {
    primary: {
      width: 300,
      height: 52,
      radius: 6,
      strokeWidth: 3,
      glowSize: 12,
      glowAlpha: {
        idle: 0.15,
        hover: 0.25,
        pressed: 0.10,
        disabled: 0.06,
        focused: 0.35
      },
      fontSize: '20px'
    },
    
    secondary: {
      width: 240,     // Tight width
      height: 44,     // Tight height
      radius: 6,
      strokeWidth: 1,
      glowSize: 6,
      glowAlpha: {
        idle: 0.08,
        hover: 0.15,
        pressed: 0.06,
        disabled: 0.04,
        focused: 0.20
      },
      fontSize: '14px'
    }
  },
  
  // ==================== ANIMATION ====================
  animation: {
    hoverScale: 1.02,
    pressedScale: 0.96,
    
    durations: {
      fast: 40,        // Press feedback
      normal: 80,      // Hover transitions
      slow: 150,       // Return to idle
      entrance: 350,   // Staggered entrance
      stagger: 60,     // Delay between button entrances
      pulse: 1500      // Glow pulse cycle
    },
    
    easings: {
      quick: 'Quad.easeOut',
      smooth: 'Sine.easeInOut'
    }
  },
  
  // ==================== GLOW RULES ====================
  glow: {
    player: {
      color: 0x00ffff,
      alpha: 0.40,
      size: 8
    },
    objective: {
      color: 0xffaa00,
      alpha: { min: 0.3, max: 0.6 },
      size: 6
    },
    guardAlert: {
      color: 0xff6655,
      alpha: 0.40,
      size: 10
    }
  },
  
  // ==================== ENTITY COLORS ====================
  entities: {
    player: {
      body: 0x00d4ff,
      stroke: 0x00ffff,
      glow: 0x00ffff
    },
    guard: {
      body: 0xff3344,
      stroke: 0xcc2233,
      alert: 0xff6655
    },
    ghost: {
      body: 0x44ffaa,
      alpha: 0.5
    },
    drone: {
      body: 0xaa4488,
      stroke: 0x883366,
      glow: 0xcc66aa
    }
  },
  
  // ==================== OBJECTIVE MARKERS ====================
  objectives: {
    dataCore: {
      color: 0xffaa00,
      glow: 0xffaa00,
      size: 24
    },
    keyCard: {
      color: 0x0088ff,
      glow: 0x0088ff,
      size: 20
    },
    terminal: {
      color: 0x00ff88,
      glow: 0x00ff88,
      size: 22
    },
    exit: {
      color: 0x22ff66,
      glow: 0x22ff66,
      size: 28
    }
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get color as Phaser-compatible number (0xRRGGBB)
 * @param {string} colorName - Color key from theme
 * @returns {number} Phaser color value
 */
export function getColor(colorName) {
  return GHOSTSHIFT_THEME.colors[colorName] || 0xffffff;
}

/**
 * Get text color as CSS string
 * @param {string} colorName - Text color key
 * @returns {string} CSS color string
 */
export function getTextColor(colorName) {
  return GHOSTSHIFT_THEME.textColors[colorName] || '#ffffff';
}

/**
 * Get button spec by family
 * @param {string} family - 'primary' or 'secondary'
 * @returns {Object} Button specification
 */
export function getButtonSpec(family) {
  return GHOSTSHIFT_THEME.buttons[family] || GHOSTSHIFT_THEME.buttons.secondary;
}

/**
 * Get animation duration
 * @param {string} name - Duration key
 * @returns {number} Duration in ms
 */
export function getDuration(name) {
  return GHOSTSHIFT_THEME.animation.durations[name] || 80;
}

/**
 * Get font size
 * @param {string} size - Size key (xs, sm, md, lg, xl, etc.)
 * @returns {string} CSS font size
 */
export function getFontSize(size) {
  return GHOSTSHIFT_THEME.typography.sizes[size] || '16px';
}

/**
 * Get stroke width
 * @param {string} weight - Weight key (thin, medium, thick, focus)
 * @returns {number} Stroke width in px
 */
export function getStrokeWidth(weight) {
  return GHOSTSHIFT_THEME.strokes[weight] || 2;
}

/**
 * Get corner radius
 * @param {string} size - Size key (none, sm, md, lg, xl)
 * @returns {number} Radius in px
 */
export function getRadius(size) {
  return GHOSTSHIFT_THEME.radius[size] || 6;
}

/**
 * Get glow alpha for button state
 * @param {string} family - 'primary' or 'secondary'
 * @param {string} state - 'idle', 'hover', 'pressed', 'disabled', 'focused'
 * @returns {number} Alpha value
 */
export function getGlowAlpha(family, state) {
  const spec = GHOSTSHIFT_THEME.buttons[family];
  return spec?.glowAlpha[state] ?? 0.15;
}

// ==================== BUTTON STATE STYLES ====================

/**
 * Get complete style object for a button state
 * @param {string} family - 'primary' or 'secondary'
 * @param {string} state - 'idle', 'hover', 'pressed', 'disabled', 'focused'
 * @returns {Object} Style configuration
 */
export function getButtonStateStyle(family, state) {
  const spec = getButtonSpec(family);
  const colors = GHOSTSHIFT_THEME.colors;
  const textColors = GHOSTSHIFT_THEME.textColors;
  
  const isPrimary = family === 'primary';
  
  const stateStyles = {
    idle: {
      bgTint: isPrimary ? colors.primary : colors.utilityBg,
      bgAlpha: 1,
      strokeColor: isPrimary ? colors.strokeIdle : colors.utilityStrokeIdle,
      strokeWidth: spec.strokeWidth,
      glowAlpha: spec.glowAlpha.idle,
      textColor: textColors.primary,
      textAlpha: 1
    },
    hover: {
      bgTint: isPrimary ? colors.primaryLight : colors.utilityBgHover,
      bgAlpha: 1,
      strokeColor: colors.strokeHover,
      strokeWidth: spec.strokeWidth + 1,
      glowAlpha: spec.glowAlpha.hover,
      textColor: textColors.primary,
      textAlpha: 1
    },
    pressed: {
      bgTint: isPrimary ? colors.primaryDark : colors.utilityBgPressed,
      bgAlpha: 1,
      strokeColor: isPrimary ? colors.strokePressed : colors.utilityStrokeIdle,
      strokeWidth: spec.strokeWidth,
      glowAlpha: spec.glowAlpha.pressed,
      textColor: isPrimary ? '#ccddff' : textColors.secondary,
      textAlpha: 1
    },
    disabled: {
      bgTint: colors.disabled,
      bgAlpha: 0.5,
      strokeColor: isPrimary ? colors.strokeDisabled : colors.utilityStrokeDisabled,
      strokeWidth: spec.strokeWidth,
      glowAlpha: spec.glowAlpha.disabled,
      textColor: textColors.disabled,
      textAlpha: 1
    },
    focused: {
      bgTint: isPrimary ? 0x2266ee : 0x1a4a6a,
      bgAlpha: 1,
      strokeColor: colors.strokeFocused,
      strokeWidth: GHOSTSHIFT_THEME.strokes.focus,
      glowAlpha: spec.glowAlpha.focused,
      textColor: textColors.primary,
      textAlpha: 1
    }
  };
  
  return stateStyles[state] || stateStyles.idle;
}

// Export default
export default GHOSTSHIFT_THEME;
