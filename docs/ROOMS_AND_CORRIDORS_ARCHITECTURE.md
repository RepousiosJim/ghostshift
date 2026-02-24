# GhostShift Rooms-and-Corridors Architecture Guide

## Overview

This document defines the map architecture standards for GhostShift levels, based on a **rooms-and-corridors** design pattern that ensures clear traversal, strategic stealth gameplay, and coherent enemy patrol behavior.

## Architecture Principles

### Core Concepts

1. **Rooms**: Enclosed spaces with 3+ walls, accessed via doors (1-2 tile gaps)
2. **Corridors**: 2-3 tile wide passages connecting rooms
3. **Doors/Chokepoints**: 1-2 tile gaps in walls between rooms/corridors
4. **Objectives in Rooms**: Critical items placed in room interiors, not corridors
5. **Patrol Routes**: Guards patrol corridors, occasionally entering rooms
6. **Multi-Route Flow**: Multiple paths between objectives for stealth options

### Room Definition

A **room** is a contiguous walkable area with:
- Minimum size: 3x3 tiles
- Surrounded by walls on at least 3 sides
- Accessed via 1-2 tile "door" gaps
- Contains at most 1 critical objective

```
┌─────────┐
│  ROOM   │  <- Enclosed area (4+ walls)
│    ●    │  <- Objective placed in center
└───┬─────┘
    │      <- Door/chokepoint (1-2 tile gap)
    │
  CORRIDOR  <- 2-3 tile wide passage
```

### Corridor Definition

A **corridor** is a walkable passage with:
- Width: 2-3 tiles
- Connects multiple rooms
- May have side passages
- Should NOT contain critical objectives
- Primary patrol area for guards

```
  Room A     Corridor      Room B
┌───────┐  ┌─────────┐   ┌───────┐
│       │  │         │   │       │
│   ●   │  │ ←─────→ │   │   ●   │
│       │  │         │   │       │
└───┬───┘  └─────────┘   └───┬───┘
    │                          │
    └──────────────────────────┘
```

### Door/Chokepoint Definition

A **door** or **chokepoint** is:
- 1-2 tile gap in a wall
- Creates strategic decision points
- Natural patrol waypoints
- Vision blocking points

## Layout Rules

### Rule 1: Objectives in Rooms, Not Corridors

**✅ CORRECT:**
```javascript
// Data core in enclosed room
dataCore: {x: 10, y: 5}  // Inside room
```

**❌ INCORRECT:**
```javascript
// Data core in corridor
dataCore: {x: 10, y: 9}  // In corridor lane
```

### Rule 2: Player Spawn in Safe Room

- Player should spawn in a small room or alcove
- Not in a main corridor
- Clear path to first objective
- Exit should be in a different room

### Rule 3: Exit in Separate Room

- Exit should be in a distinct room from spawn
- Requires traversing multiple rooms/corridors
- Creates natural progression flow

### Rule 4: Minimum Corridor Width

- **Minimum**: 2 tiles wide
- **Recommended**: 3 tiles wide for main corridors
- **Chokepoints**: 1-2 tiles (strategic)

### Rule 5: Room Size Guidelines

| Room Type | Min Size | Max Size | Purpose |
|-----------|----------|----------|---------|
| Spawn Room | 3x3 | 5x5 | Safe starting area |
| Objective Room | 4x4 | 7x7 | Contains dataCore/keyCard/hackTerminal |
| Exit Room | 3x3 | 5x5 | Contains exitZone |
| Guard Post | 3x3 | 4x4 | Guard spawn/patrol waypoint |

### Rule 6: Multi-Route Flow

- **Minimum**: 2 routes from spawn to exit
- **Recommended**: 3 routes for medium/hard levels
- Routes should offer different risk/reward tradeoffs

```
        Route A (Fast, exposed)
Spawn ────────┬────────────────→ Exit
              │
        Route B (Slow, stealth)
```

### Rule 7: Patrol Route Design

Guards should:
- **Primary**: Patrol corridors (80% of patrol points)
- **Secondary**: Check room entrances (20% of patrol points)
- **Never**: Patrol inside objective rooms continuously
- **Always**: Have predictable patterns with timing windows

## Map Structure Template

### Room-First Layout Approach

