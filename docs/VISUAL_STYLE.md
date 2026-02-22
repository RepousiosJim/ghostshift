# GhostShift Visual Style Guide

## Phase 1-2: Art Direction & Core Visual Upgrade

### Color Palette

| Element | Hex | Usage |
|---------|-----|-------|
| Background (deep) | `#0d0d15` | Main game floor, base layer |
| Background (grid) | `#1a1a25` | Subtle grid pattern overlay |
| Walls | `#2d2d3d` | Obstacles and border walls |
| Wall accent | `#3d3d52` | Wall highlights/bevels |
| Player | `#00d4ff` | Cyan - main character |
| Player glow | `#00ffff` | Player active glow |
| Guard | `#ff3344` | Red - enemy |
| Guard alert | `#ff6655` | Guard detection state |
| Guard FOV cone | `#ff2200` → `#ff0000` | Gradient (bright to dim) |
| Ghost | `#44ffaa` | Replay ghost (translucent) |
| Data Core | `#ffaa00` | Golden - objective |
| Key Card | `#0088ff` | Blue - pickup |
| Hack Terminal | `#00ff88` | Green - interactable |
| Exit zone | `#22ff66` | Open exit indicator |
| Alert/detected | `#ff0044` | Detection flash |
| UI text | `#aabbcc` | HUD elements |

### Typography

- **Primary font**: `'Courier New', monospace` - retro terminal aesthetic
- **Timer**: 20px, `#00ffaa` with subtle text-shadow glow
- **Objectives**: 12px, color-coded by state (pending/complete)
- **Status messages**: 11px, muted `#666666` → bright when active

### Visual Principles

1. **Clarity First** - Stealth gameplay requires clear entity silhouettes. Never obscure player position.
2. **Depth through Layering** - Subtle background texture, wall shadows, and ambient particles create space without distraction.
3. **Readable Alerts** - Detection states use high-contrast flashes and color shifts, never subtle animations alone.
4. **Cyberpunk Terminal Vibe** - Neon accents on dark backgrounds. Retro-futuristic but clean.

### Implemented Visual Upgrades

#### Background & Depth
- Multi-layer background: deep base (`#0d0d15`) + subtle grid pattern (`#1a1a25`)
- Wall shadows for depth perception
- Floor has faint scan-line texture effect

#### Entity Silhouettes
- **Player**: Cyan square with bright stroke, subtle pulsing glow
- **Guard**: Red square with darker stroke, more menacing
- **Ghost**: Translucent green with ghost trail effect
- All entities have clear contrast against background

#### Guard FOV Cone Enhancement
- Gradient fill (bright at source, fading toward edge)
- Subtle pulse animation (opacity oscillation)
- Redder tint for higher alertness feel

#### Lighting & Glow Effects
- Player leaves faint trail when moving
- Objectives have gentle pulsing glow
- Detection triggers screen flash
- Vignette effect for atmosphere

### Performance Constraints

- All effects use native Canvas/Phaser (no heavy shaders)
- Particle effects limited to <50 active at once
- Animations use Phaser tweens (GPU accelerated)
- Target: 60fps on mid-range hardware

### Phase 3 Recommendations

- Camera shake on detection
- More ambient particles (dust motes)
- Dynamic shadows for entities
- Screen scanline overlay (toggleable)
- Additional visual feedback for stealth mechanics (stealth meter visual)
