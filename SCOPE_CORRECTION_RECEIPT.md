# Level 1 Horizontal Expansion Scope Correction Receipt

**Date**: 2026-02-24
**Task**: Enforce strict scope correction - ONLY Level 1 should be horizontally expanded
**Status**: ✅ COMPLETE

## Problem Statement

Previous horizontal expansion (commit d8c151c) updated global MAP_WIDTH-related constants, affecting ALL levels. This violated the requirement that only Level 1 (Warehouse) should be expanded.

## Changes Made

### 1. Reverted Global Constants to Baseline

**Files Changed:**
- `src/main.js`
- `src/tile/TileGrid.js`
- `scripts/map-validator.js`
- `src/levels.js`

**Reverted Values:**
- `MAP_WIDTH`: 28 → 22 (baseline)
- `MAP_HEIGHT`: 23 → 18 (baseline)

### 2. Implemented Per-Level Dimension Support

**Added to `DEFAULT_LEVEL` in `src/levels.js`:**
```javascript
{
  width: null,   // Per-level dimension support (null = use baseline)
  height: null,  // Per-level dimension support (null = use baseline)
  // ... other fields
}
```

**Level 1 (Warehouse) now specifies:**
```javascript
{
  name: 'Warehouse',
  width: 28,   // HORIZONTAL EXPANSION: 22 -> 28 (27.3% increase)
  height: 23,  // VERTICAL EXPANSION: 18 -> 23 (27.8% increase)
  // ... rest of level data
}
```

### 3. Updated Game Engine for Dynamic Dimensions

**Modified `src/main.js` (GameScene.create):**
- Added per-level dimension extraction from layout
- Dynamic physics world bounds: `this.physics.world.setBounds(0, 0, levelWidth * TILE_SIZE, levelHeight * TILE_SIZE)`
- Dynamic camera bounds: `this.cameras.main.setBounds(0, 0, levelWidth * TILE_SIZE, levelHeight * TILE_SIZE)`

**Modified `src/tile/TileGrid.js`:**
- Constructor uses `levelLayout.width` and `levelLayout.height` instead of global constants
- All methods updated to use `this.width` and `this.height`

**Modified `scripts/map-validator.js`:**
- All validation functions updated to use per-level dimensions
- Report now shows "Baseline dimensions: 22x18 (individual levels may differ)"

### 4. Updated Level 1 Border Generation

**Modified `src/levels.js` (Warehouse level):**
- Border walls now use hardcoded 28x23 dimensions instead of global MAP_WIDTH/MAP_HEIGHT
- Ensures Level 1's expanded layout is preserved

## Verification Results

### Map Validation Output:
```
════════════════════════════════════════════════════════════
AUDIT: Warehouse
════════════════════════════════════════════════════════════
Map dimensions: 28x23  ✓ EXPANDED
Nav grid: 369/644 walkable (57.3%)
Status: ✓ PASS

════════════════════════════════════════════════════════════
AUDIT: Labs
════════════════════════════════════════════════════════════
Map dimensions: 22x18  ✓ BASELINE (unchanged)
Nav grid: 313/396 walkable (79.0%)
Status: ✓ PASS

[... all other levels show 22x18 ...]
```

### Build & Test Results:
- ✅ Map validation: PASS (0 errors, 33 warnings)
- ✅ Production build: SUCCESS
- ✅ P0 verification: PASS (5/5 checks)

### Dimension Summary:
| Level | Dimensions | Status |
|-------|-----------|--------|
| 1. Warehouse | 28x23 | ✅ Expanded |
| 2. Labs | 22x18 | ✅ Baseline |
| 3. Server Farm | 22x18 | ✅ Baseline |
| 4. Comms Tower | 22x18 | ✅ Baseline |
| 5. The Vault | 22x18 | ✅ Baseline |
| 6. Training Facility | 22x18 | ✅ Baseline |
| 7. Penthouse | 22x18 | ✅ Baseline |

## Files Changed (with diffs)

### src/main.js
```diff
-const MAP_WIDTH = 28; // HORIZONTAL EXPANSION: 22 -> 28 (27.3% increase for Level 1)
-const MAP_HEIGHT = 23; // VERTICAL EXPANSION: 18 -> 23 (27.8% increase) - synced with levels.js
+const MAP_WIDTH = 22; // BASELINE: Default map width (Level 1 overrides to 28)
+const MAP_HEIGHT = 18; // BASELINE: Default map height (Level 1 overrides to 23)

+    // PER-LEVEL DIMENSION SUPPORT
+    // Get level dimensions (fallback to baseline if not specified)
+    const levelWidth = this.currentLayout.width || MAP_WIDTH;
+    const levelHeight = this.currentLayout.height || MAP_HEIGHT;
+    this.levelWidth = levelWidth;
+    this.levelHeight = levelHeight;
+
+    // Update physics world bounds to match level dimensions
+    this.physics.world.setBounds(0, 0, levelWidth * TILE_SIZE, levelHeight * TILE_SIZE);
+
+    // Update camera bounds to match level dimensions
+    this.cameras.main.setBounds(0, 0, levelWidth * TILE_SIZE, levelHeight * TILE_SIZE);
```

