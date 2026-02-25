# GhostShift Theme Bible v1.0

**Single Source of Truth for all GhostShift visual styling.**

Last Updated: 2025-02-25
Version: 1.0.0

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color Palette Tokens](#color-palette-tokens)
3. [Typography Scale](#typography-scale)
4. [Corner Radius & Stroke Rules](#corner-radius--stroke-rules)
5. [Glow & Shadow Rules](#glow--shadow-rules)
6. [Button Style System](#button-style-system)
7. [Icon & Objective Marker Rules](#icon--objective-marker-rules)
8. [Enemy Visual Language](#enemy-visual-language)
9. [Implementation Token Map](#implementation-token-map)

---

## Design Philosophy

GhostShift follows a **cyberpunk terminal aesthetic** with pixel-game roots:

- **Clarity First** - Stealth gameplay requires clear visual hierarchy
- **Neon on Dark** - High-contrast accent colors on deep backgrounds
- **Consistent Tokens** - All colors/spacing derived from this document
- **Performance-Conscious** - Effects use native Canvas/Phaser, no heavy shaders

---

## Color Palette Tokens

### Primary Colors (Actions/CTAs)

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--color-primary` | `#2255cc` | 34, 85, 204 | Primary button backgrounds |
| `--color-primary-light` | `#3366dd` | 51, 102, 221 | Hover states |
| `--color-primary-dark` | `#1a44aa` | 26, 68, 170 | Pressed states |
| `--color-primary-glow` | `#66aaff` | 102, 170, 255 | Strokes, glows |

### Accent Colors (Highlights/Alerts)

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--color-accent-cyan` | `#00d4ff` | 0, 212, 255 | Player, active states |
| `--color-accent-green` | `#22ff66` | 34, 255, 102 | Success, objectives complete |
| `--color-accent-gold` | `#ffaa00` | 255, 170, 0 | Objectives, collectibles |
| `--color-accent-red` | `#ff3344` | 255, 51, 68 | Danger, enemies |

### Semantic Colors

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--color-danger` | `#ff0044` | 255, 0, 68 | Detection, critical alerts |
| `--color-warning` | `#ff6655` | 255, 102, 85 | Warning states |
| `--color-success` | `#22ff66` | 34, 255, 102 | Success confirmation |
| `--color-disabled` | `#333340` | 51, 51, 64 | Disabled elements |

### Background Colors

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--color-bg-deep` | `#0d0d15` | 13, 13, 21 | Deepest background |
| `--color-bg-base` | `#1a1a25` | 26, 26, 37 | Base layer |
| `--color-bg-surface` | `#2d2d3d` | 45, 45, 61 | Elevated surfaces |
| `--color-bg-elevated` | `#3d3d52` | 61, 61, 82 | Highest elevation |

### Text Colors

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--color-text-primary` | `#ffffff` | 255, 255, 255 | Primary text |
| `--color-text-secondary` | `#d0d8e0` | 208, 216, 224 | Secondary text |
| `--color-text-muted` | `#aabbcc` | 170, 187, 204 | Muted/HUD text |
| `--color-text-disabled` | `#666677` | 102, 102, 119 | Disabled text |

### Utility Button Colors

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--color-utility-bg` | `#1a3a5a` | 26, 58, 90 | Secondary button background |
| `--color-utility-bg-hover` | `#2a4a6a` | 42, 74, 106 | Secondary button hover |
| `--color-utility-stroke` | `#66ccff` | 102, 204, 255 | Secondary button stroke |
| `--color-utility-glow` | `#4488ff` | 68, 136, 255 | Secondary button glow |

---

## Typography Scale

### Font Family

```css
--font-family-primary: 'Courier New', monospace;
--font-family-fallback: 'Consolas', 'Monaco', monospace;
```

### Font Sizes

| Token | Size | Usage |
|-------|------|-------|
| `--font-size-xs` | 11px | Captions, hints |
| `--font-size-sm` | 12px | Objectives, status |
| `--font-size-md` | 14px | Secondary buttons |
| `--font-size-lg` | 17px | Body text, menu items |
| `--font-size-xl` | 20px | Primary buttons |
| `--font-size-2xl` | 24px | Subheadings |
| `--font-size-3xl` | 28px | Headings |
| `--font-size-4xl` | 36px | Large titles |

### Font Weights

| Token | Weight | Usage |
|-------|--------|-------|
| `--font-weight-normal` | 400 | Body text |
| `--font-weight-bold` | 700 | Buttons, headings |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--line-height-tight` | 1.2 | Headings |
| `--line-height-normal` | 1.5 | Body text |

---

## Corner Radius & Stroke Rules

### Corner Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-none` | 0px | Sharp corners (rare) |
| `--radius-sm` | 4px | Small elements, chips |
| `--radius-md` | 6px | Buttons, inputs |
| `--radius-lg` | 8px | Cards, panels |
| `--radius-xl` | 12px | Large containers |
| `--radius-full` | 9999px | Circular elements |

**Button Radius**: All menu buttons use `--radius-md` (6px).

### Stroke Widths

| Token | Value | Usage |
|-------|-------|-------|
| `--stroke-thin` | 1px | Secondary buttons, subtle borders |
| `--stroke-medium` | 2px | Standard buttons |
| `--stroke-thick` | 3px | Primary/action buttons |
| `--stroke-focus` | 4px | Focus state (keyboard/gamepad) |

### Stroke Colors by State

| State | Primary Stroke | Secondary Stroke |
|-------|---------------|------------------|
| Idle | `--color-primary-glow` (#66aaff) | `--color-utility-stroke` (#66ccff) |
| Hover | `#ffffff` | `#ffffff` |
| Pressed | `--color-primary-glow` (#66aaff) | `--color-utility-stroke` (#66ccff) |
| Disabled | `#444444` | `#333340` |
| Focused | `#00ffff` (cyan) | `#00ffff` (cyan) |

---

## Glow & Shadow Rules

### Outer Glow

| Element | Color | Alpha | Size |
|---------|-------|-------|------|
| Primary button (idle) | `--color-primary-glow` | 0.15-0.25 | +12px |
| Primary button (hover) | `--color-primary-glow` | 0.30-0.35 | +12px |
| Secondary button (idle) | `--color-utility-glow` | 0.08-0.15 | +6px |
| Secondary button (hover) | `--color-utility-glow` | 0.20-0.25 | +6px |
| Player | `--color-accent-cyan` | 0.40 | +8px |
| Objective marker | `--color-accent-gold` | 0.50 | +6px |
| Guard alert | `--color-danger` | 0.60 | +10px |

### Pulse Animation

```javascript
// Glow pulse for primary buttons
{
  targets: glowElement,
  alpha: { from: 0.10, to: 0.25 },
  duration: 1500,
  yoyo: true,
  repeat: -1,
  ease: 'Sine.easeInOut'
}
```

### Shadows

| Element | Shadow |
|---------|--------|
| Text shadow | `1px 1px 2px rgba(0,0,0,0.3)` |
| Button pressed | Inset effect (darker, no glow) |
| Panel elevated | `0 4px 12px rgba(0,0,0,0.4)` |

---

## Button Style System

### Button Families

#### Primary Buttons (PLAY, CONTINUE)
- **Background**: `--color-primary` (#2255cc)
- **Stroke**: `--stroke-thick` (3px), `--color-primary-glow`
- **Outer Glow**: +12px, alpha 0.15-0.25
- **Font Size**: `--font-size-xl` (20px)
- **Width**: 300px
- **Height**: 52px

#### Secondary Buttons (HOW TO PLAY, CONTROLS, SETTINGS, CREDITS)
- **Background**: `--color-utility-bg` (#1a3a5a)
- **Stroke**: `--stroke-thin` (1px), `--color-utility-stroke`
- **Outer Glow**: +6px, alpha 0.08-0.15
- **Font Size**: `--font-size-md` (14px)
- **Width**: 240px (tight)
- **Height**: 44px (tight)

### State Transitions

| From State | To State | Transition |
|------------|----------|------------|
| Idle → Hover | Scale 1.02, glow +0.10 alpha | 80ms ease-out |
| Hover → Idle | Scale 1.0, glow -0.10 alpha | 150ms ease-out |
| Any → Pressed | Scale 0.96, darker bg | 40ms |
| Any → Disabled | Alpha 0.5, gray tones | Instant |
| Any → Focused | Cyan stroke 4px, glow +0.10 | Instant |

### Button Asset Mapping

| Button ID | Family | Asset Pattern |
|-----------|--------|---------------|
| `play` | Primary | `menu_btn_play.png` (dedicated asset) |
| `continue` | Primary | `btn-continue-{state}` (texture mapping) |
| `how_to_play` | Secondary | `btn-how-to-play-{state}` |
| `controls` | Secondary | `btn-controls-{state}` |
| `settings` | Secondary | `btn-settings-{state}` |
| `credits` | Secondary | `btn-credits-{state}` |

---

## Icon & Objective Marker Rules

### Objective Markers

| Type | Icon | Color | Glow |
|------|------|-------|------|
| Data Core | Square | `--color-accent-gold` (#ffaa00) | Gold pulse |
| Key Card | Rectangle | `--color-accent-cyan` (#0088ff) | Cyan glow |
| Hack Terminal | Diamond | `--color-accent-green` (#00ff88) | Green pulse |
| Exit Zone | Rectangle | `--color-success` (#22ff66) | Green glow |

### Marker Glow Rules

```javascript
// Objective marker pulse
{
  targets: markerGlow,
  alpha: { from: 0.3, to: 0.6 },
  scale: { from: 1.0, to: 1.1 },
  duration: 1000,
  yoyo: true,
  repeat: -1
}
```

### Icon Sizing

| Element | Base Size | Scale Range |
|---------|-----------|-------------|
| Data Core | 24px | 0.9 - 1.1 (pulse) |
| Key Card | 20px | Static |
| Terminal | 22px | 0.95 - 1.05 (subtle pulse) |
| Exit | 28px | 1.0 - 1.15 (strong pulse) |

---

## Enemy Visual Language

### Guard Entity

| Property | Value |
|----------|-------|
| Body Color | `#ff3344` (red) |
| Stroke | `#cc2233` (darker red) |
| Size | (TILE_SIZE - 8) * 0.85 |
| Glow (patrol) | None |
| Glow (alert) | `#ff6655` alpha 0.4 |

### Guard FOV Cone

| Property | Value |
|----------|-------|
| Gradient Start | `#ff2200` (near guard) |
| Gradient End | `#ff000000` (far, transparent) |
| Pulse Animation | Alpha 0.3 → 0.5, 800ms |
| Alert Tint | Redder, higher opacity |

### Drone Entity (Future)

| Property | Value |
|----------|-------|
| Body Color | `#aa4488` (magenta) |
| Stroke | `#883366` |
| Movement | Hovering, slight vertical bob |
| Glow | `#cc66aa` alpha 0.3 |

### Detection States

| State | Visual Cue |
|-------|------------|
| Unaware | Normal colors, no glow |
| Suspicious | Yellow tint on FOV, pause |
| Alert | Red flash, FOV brightens |
| Pursuing | Red body glow, speed lines |

---

## Implementation Token Map

### JavaScript Module Export

```javascript
// src/theme/tokens.js

export const GHOSTSHIFT_THEME = {
  version: '1.0.0',
  
  colors: {
    // Primary
    primary: 0x2255cc,
    primaryLight: 0x3366dd,
    primaryDark: 0x1a44aa,
    primaryGlow: 0x66aaff,
    
    // Accent
    accentCyan: 0x00d4ff,
    accentGreen: 0x22ff66,
    accentGold: 0xffaa00,
    accentRed: 0xff3344,
    
    // Semantic
    danger: 0xff0044,
    warning: 0xff6655,
    success: 0x22ff66,
    disabled: 0x333340,
    
    // Background
    bgDeep: 0x0d0d15,
    bgBase: 0x1a1a25,
    bgSurface: 0x2d2d3d,
    bgElevated: 0x3d3d52,
    
    // Text
    textPrimary: '#ffffff',
    textSecondary: '#d0d8e0',
    textMuted: '#aabbcc',
    textDisabled: '#666677',
    
    // Utility Buttons
    utilityBg: 0x1a3a5a,
    utilityBgHover: 0x2a4a6a,
    utilityStroke: 0x66ccff,
    utilityGlow: 0x4488ff
  },
  
  typography: {
    fontFamily: "'Courier New', monospace",
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
    }
  },
  
  radius: {
    none: 0,
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12,
    full: 9999
  },
  
  strokes: {
    thin: 1,
    medium: 2,
    thick: 3,
    focus: 4
  },
  
  buttons: {
    primary: {
      width: 300,
      height: 52,
      radius: 6,
      strokeWidth: 3,
      glowSize: 12,
      glowAlpha: { idle: 0.15, hover: 0.25, focused: 0.35 }
    },
    secondary: {
      width: 240,
      height: 44,
      radius: 6,
      strokeWidth: 1,
      glowSize: 6,
      glowAlpha: { idle: 0.08, hover: 0.15, focused: 0.20 }
    }
  },
  
  animation: {
    hoverScale: 1.02,
    pressedScale: 0.96,
    durations: {
      fast: 40,
      normal: 80,
      slow: 150,
      entrance: 350
    }
  }
};
```

---

## Changelog

### v1.0.0 (2025-02-25)
- Initial theme bible creation
- Color palette tokens defined
- Typography scale established
- Button style system documented
- Enemy visual language rules
- Implementation token map for code usage

---

*This document is the single source of truth. All UI updates must reference these tokens.*
