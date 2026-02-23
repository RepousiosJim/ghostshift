# GhostShift Map Tiling System Guide

This guide explains how to create and validate maps for GhostShift's fully-tiled movement system.

## Overview

GhostShift uses a **22x18 tile grid** where each tile is **48x48 pixels**. All game entities, obstacles, and navigation are tile-based for precise, predictable gameplay.

```
Map Dimensions: 22 tiles wide × 18 tiles tall
Tile Size: 48×48 pixels
Total Map Size: 1056×864 pixels
```

## Layer Conventions

Maps are defined using a layered approach:

### 1. Floor Layer (Implicit)
- **Default**: All tiles are walkable unless blocked
- Defined by absence from the `obstacles` array
- This is your "nav mesh" - the walkable area

### 2. Wall Layer (`obstacles`)
- Explicit array of blocked tile coordinates
- Blocks player, guard, and drone movement
- Blocks vision (implicit in detection calculations)

```javascript
obstacles: [
  {x: 2, y: 3},  // Single wall tile at column 2, row 3
  {x: 3, y: 3},  // Adjacent wall creates larger obstacle
  // ... more walls
]
```

### 3. Navigation Layer (Derived)
- Computed from `floor - obstacles`
- Used for pathfinding validation
- Must be a single connected region (no isolated islands)

### 4. Vision Blockers
- Walls naturally block vision (automatic)
- Cameras/drones have vision cones that respect walls
- No separate "vision blocker" layer needed

## Map Structure

```javascript
{
  name: 'Level Name',
  
  // Wall layer
  obstacles: [
    {x: 2, y: 3},
    {x: 3, y: 3},
    // ...
  ],
  
  // Player spawn (required)
  playerStart: {x: 2, y: 14},
  
  // Exit zone (required)
  exitZone: {x: 20, y: 2},
  
  // Objectives (optional but recommended)
  dataCore: {x: 16, y: 5},      // Primary objective
  keyCard: {x: 4, y: 11},       // Unlocks exit
  hackTerminal: {x: 11, y: 9},  // Interactive terminal
  securityCode: {x: 6, y: 4},   // Collectible
  powerCell: {x: 18, y: 14},    // Collectible
  relayTerminal: {x: 12, y: 4}, // Secondary hack point
  
  // Enemies
  guardPatrol: [                 // Guard patrol waypoints
    {x: 5, y: 7},
    {x: 14, y: 7},
    {x: 14, y: 13},
    {x: 5, y: 13}
  ],
  patrolDrones: [                // Flying drones
    {
      x: 18, y: 11,              // Spawn position
      patrol: [                   // Patrol route
        {x: 14, y: 9},
        {x: 18, y: 9},
        {x: 18, y: 14},
        {x: 14, y: 14}
      ]
    }
  ],
  
  // Sensors
  cameras: [
    {x: 6, y: 2},
    {x: 18, y: 10}
  ],
  motionSensors: [
    {x: 10, y: 14}
  ],
  laserGrids: [
    {x: 12, y: 5, h: true},  // Horizontal laser
    {x: 14, y: 9, v: true}   // Vertical laser
  ],
  
  // Metadata
  difficulty: 1,            // 1=Easy, 2=Medium, 3=Hard
  alarmTimer: 45            // Optional: Seconds until alarm (null = no alarm)
}
```

## Validation Rules

The map validator checks:

### 1. Spawn Validation
- ✅ `playerStart` must be on a walkable tile
- ✅ `exitZone` must be on a walkable tile
- ✅ All objectives must be on walkable tiles

### 2. Patrol Validation
- ✅ Guard patrol waypoints must be on walkable tiles
- ✅ Drone spawn positions must be on walkable tiles
- ✅ Drone patrol waypoints must be on walkable tiles

### 3. Sensor Validation
- ✅ Motion sensors must be on walkable tiles
- ✅ Laser grids must be on walkable tiles
- ⚠️ Cameras can be on walls (may be intentional)

### 4. Reachability
- ✅ Exit must be reachable from player start
- ⚠️ Objectives should be reachable from player start
- ✅ No isolated navigation islands

### 5. Navigation Integrity
- ✅ All walkable tiles must form a single connected region
- ❌ Isolated tiles that can't be reached trigger warnings

## Running the Validator

```bash
# From project root
node scripts/map-validator.js

# Or with npm (add to package.json scripts)
npm run validate:maps
```

### Validator Output

