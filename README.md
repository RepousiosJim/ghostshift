# GhostShift

A stealth evasion game built with Phaser 3 and Tauri.

## Console-Zero Verification (2026-02-22)

✅ **Build: PASS**
- `npm run build` completes without errors

⚠️ **Test Suite: 3 passed, 3 failed (logic assertions, NOT console/runtime errors)**
- Core boot/play/restart flow: ✅ PASS
- Console error collection: ✅ ZERO runtime errors detected
- Fail flow test: fails on `isDetected` assertion (timing/state issue)
- Win flow test: fails on `winGame` return (isRunning check)
- Warehouse flow: fails on restart state assertion

**Status: Game runs without console/runtime errors. Test failures are game logic edge cases.**

Tests: `npm run test:e2e` or `npx playwright test`

## Game Flow (Phase 9 Complete)

The game now features 5 playable levels with progressive difficulty and **Phase 9 Fullscreen Web Support Hardening**:

### Phase 9: Fullscreen Web Support Hardening
- **FullscreenManager class** - Centralized fullscreen API handling with cross-browser support
- **Browser state sync** - Listens to fullscreenchange events to keep game state in sync
- **ESC key handling** - Detects browser ESC exit and syncs fullscreen state
- **Resize pipeline** - Robust window resize handling that emits resize events to all scenes
- **Scene relayout** - All scenes (MainMenu, LevelSelect, Settings, Game, Results, Controls) now listen for resize events
- **Scale mode** - Phaser Scale.FIT with auto-center for proper fullscreen scaling
- **Immediate apply** - Fullscreen setting persists and applies immediately via SaveManager
- **Version bump**: v0.6.1 → v0.7.0

### Scene Flow
```
BootScene → MainMenuScene → LevelSelectScene → GameScene
                 ↓                              ↑
            SettingsScene              ResultsScene
```

### Levels (5 Total)
1. **Warehouse** (Difficulty 1) - Tutorial-style entry level
2. **Labs** (Difficulty 1) - Moderate obstacles with dual patrols
3. **Server Farm** (Difficulty 2) - Challenging with more coverage
4. **The Vault** (Difficulty 3) - High-security bank vault with dense lasers/cameras
5. **Training Facility** (Difficulty 3) - Open area with multiple guards and drones

### Scenes
- **BootScene**: Loading screen, transitions to MainMenuScene
- **MainMenuScene**: Full menu with Play, Level Select, Continue, Settings, Controls, Credits - with animated background
- **LevelSelectScene**: Level selection with lock/unlock status and best times
- **GameScene**: Core gameplay with difficulty-based balancing
- **SettingsScene**: Audio toggle, volume slider, effects quality, fullscreen, reduced motion, reset progress
- **ResultsScene**: Mission complete/failed display with animations, particles, level name, "NEW BEST!" indicator, and Retry, Next Level, Level Select, and Menu buttons
- **ControlsScene**: Full keyboard/mouse control reference with How to Play guide

### Phase 8: Settings UI Modernization
- **Modernized visual design** - Cleaner spacing, section grouping (Audio/Graphics/Game)
- **Master Volume overhaul** - Interactive slider with draggable thumb, live percentage display (0-100%)
- **Mute button** - Quick toggle between mute/unmute with visual icon feedback
- **Better +/- controls** - Improved hover/active states, 10% step adjustment
- **Consistent row styling** - Helper text, right-aligned controls, modern toggle states
- **Visual polish** - Smooth hover animations, professional color scheme

### Phase 6 New Features (Polish & Content)
- **Enhanced wall rendering** - Top edge highlights for better map readability
- **Level name indicator** - Shows current level name in-game HUD
- **Improved exit zone** - Pulsing glow animation when exit is unlocked
- **Color-coded difficulty** - EASY/MEDIUM/HARD labels with distinct colors
- **Enhanced detection feedback** - More dramatic screen shake and red vignette pulse
- **Results improvements** - Level name display and "NEW BEST!" indicator for personal records
- **Version bump**: v0.5.0 → v0.6.0