1. **Design rooms first**: Identify where objectives will go
2. **Connect with corridors**: Add 2-3 tile wide passages
3. **Add doors/chokepoints**: 1-2 tile gaps between rooms
4. **Place objectives**: Inside rooms, not corridors
5. **Design patrols**: Corridor-focused with room checks
6. **Add sensors**: Cameras cover corridors, motion sensors in rooms

### Example Layout (22x18 map)

```
  0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21
0 ┌─────┐       ┌─────┐       ┌─────────────────────────┐
1 │Spawn│       │Room │       │      Exit Room          │
2 │  ●  │       │  ●  │       │          ●              │
3 └──┬──┘       └──┬──┘       └───────┬─────────────────┘
4    │             │                  │
5    │  ══════════════════════════════│═══  <- Main Corridor
6    │             │                  │
7    │         ┌───┴───┐          ┌───┴───┐
8    │         │ Data  │          │ Guard │
9    │         │ Core  │          │ Post  │
10   │         │   ●   │          │       │
11   │         └───────┘          └───────┘
12   │
13   │     ┌─────────────────────────────┐
14   │     │    Secondary Corridor       │
15   │     │                             │
16   │     └─────────────────────────────┘
17   │
```

## Validation Checklist

When designing a level, verify:

- [ ] All objectives (dataCore, keyCard, hackTerminal) are in rooms
- [ ] Player spawn is in a room or safe alcove
- [ ] Exit is in a separate room from spawn
- [ ] Corridors are 2+ tiles wide
- [ ] Doors/chokepoints are 1-2 tiles wide
- [ ] At least 2 routes from spawn to exit
- [ ] Guard patrols primarily follow corridors
- [ ] Patrol waypoints are not inside objective rooms
- [ ] Cameras cover corridor intersections
- [ ] Motion sensors are in room interiors

## Validation Exceptions

The map validator allows warnings (not errors) for the following cases:

### Intentional Placements on Blocked Tiles

1. **Laser Grids**: Placed on blocked tiles by design to block passage
   - Status: ⚠️ Warning (acceptable)
   - Rationale: Laser grids are barriers, not walkable objectives

2. **Guard Patrol Waypoints**: May be on blocked tiles near room entrances
   - Status: ⚠️ Warning (acceptable)
   - Rationale: Guards check room entrances which may be near walls

3. **Motion Sensors**: May be on blocked tiles in room corners
   - Status: ⚠️ Warning (acceptable)
   - Rationale: Sensors often placed near walls for coverage

4. **Patrol Drone Waypoints**: May cross near obstacles
   - Status: ⚠️ Warning (acceptable)
   - Rationale: Drones have different movement rules than ground entities

5. **Cameras**: Often placed on walls for visibility
   - Status: ⚠️ Warning (acceptable)
   - Rationale: Cameras are mounted on walls

### Clearance Radius Warnings

Objectives with insufficient clearance radius (1 tile):
- Status: ⚠️ Warning (review recommended)
- Rationale: May be acceptable in constrained rooms, but verify gameplay

## Objective Placement Fallback System

The level loader includes a deterministic fallback system for objective placement:

### How It Works

1. **Primary Placement**: Uses coordinates from level definition
2. **Validation**: Checks if position is on a blocked tile
3. **Spiral Search**: If blocked, searches for nearest walkable tile (up to 5 tile radius)
4. **Default Fallback**: If no walkable tile found, uses safe default position

### Telemetry

The system tracks placement failures:

```javascript
import { getPlacementFailures, clearPlacementFailures } from './levels.js';

// Get placement failure telemetry
const failures = getPlacementFailures();
console.log(failures);
// [
//   {
//     level: 'Warehouse',
//     objective: 'dataCore',
//     originalPosition: {x: 17, y: 3},
//     reason: 'blocked_tile',
//     timestamp: '2026-02-24T17:30:00.000Z'
//   }
// ]

// Clear telemetry
clearPlacementFailures();
```

### Fallback Positions

Default fallback positions for each objective type:

```javascript
const OBJECTIVE_FALLBACKS = {
  playerStart: {x: 2, y: 15},   // Safe spawn area
  exitZone: {x: 20, y: 2},      // Top-right corner
  dataCore: {x: 10, y: 9},      // Map center
  keyCard: {x: 5, y: 8},        // Left side
  hackTerminal: {x: 15, y: 8}   // Right side
};
```

### Never Fails Silently

