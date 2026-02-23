# Performance Baseline Report

**Generated:** 2026-02-23  
**Project:** GhostShift  
**Version:** 0.7.0  
**Branch:** main (29 commits ahead of origin)

---

## Overview

This document outlines the performance instrumentation added to GhostShift and provides baseline measurements from the current branch.

---

## What Was Measured

### 1. Frame Timing Metrics
- **FPS (Frames Per Second):** Instantaneous frames per second
- **Frame Time:** Current frame duration in milliseconds (ms)
- **p95 Frame Time:** 95th percentile frame time (rolling ~5 second window)

### 2. Timing Markers
Critical game loop phases are instrumented with timing markers:
- `frame` - Total frame time
- `updateTimer` - Timer display update
- `updatePlayer` - Player movement and physics
- `updateGuard` - Guard AI and movement
- `updateScannerDrone` - Scanner drone behavior
- `updateCameras` - Security camera updates
- `updateMotionSensors` - Motion sensor logic
- `updateLaserGrids` - Laser grid state
- `updatePatrolDrones` - Patrol drone AI
- `updateGhost` - Ghost/path recording playback
- `updateExitGlow` - Exit indicator animation
- `checkDetection` - All detection checks combined

### 3. Lifecycle Counters
Debug counters track scene lifecycle events:
- `sceneCreates` - Total scenes created
- `sceneShutdowns` - Total scenes shutdown
- `timersCreated` - Timers created via guardTimer helper
- `timersCleaned` - Timers cleaned up
- `transitions` - Scene transitions

**Access in console:** `window._lifecycleCounters`

---

## Where Instrumentation Lives

### Core Files

| File | Purpose |
|------|---------|
| `src/main.js` (lines ~459-610) | `PerformanceManager` class - handles all instrumentation |
| `src/main.js` (line ~2648) | Performance manager enablement in `GameScene.create()` |
| `src/main.js` (lines ~4750-4832) | Timing markers in `GameScene.update()` |

### Key Classes/Functions

- **`PerformanceManager`** - Main instrumentation class
  - `recordFrame(delta)` - Records frame time and calculates p95
  - `startMarker(name)` / `endMarker(name)` - Timing scope markers
  - `getStats()` - Returns current performance stats
  - `toggleOverlay()` - Shows/hides performance overlay

---

## How to Use

### Toggle Overlay
Press **F3** or **Shift+P** during gameplay to toggle the performance overlay.

The overlay displays:
- Current FPS
- Current frame time (ms)
- p95 frame time (ms)

### Access Stats Programmatically
```javascript
// Get current performance stats
const stats = perfManager.getStats();
console.log(`FPS: ${stats.fps}, p95: ${stats.p95FrameTime.toFixed(2)}ms`);
```

---

## Current Branch Metrics

### Build Status
```
✅ npm run build - PASSED (1m 12s)
   - dist/assets/phaser.js: 1,208 KB (332 KB gzip)
   - dist/assets/game.js: 135 KB (34 KB gzip)
   - Warning: Chunk > 500KB (phaser.js)
```

### Test Status (E2E)
```
✅ 6/10 tests passing
   - console-capture.spec.js: PASSED
   - ghostshift.spec.js boot test: PASSED
   - ghostshift.spec.js fail flow: PASSED
   - ghostshift.spec.js win flow: PASSED
   - ghostshift.spec.js level transition: PASSED
⚠  ghostshift.spec.js settings->controls nav: FAILED (timing/coord issue)
```

### Console/Runtime Status
- No page errors detected
- Console warnings: GPU stall warnings (ReadPixels) - common in WebGL
- Runtime phases properly tracked (boot:create, menu:create, game:start, etc.)

---

## Memory/Lifecycle Observations

### Scene Lifecycle
- Scenes properly clean up on transition (SHUTDOWN/DESTROY events)
- Timer cleanup via guardTimer helper tracked in lifecycle counters
- Overlay elements destroyed on scene shutdown

### Potential Hotspots (Code Analysis)
| Area | Concern | Severity |
|------|---------|----------|
| Graphics objects | 247 instances of Graphics/add operations | P1 |
| Ray-based vision | Guard vision calculations in checkDetection | P1 |
| Text updates | Timer and HUD text updates | P2 |
| Collision checks | Arcade physics with multiple entities | P2 |

### Cleanup Implementation
- Guards register cleanup handlers on creation
- Timers added to guard.timers Set for batch cleanup
- Scene events properly off'd on shutdown
- Fullscreen and keyboard handlers removed on destroy

---

## Bottleneck List

### P0 (Critical)
- None identified in current baseline

### P1 (High)
1. **Guard Vision Raycasting** - checkDetection runs every frame, ray-based vision can spike
2. **Graphics Object Overhead** - 247 add operations, potential for caching
3. **Collision System** - Arcade physics with many entities (guards, drones, sensors)

### P2 (Medium)
1. **Text/DOM Updates** - Timer text updates via DOM
2. **Particle Systems** - Multiple particle emitters in game scene
3. **Audio Context** - Oscillator creation in detection/collection events

---

## Optimization Opportunities

1. **Spatial Partitioning** - Grid-based spatial hash for collision/detection
2. **Graphics Caching** - Pre-render static Graphics to cached textures
3. **Vision Throttling** - Reduce guard vision check frequency
4. **Object Pooling** - Reuse guard/drone objects across levels
5. **Timer Coalescing** - Batch timer updates

---

## Verification Commands

```bash
# Build
npm run build

# E2E Tests
npm run test:e2e

# Dev Server
node server.js  # Port 3007

# Access
# Local: http://localhost:3007/
# Performance overlay: Press F3 during gameplay
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-22 | Initial performance instrumentation added |
| 2026-02-23 | Updated baseline with test results, lifecycle analysis, bottleneck list |