### src/tile/TileGrid.js
```diff
-export const MAP_WIDTH = 28;  // HORIZONTAL EXPANSION: 22 -> 28 (27.3% increase for Level 1)
-export const MAP_HEIGHT = 23; // VERTICAL EXPANSION: 18 -> 23 (27.8% increase) - synced with main.js
+export const MAP_WIDTH = 22;  // BASELINE: Default map width (Level 1 overrides to 28)
+export const MAP_HEIGHT = 18; // BASELINE: Default map height (Level 1 overrides to 23)

   constructor(levelLayout) {
     this.layout = levelLayout;
-    this.width = MAP_WIDTH;
-    this.height = MAP_HEIGHT;
+    // Use per-level dimensions if available, otherwise fall back to baseline
+    this.width = levelLayout.width || MAP_WIDTH;
+    this.height = levelLayout.height || MAP_HEIGHT;
```

### src/levels.js
```diff
 const DEFAULT_LEVEL = {
   name: 'Unnamed',
+  width: null,   // Per-level dimension support (null = use baseline)
+  height: null,  // Per-level dimension support (null = use baseline)
   obstacles: [],
   // ... other fields
 };

-const MAP_WIDTH = 28;  // HORIZONTAL EXPANSION: 22 -> 28 (27.3% increase for Level 1)
-const MAP_HEIGHT = 23;  // VERTICAL EXPANSION: 18 -> 23 (27.8% increase)
+const MAP_WIDTH = 22;  // BASELINE: Default map width
+const MAP_HEIGHT = 18;  // BASELINE: Default map height

   {
     name: 'Warehouse',
+    width: 28,   // HORIZONTAL EXPANSION: 22 -> 28 (27.3% increase)
+    height: 23,  // VERTICAL EXPANSION: 18 -> 23 (27.8% increase)
     obstacles: mergeObstacles(
-      Array.from({length: MAP_WIDTH}, (_, i) => ({x: i, y: 0})),
-      Array.from({length: MAP_WIDTH}, (_, i) => ({x: i, y: 22})),
-      Array.from({length: MAP_HEIGHT}, (_, i) => ({x: 0, y: i})),
-      Array.from({length: MAP_HEIGHT}, (_, i) => ({x: 27, y: i})),
+      Array.from({length: 28}, (_, i) => ({x: i, y: 0})),
+      Array.from({length: 28}, (_, i) => ({x: i, y: 22})),
+      Array.from({length: 23}, (_, i) => ({x: 0, y: i})),
+      Array.from({length: 23}, (_, i) => ({x: 27, y: i})),
```

### scripts/map-validator.js
```diff
-const MAP_WIDTH = 28;  // HORIZONTAL EXPANSION: 22 -> 28 (27.3% increase for Level 1)
-const MAP_HEIGHT = 23;  // VERTICAL EXPANSION: 18 -> 23 (27.8% increase)
+const MAP_WIDTH = 22;  // BASELINE: Default map width
+const MAP_HEIGHT = 18;  // BASELINE: Default map height

 export function buildNavGrid(level) {
-  const grid = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(true));
+  // Use per-level dimensions if available, otherwise fall back to baseline
+  const width = level.width || MAP_WIDTH;
+  const height = level.height || MAP_HEIGHT;
+  const grid = Array(height).fill(null).map(() => Array(width).fill(true));

-lines.push(`Map dimensions: ${MAP_WIDTH}x${MAP_HEIGHT} (${MAP_WIDTH * MAP_HEIGHT} tiles)`);
+lines.push(`Baseline dimensions: ${MAP_WIDTH}x${MAP_HEIGHT} (individual levels may differ)`);
```

## Commit Details

**Commit Hash**: eee89c0
**Commit Message**: 
```
fix(scope): isolate Level 1 horizontal expansion - revert global dimension changes

PROBLEM:
Previous horizontal expansion (d8c151c) updated global MAP_WIDTH/MAP_HEIGHT
constants, affecting all levels instead of just Level 1.

SOLUTION:
1. Reverted global constants to baseline (22x18)
2. Implemented per-level dimension support
3. Level 1 (Warehouse) now uses 28x23 dimensions
4. All other levels remain at 22x18 baseline

CHANGES:
- src/main.js: Reverted constants, added dynamic bounds
- src/tile/TileGrid.js: Per-level dimension support
- src/levels.js: Added width/height properties to levels
- scripts/map-validator.js: Per-level validation

VERIFICATION:
✅ Build passes
✅ Map validation passes (0 errors)
✅ Level 1: 28x23 (expanded)
✅ Levels 2-7: 22x18 (baseline, unchanged)
✅ P0 verification: 5/5 checks pass
```

## Conclusion

The scope has been successfully corrected. Only Level 1 (Warehouse) is horizontally expanded to 28x23, while all other levels (2-7) remain at the baseline 22x18 dimensions. The game now supports per-level dimensions through a flexible system that allows individual levels to override the global baseline.