```
╔══════════════════════════════════════════════════════════════╗
║         GhostShift Map Tiling Validator v1.0                ║
╚══════════════════════════════════════════════════════════════╝

Map dimensions: 22x18 (396 tiles)
Tile size: 48px
Levels to validate: 7

=== Validating: Warehouse ===
Nav grid: 311/396 walkable tiles (78.5%)
Connected regions: 1
[Warehouse] exitZone: reachable from playerStart ✓
[Warehouse] dataCore: reachable from playerStart ✓
  Status: ✓ PASS
```

## Creating a New Map

### Step 1: Plan Your Layout

Draw your map on paper or use a grid tool:

```
  0 1 2 3 4 5 6 7 8 9 ... 21
0 [ ][ ][ ][ ][ ][ ][ ][ ][ ]...
1 [ ][X][X][X][ ][ ][ ][ ][ ]...  X = Wall
2 [ ][ ][ ][ ][ ][ ][ ][ ][ ]...  [ ] = Floor
...
17
```

### Step 2: Define Obstacles

Place walls to create interesting navigation:

```javascript
obstacles: [
  // West storage room
  {x: 2, y: 3}, {x: 3, y: 3}, {x: 2, y: 4}, {x: 3, y: 4},
  
  // Central pillar
  {x: 10, y: 8}, {x: 11, y: 8}, {x: 10, y: 9}, {x: 11, y: 9},
  
  // East corridor walls
  {x: 16, y: 5}, {x: 16, y: 6}, {x: 16, y: 7}
]
```

### Step 3: Place Entities

```javascript
// Player starts in safe corner
playerStart: {x: 2, y: 14},

// Exit far from start
exitZone: {x: 20, y: 2},

// Guard patrols the main area
guardPatrol: [
  {x: 5, y: 7},
  {x: 14, y: 7},
  {x: 14, y: 13},
  {x: 5, y: 13}
]
```

### Step 4: Validate

```bash
npm run validate:maps
```

Fix any errors before testing in-game.

### Step 5: Playtest

1. Load the level in game
2. Verify all objectives are reachable
3. Check guard patrol paths are smooth
4. Ensure challenge is appropriate for difficulty

## Common Issues & Solutions

### "Isolated nav island detected"

**Problem**: Some walkable tiles are disconnected from the main area.

**Solution**: Add corridors or remove blocking walls to connect all areas.

```javascript
// Before: Gap closes off right side
obstacles: [{x: 10, y: 0}, {x: 10, y: 1}, ..., {x: 10, y: 17}]

// After: Leave a gap at y=8
obstacles: [{x: 10, y: 0}, ..., {x: 10, y: 7}, {x: 10, y: 9}, ..., {x: 10, y: 17}]
```

### "exitZone is NOT reachable from playerStart"

**Problem**: No valid path between spawn and exit.

**Solution**: Check for:
- Complete wall barriers
- Missing corridors
- Invalid spawn/exit positions

### "patrolDrones[0].patrol[2]: placed on blocked tile"

**Problem**: A waypoint is inside a wall.

**Solution**: Move waypoint to adjacent walkable tile or remove the wall.

## Coordinate System

```
(0,0) ────────► X (columns)
  │
  │
  │
  ▼
  Y (rows)
```

- **x**: Column index (0-21)
- **y**: Row index (0-17)

## Tips for Good Map Design

### Difficulty Scaling
- **Level 1**: Sparse obstacles, simple patrol, few sensors
- **Level 2**: Moderate obstacles, 2+ patrol paths, some sensors
- **Level 3**: Dense obstacles, multiple overlapping threats

### Space Guidelines
- Leave at least 2-tile corridors for movement
- Avoid single-tile passages (hard to navigate)
- Create multiple route options when possible

### Patrol Design
- Guards should cover main objectives
- Leave timing windows for player to slip through
- Avoid patrol paths that are too predictable

### Objective Placement
- Key Card: Before exit to enforce collection
- Data Core: In challenging but reachable location
- Hack Terminal: Near patrol path for tension

## API Reference

### map-validator.js

```javascript
const { validateLevel, buildNavGrid, isWalkable, hasPath } = require('./scripts/map-validator.js');

// Validate a single level
const result = validateLevel(levelData, levelIndex);
console.log(result.valid); // true/false
console.log(result.errors); // Array of error messages
console.log(result.warnings); // Array of warnings

// Build navigation grid
const grid = buildNavGrid(levelData); // 2D boolean array

// Check if tile is walkable
const walkable = isWalkable(grid, x, y); // boolean

// Check path existence
const canReach = hasPath(grid, from, to); // boolean
```

## Related Files

- `src/levels.js` - Level definitions
- `src/main.js` - Game logic using levels
- `validate-maps.js` - Simple bounds validator (deprecated)
- `scripts/map-validator.js` - Full tiling validator
