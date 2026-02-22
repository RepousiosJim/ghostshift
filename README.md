# GhostShift

A stealth evasion game built with Phaser 3 and Tauri.

## Game Flow (Phase 4 Complete)

The game now features 5 playable levels with progressive difficulty:

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
- **ResultsScene**: Mission complete/failed display with animations, particles, and Retry, Next Level, Level Select, and Menu buttons

### Phase 4 New Features
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
