# GhostShift UI Button Style Guide

This document defines the complete style system for GhostShift UI buttons generated via OpenAI image models.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color Palette](#color-palette)
3. [Material System](#material-system)
4. [Corner Radius & Dimensions](#corner-radius--dimensions)
5. [State Behaviors](#state-behaviors)
6. [Readability Rules](#readability-rules)
7. [Asset Specifications](#asset-specifications)
8. [Integration Guidelines](#integration-guidelines)

---

## Design Philosophy

GhostShift buttons follow a **pixel-game aesthetic** with modern refinements:

- **Flat, minimal design** with subtle depth cues
- **Crisp edges** for pixel-art authenticity
- **Transparent backgrounds** for versatile layering
- **Consistent proportions** across all variants

---

## Color Palette

### Primary Buttons (Play/CTA)

| State | Gradient Start | Gradient End | Glow Color |
|-------|---------------|--------------|------------|
| Default | `#2244aa` | `#4466cc` | Cyan `#00ddff` |
| Hover | `#3355bb` | `#5577dd` | White border |
| Pressed | `#1122aa` | `#2244cc` | None (inset) |
| Selected | `#226622` | `#338833` | Green `#22ff44` |
| Disabled | `#333340` | `#444455` | None |

### Secondary Buttons (Menu/Info)

| State | Gradient Start | Gradient End | Stroke Color |
|-------|---------------|--------------|--------------|
| Default | `#2a3a4a` | `#3a4a5a` | `#666688` |
| Hover | `#3a4a5a` | `#4a5a6a` | White `#ffffff` |
| Pressed | `#1a2a3a` | `#2a3a4a` | None |
| Selected | `#2a4a5a` | `#3a5a6a` | Cyan `#66ccff` |
| Disabled | `#1a1a22` | `#2a2a33` | None |

### Neutral Buttons (Back/Cancel)

| State | Gradient Start | Gradient End | Stroke Color |
|-------|---------------|--------------|--------------|
| Default | `#1a1a2a` | `#2a2a3a` | `#444466` |
| Hover | `#2a2a3a` | `#3a3a4a` | White `#ffffff` |
| Pressed | `#0a0a1a` | `#1a1a2a` | None |
| Disabled | `#0a0a10` | `#151520` | None |

### Locked Buttons

| State | Gradient Start | Gradient End | Icon Color |
|-------|---------------|--------------|------------|
| Default | `#151520` | `#252535` | `#444455` |
| Hover | `#202030` | `#303040` | `#444455` |

### Text Colors

| Context | Color |
|---------|-------|
| Default Text | `#ffffff` (White) |
| Disabled Text | `#666677` |
| Selected Indicator | `#22ff44` (Green checkmark) |

---

## Material System

### Surface Materials

1. **Gradient Flat** - Linear gradient from top-left to bottom-right
   - Primary: Vibrant blues
   - Secondary: Muted blue-grays
   - Neutral: Dark slate
   - Locked: Near-black with lock icon

2. **Glow Effects**
   - Outer glow: 4px blur radius, 50% opacity of accent color
   - Text glow: Subtle 2px blur, white color
   - Only on default and hover states

3. **Bevel Effect**
   - Subtle 1px lighter edge on top/left
   - Subtle 1px darker edge on bottom/right
   - Primary buttons only
   - Removed on disabled state

4. **Inset Shadow (Pressed)**
   - Inner shadow: `inset 0 2px 4px rgba(0,0,0,0.3)`
   - Creates depth illusion on press

5. **Stroke/Border**
   - Default: Subtle matching-tone stroke
   - Hover: White highlight border (2px)
   - Disabled: No stroke

---

## Corner Radius & Dimensions

### Dimensions

| Variant | Width | Height | Use Case |
|---------|-------|--------|----------|
| Primary | 300px | 52px | Main CTAs (PLAY, START) |
| Secondary | 300px | 52px | Menu items (CONTINUE, OPTIONS) |
| Neutral | 300px | 52px | Actions (BACK, CANCEL) |
| Locked | 300px | 52px | Locked content |

### Corner Radius

- **All buttons**: 6px border-radius
- **Pixel alignment**: Round to nearest even number for crisp rendering
- **Consistency**: Same radius across all states

---

## State Behaviors

### Default State
- Full gradient background
- Subtle outer glow (primary only)
- Bevel effect (primary)
- Standard text

### Hover State
- Slightly brighter gradient (+10% lightness)
- White border highlight (2px)
- Increased glow intensity (primary)
- Text glow effect

### Pressed/Active State
- Darker gradient (-10% lightness)
- Inset shadow effect
- Text offset down 2px
- No outer glow
- No border highlight

### Selected State
- Green-tinted gradient
- Green glow
- Checkmark indicator (primary)
- Accent border (secondary)

### Disabled State
- Desaturated gray gradient
- No glow
- No bevel
- Grayed text (#666677)
- No hover effects

### Locked State
- Dark gradient with lock icon
- No glow ever
- Subtle hover highlight (no activation)
- Grayed text

---

## Readability Rules

### Text Sizing
- Font: Bold, sans-serif (game-style)
- Size: ~24px equivalent (scaled to 52px button height)
- Letter spacing: 2px

### Contrast Requirements
- Minimum 4.5:1 contrast ratio for default states
- Disabled text: Maximum 2.5:1 (intentionally de-emphasized)

### Padding
- Horizontal padding: 24px minimum
- Vertical padding: 8px (centered in 52px height)
- Text centered with ±1px tolerance

### Multi-Line Handling
- Not supported in current spec
- Buttons designed for single-line labels only

---

## Asset Specifications

### File Format
- **Format**: PNG with transparency
- **Color depth**: 32-bit (8-bit RGBA)
- **Background**: Fully transparent (alpha = 0)

### Naming Convention

```
{variant}-{state}.png
```

| Variant | States | Example |
|---------|--------|---------|
| primary | default, hover, pressed, selected, disabled | `primary-default.png` |
| secondary | default, hover, pressed, selected, disabled | `secondary-hover.png` |
| neutral | default, hover, pressed, disabled | `neutral-pressed.png` |
| locked | default, hover | `locked-default.png` |

### Output Directory
```
public/assets/ui/buttons/
```

### Generation Metadata
Each asset includes embedded metadata (via filename):
- Variant type
- State
- Creation date (optional)

---

## Integration Guidelines

### HTML/CSS Usage

```html
<!-- Primary Button -->
<button class="btn btn-primary" data-state="default">
  <img src="/assets/ui/buttons/primary-default.png" alt="Play" />
</button>

<!-- State Switching via CSS classes -->
<button class="btn btn-primary btn-hover" data-state="hover">
  <img src="/assets/ui/buttons/primary-hover.png" alt="Play" />
</button>
```

### Sprite Sheet Option
For performance, combine states into sprite sheets:
- Horizontal layout: states left-to-right
- Click target: Full button area
- CSS `background-position` for state switching

### Text Overlay Strategy

If generating blank buttons (no text):
1. Use SVG or Canvas for text rendering
2. Match font to prompt specifications
3. Ensure alignment matches generated assets

### Fallback Mode

If AI generation fails or API unavailable:
1. CSS-only buttons using gradients
2. SVG inline buttons
3. System button styling with game-themed CSS

### Accessibility

- Always include `alt` text
- Provide keyboard navigation
- Support `aria-disabled` for locked/disabled states
- Consider `aria-pressed` for toggle buttons

### Performance

- Preload critical button states
- Use WebP format for smaller file sizes
- Lazy load non-critical states
- Target: < 5KB per button asset

---

## Maintenance

### Version Control
- Track prompt versions in `prompts/buttons/`
- Document any palette changes
- Version style guide as `v1.0`, `v1.1`, etc.

### Regeneration Triggers
- Style guide updates
- New button variants
- Platform requirements (retina displays)
- API model updates

---

*Last updated: 2026-02-23*
*Version: 1.0*