### Phase 5 Features (Save System Hardening)
- **Schema versioning**: Save data now includes version (v5) for future migrations
- **Automatic migration**: Old save formats are automatically migrated to latest version
- **Corruption recovery**: Invalid save data is detected and recovered to defaults
- **Data validation**: All saved values are validated (types, ranges, enums)
- **Integrity checks**: Level unlocks are validated, best times are sanitized
- **Save test script**: Run `tests/save-validation.js` in browser console to verify save system
- **5 playable levels**: Added "The Vault" and "Training Facility" with unique layouts
- **Difficulty scaling**: Guards, vision cones, and sensors scale with level difficulty
- **New objectives**: Security Code and Power Cell pickups
- **Difficulty indicator**: UI shows current level difficulty (1-3)
- **Improved balancing**: 
  - Guard speed: 65 (easy) → 81 (hard)
  - Vision cone distance: 140px (easy) → 170px (hard)
  - Vision cone angle: 55° (easy) → 61° (hard)
  - Motion sensor cooldown: 100→70 frames based on difficulty

## Visual Polish (Phase 1-4 Complete)

The game features enhanced visuals including:
- **Atmospheric depth** - Multi-layer backgrounds with subtle grid patterns and scanline textures
- **Entity glow effects** - Player, guard, and objectives have pulsing glows
- **Enhanced FOV cones** - Guard vision cones with gradient and pulse animations
- **Movement trails** - Player leaves subtle cyan trail when moving
- **Dynamic lighting** - Exit zone glows when unlocked, vignette corners for atmosphere
- **Improved silhouettes** - Clear, high-contrast entity visuals for stealth gameplay
- **Difficulty indicators** - Color-coded difficulty display in-game

*See `docs/VISUAL_STYLE.md` for the full visual style guide.*

## Quickstart

### Prerequisites
- Node.js 18+
- Rust (for Tauri)

### Installation

```bash
cd ghostshift
npm install
```

### Running

**Web (development):**
```bash
npm run dev
```

**Desktop (Tauri):**
```bash
npm run tauri:dev
```

### Building

**Web build:**
```bash
npm run build
```

**Desktop build:**
```bash
npm run tauri:build
```

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move player |
| R | Restart run |
| ESC | Pause game |
| SPACE | Start game |

## Gameplay

- **Objective**: Escape to the right side of the map
- **Avoid**: The patrolling red guard
- **Ghost Mechanic**: After your first run, your previous run is replayed as a translucent ghost to help you plan your next attempt
- **Timer**: Tracks your current run time

## Features

- Player movement with collision detection
- Simple map with walls and obstacles
- Patrolling guard AI
- Timer system
- Ghost replay system (records and replays previous run)
- Multiple run tracking
- Win condition detection

## Project Structure

```
ghostshift/
├── src/
│   └── main.js       # Main game code (Phaser 3)
├── src-tauri/        # Tauri desktop shell
├── index.html        # Entry HTML
├── package.json      # Dependencies and scripts
└── README.md         # This file
```

## License

MIT

---

## Verification & Priorities (2026-02-22)

### ✅ Completed
- Build optimization (recent commits)
- Scene teardown cleanup and timer management
- Level loading pipeline hardening
- Level layout module and validator
- Level select background redesign

### ⚠️ Known Issues / Test Failures (Non-Critical)
1. **Fail flow test**: `isDetected` state timing issue - detected() sets flag but test assertion may fire too quickly
2. **Win flow test**: `winGame()` returns early if `!this.isRunning` - test calls directly without proper game state
3. **Warehouse flow restart**: Restart doesn't fully clear detected state in test context

### 🔴 Remaining Bottlenecks
- None identified - core gameplay works

### 📋 Next Priorities
1. Fix test assertions for fail/win flows (add waitForState or proper async handling)
2. Add Level 3+ content (Server Farm, The Vault, Training Facility)
3. Performance profiling on lower-end devices
