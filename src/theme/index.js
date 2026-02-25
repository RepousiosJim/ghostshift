/**
 * GhostShift Theme Module
 * 
 * Central export point for all theme-related utilities.
 * 
 * @module GhostShiftTheme
 */

export { 
  GHOSTSHIFT_THEME, 
  THEME_VERSION,
  getColor, 
  getTextColor, 
  getButtonSpec,
  getDuration,
  getFontSize,
  getStrokeWidth,
  getGlowAlpha,
  getButtonStateStyle
} from './tokens.js';

// Re-export the default
export { default } from './tokens.js';
