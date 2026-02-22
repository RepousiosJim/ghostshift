# GhostShift

A stealth evasion game built with Phaser 3 and Tauri.

## Game Flow (Phase 3 Complete)

The game now features a complete menu system and scene architecture with polish:

### Scene Flow
```
BootScene → MainMenuScene → LevelSelectScene → GameScene
                 ↓                              ↑
            SettingsScene              ResultsScene
```

### Scenes
- **BootScene**: Loading screen, transitions to MainMenuScene
- **MainMenuScene**: Full menu with Play, Level Select, Continue, Settings, Controls, Credits - with animated background
- **LevelSelectScene**: Level selection with lock/unlock status and best times
- **GameScene**: Core gameplay (existing mechanics preserved)
- **SettingsScene**: Audio toggle, volume slider, effects quality, fullscreen, reduced motion, reset progress
- **ResultsScene**: Mission complete/failed display with animations, particles, and Retry, Next Level, Level Select, and Menu buttons

### Main Menu Features
- **Play**: Goes to Level Select
- **Level Select**: Choose from unlocked levels (progressive unlock)
- **Continue**: Enabled when save data exists, loads last played level
- **Settings**: Full settings panel with audio, volume, quality, fullscreen, reduced motion options
- **Controls**: Overlay panel with key bindings
- **Credits**: Overlay panel with game info

### Phase 3 Polish Features
- **Scene transitions**: Smooth fade transitions between all scenes
- **Animated menu background**: Floating particles and animated grid
- **Button enhancements**: Press animations, enhanced hover states with glow
- **Sound effects**: Detection pulse, restart sounds, click feedback
- **Result screen animations**: Title pop-in, stats slide-in, particles for win/lose
- **Detection feedback**: Red pulse overlay, screen shake, player glow effect

## Visual Polish (Phase 1-3 Complete)

The game features enhanced visuals including:
- **Atmospheric depth** - Multi-layer backgrounds with subtle grid patterns and scanline textures
- **Entity glow effects** - Player, guard, and objectives have pulsing glows
- **Enhanced FOV cones** - Guard vision cones with gradient and pulse animations
- **Movement trails** - Player leaves subtle cyan trail when moving
- **Dynamic lighting** - Exit zone glows when unlocked, vignette corners for atmosphere
- **Improved silhouettes** - Clear, high-contrast entity visuals for stealth gameplay

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