The fallback system:
- ✅ Logs warnings to console
- ✅ Records telemetry for debugging
- ✅ Always provides a valid position
- ✅ Preserves game functionality

## Common Anti-Patterns

### Anti-Pattern 1: Objective in Corridor

```
❌ BAD:
═══════════════════════════
          ●  <- Objective in corridor
═══════════════════════════

✅ GOOD:
┌─────────┐
│    ●    │  <- Objective in room
└────┬────┘
     │
═════╪════════════════════  <- Corridor outside
```

### Anti-Pattern 2: Single Corridor

```
❌ BAD:
Spawn ──────────────> Exit
       (only one path)

✅ GOOD:
Spawn ───┬────────────> Exit
         │
         └────────────> Exit
       (multiple routes)
```

### Anti-Pattern 3: Narrow Corridors

```
❌ BAD:
┌─┐
│ │  <- 1-tile corridor (too narrow)
└─┘

✅ GOOD:
┌───┐
│   │  <- 2-3 tile corridor
└───┘
```

### Anti-Pattern 4: Guard Camped in Objective Room

```
❌ BAD:
┌─────────┐
│  ●  👁   │  <- Guard constantly in room
└────┬────┘

✅ GOOD:
┌─────────┐
│    ●    │  <- Room clear, guard patrols corridor
└────┬────┘
     │
     👁     <- Guard in corridor, occasionally checks door
```

## Implementation Guidelines

### Code Structure

```javascript
// Room definition helper
function createRoom(x, y, width, height, doorPosition) {
  const obstacles = [];
  
  // Top wall (with door gap)
  for (let dx = 0; dx < width; dx++) {
    if (doorPosition === 'top' && dx === Math.floor(width / 2)) continue;
    obstacles.push({x: x + dx, y: y});
  }
  
  // Bottom wall (with door gap)
  for (let dx = 0; dx < width; dx++) {
    if (doorPosition === 'bottom' && dx === Math.floor(width / 2)) continue;
    obstacles.push({x: x + dx, y: y + height - 1});
  }
  
  // Left wall (with door gap)
  for (let dy = 0; dy < height; dy++) {
    if (doorPosition === 'left' && dy === Math.floor(height / 2)) continue;
    obstacles.push({x: x, y: y + dy});
  }
  
  // Right wall (with door gap)
  for (let dy = 0; dy < height; dy++) {
    if (doorPosition === 'right' && dy === Math.floor(height / 2)) continue;
    obstacles.push({x: x + width - 1, y: y + dy});
  }
  
  return obstacles;
}

// Corridor definition helper
function createHorizontalCorridor(x1, x2, y, width = 2) {
  // Corridors are walkable - no obstacles
  // This is just for documentation
  return {
    start: {x: x1, y: y},
    end: {x: x2, y: y},
    width: width
  };
}
```

### Level Design Workflow

1. **Sketch rooms on grid paper**
   - Mark objective rooms
   - Mark spawn room
   - Mark exit room
   
2. **Connect rooms with corridors**
   - Ensure 2-3 tile width
   - Create multiple routes
   
3. **Add doors/chokepoints**
   - 1-2 tile gaps
   - Strategic positions
   
4. **Place objectives in rooms**
   - Center of room
   - Clearance around objectives
   
5. **Design patrol routes**
   - Follow corridors
   - Check doorways
   - Timing windows for player
   
6. **Add sensors**
   - Cameras at intersections
   - Motion sensors in rooms
   
7. **Validate**
   ```bash
   npm run validate:maps
   ```

8. **Playtest**
   - Verify all routes work
   - Check patrol timing
   - Ensure challenge balance

## Migration Guide

When refactoring existing levels to rooms-and-corridors:

1. **Identify current objectives** and their positions
2. **Create rooms around objectives** (add walls)
3. **Ensure corridors connect rooms** (2+ tiles wide)
4. **Move objectives if needed** (into room centers)
5. **Redesign patrol routes** (corridor-focused)
6. **Validate reachability** (all paths work)
7. **Test gameplay** (stealth flow is clear)

## Related Files

- `docs/MAP_TILING_GUIDE.md` - Tile-based movement system
- `src/levels.js` - Level definitions
- `scripts/map-validator.js` - Validation logic
- `tests/ghostshift.spec.js` - Playtest automation

---

**Version**: 1.0  
**Created**: 2026-02-24  
**Author**: GhostShift Level Design Team
