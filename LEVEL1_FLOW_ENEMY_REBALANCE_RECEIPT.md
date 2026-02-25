# Level 1 (Warehouse) Objective-Flow Readability and Enemy Pressure Balance

**Date:** 2026-02-25
**Commit:** 52f3379 (parent), 83719fb (docs)
**Status:** ✅ COMPLETE

## Summary

Fixed GhostShift Level 1 (Warehouse) objective-flow readability and enemy pressure balance to improve new player experience.

## Before/After Comparison

### 1. Guard Patrol Distribution

| Metric | Before | After |
|--------|--------|-------|
| Patrol points | (3,15), (14,15), (23,15), (14,16) | (3,14), (9,14), (15,14), (21,14) |
| Clustering | 2 points at x=14 (Terminal area) | Evenly distributed across corridor |
| Closest to Terminal door | dist=2 (unfair pressure) | dist=5 (fair) |

### 2. Camera/Guard Overlap

| Metric | Before | After |
|--------|--------|-------|
| Camera position | (14, 16) | (6, 8) |
| Overlap with patrol | Point [1] dist=1, Point [3] dist=0 | No overlap (dist > 6 to all) |
| Stacked detection | Yes (camera + guard at same location) | No (separate areas) |

### 3. Door Threshold Coverage

| Door | Before (closest guard) | After (closest guard) |
|------|------------------------|----------------------|
| Spawn | dist=5 | dist=1 |
| Keycard | dist=5 | dist=1 |
| Terminal | dist=2 ⚠️ | dist=5 |
| Datacore | dist=4 | dist=1 |
| Exit | dist=3 | dist=16 (safe approach) |

### 4. Nameplate Visual Noise

| Metric | Before | After (Level 1 only) |
|--------|--------|---------------------|
| Base alpha | 0.6 | 0.35 |
| Min alpha (far) | 0.4 | 0.2 |
| Max alpha (close) | 0.9 | 0.6 |

### 5. Objective Flow Guidance

| Metric | Before | After |
|--------|--------|-------|
| Visual path indicators | None | Dashed lines + arrows between K→T→D→E |
| Level 1 specific | N/A | Yes (only shows for levelIndex === 0) |

## Coordinate Diffs

### Guard Patrol (Level 1)

```
BEFORE:
  [0]: (5, 15)   →  AFTER: (3, 14)
  [1]: (14, 15)  →  AFTER: (9, 14)
  [2]: (23, 15)  →  AFTER: (15, 14)
  [3]: (14, 16)  →  AFTER: (21, 14)
```

### Camera (Level 1)

```
BEFORE: (14, 16)  →  AFTER: (6, 8)
```

## Files Changed

1. **src/levels.js**
   - Guard patrol repositioned for balanced threshold coverage
   - Camera moved to avoid overlap with patrol
   - Comments updated to document V2 REBALANCE

2. **src/main.js**
   - Added flow indicator graphics for Level 1 (dashed lines + arrows)
   - Reduced nameplate base alpha for Level 1 (0.35 vs 0.6)
   - Reduced proximity-based alpha range for Level 1 (0.2-0.6 vs 0.4-0.9)

## Verification Evidence

### Level Validation
```
✅ All levels valid
✅ No guard-camera overlaps (dist > 1)
```

### Build Status
```
✓ 29 modules transformed
✓ built in 10.39s
✅ game.js syntax OK
```

### Door Threshold Coverage (After)
```
Spawn door:    closest guard dist=1
Keycard door:  closest guard dist=1
Terminal door: closest guard dist=5
Datacore door: closest guard dist=1
Exit door:     closest guard dist=16 (safe approach)
```

## Design Rationale

1. **Patrol Redistribution**: Moved from clustering at x=14 (Terminal area) to even distribution across corridor thresholds. This ensures fair pressure at all objectives rather than unfair stacking at one location.

2. **Camera Repositioning**: Moved from (14,16) which overlapped with patrol points to (6,8) in the upper corridor. This provides early warning capability without creating unfair stacked detection zones.

3. **Flow Indicators**: Added subtle dashed lines and arrows between objectives (K→T→D→E) to guide new players through the intended progression path without being intrusive.

4. **Nameplate Noise Reduction**: Lowered alpha values for Level 1 to reduce visual clutter for new players while maintaining visibility for experienced players on other levels.

## Level 1 Focus

All changes are Level 1-specific:
- Flow indicators: `if (this.currentLevelIndex === 0)`
- Nameplate alpha: `const isLevel1 = this.currentLevelIndex === 0`
- No changes to Level 2-7 patrol, camera, or visual elements

## Console/Runtime Errors

```
✅ Zero console errors
✅ Zero runtime errors
✅ Build successful
```

## Commit Hash

```
52f3379032b2f84167979496b50d6346007b8e23
```
