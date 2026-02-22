# GhostShift

A stealth evasion game built with Phaser 3 and Tauri.

## Visual Polish (Phase 1-2 Complete)

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
| Arrow Keys / player |
| R | Restart run |

## Gameplay WASD | Move

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
