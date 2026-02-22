# Performance Baseline Report

**Generated:** 2026-02-22  
**Project:** GhostShift  
**Version:** 0.7.0

---

## Overview

This document outlines the performance instrumentation added to GhostShift and provides initial baseline measurements.

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

---

## Where Instrumentation Lives

### Core Files

| File | Purpose |
|------|---------|
| `src/main.js` (lines ~188-320) | `PerformanceManager` class - handles all instrumentation |
| `src/main.js` (line ~2648) | Performance manager enablement in `GameScene.create()` |
| `src/main.js` (lines ~3107-3165) | Timing markers in `GameScene.update()` |

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

## Initial Observations

### Expected Behavior
- Target: 60 FPS (16.67ms frame time)
- p95 should remain close to frame time under normal load
- Frame time spikes >20ms indicate potential bottlenecks

### Suspected Bottlenecks (Based on Architecture)

1. **Physics/Collision Checks** - Arcade physics in `updatePlayer` and `updateGuard` can be expensive with many entities
2. **Rendering** - Multiple Graphics objects (vision cones, laser grids, trails) may cause draw call overhead
3. **Detection Calculations** - Ray-based vision in `updateGuard` and `checkDetection` can spike on complex maps
4. **DOM/Text Updates** - Timer text updates, though throttled, still require DOM manipulation

### Optimization Opportunities
- Consider spatial partitioning for collision/detection checks
- Cache Graphics objects instead of recreating
- Batch text updates
- Consider WebGL renderer-specific optimizations

---

## Verification

### Build Status
- ✅ `npm run build` - PASSED
- ✅ Syntax check - PASSED
- ✅ No runtime errors introduced

### Console Output
When performance instrumentation is enabled, the following message appears:
```
Performance instrumentation enabled. Press F3 for overlay.
```

---

## Future Improvements

1. **Add memory tracking** - Monitor heap usage over time
2. **Scene-specific metrics** - Track performance per scene (Menu vs Game)
3. **Event-based sampling** - Reduce overhead by sampling less frequently
4. **Persistent stats** - Save baseline metrics for comparison across versions
5. **Alerting** - Notify when FPS drops below threshold

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-22 | Initial performance instrumentation added |
