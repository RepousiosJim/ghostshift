# GhostShift Dungeon Tile System

## Overview

The dungeon tile system provides a procedural generation framework for creating dungeon-style maps in GhostShift. It extends the existing tile system with semantic tile types, procedural generation, and hard validation.

## Architecture

### Core Modules

1. **DungeonTileTypes.js** - Strict tile grammar and type definitions
2. **DungeonGenerator.js** - Procedural room+corridor generation
3. **DungeonValidator.js** - Hard validators for map correctness
4. **DungeonIntegration.js** - Compatibility layer with existing levels

## Tile Types

### Base Types (from TileGrid.js)
- `FLOOR` (0) - Generic floor tile
- `WALL` (1) - Blocking wall
- `OBSTACLE` (2) - Blocking obstacle
- `PLAYER_START` (3) - Player spawn point
- `GUARD_SPAWN` (4) - Guard spawn point
- `ITEM` (5) - Item location
- `EXIT` (6) - Level exit
- ... (and more)

### Dungeon-Specific Types
- `FLOOR_ROOM` (20) - Room interior floor
- `FLOOR_CORRIDOR` (21) - Corridor floor
- `DOOR` (22) - Normal door (walkable, blocks LOS)
- `LOCKED_DOOR` (23) - Locked door (requires key)
- `OBJECTIVE_SLOT` (24) - Valid objective spawn position
- `ENEMY_PATROL_SLOT` (25) - Valid patrol waypoint position
- `HAZARD_SLOT` (26) - Valid hazard spawn position

## Usage

### Generate a Dungeon

```javascript
import { generateDungeon } from './tile/DungeonGenerator.js';

const dungeon = generateDungeon({
  minRooms: 4,
  maxRooms: 8,
  minRoomWidth: 3,
  maxRoomWidth: 6,
  corridorWidth: 1,
  doorChance: 0.7,
  loopChance: 0.3
});

console.log('Rooms:', dungeon.rooms.length);
console.log('Corridors:', dungeon.corridors.length);
```

### Convert to Level Format

```javascript
import { dungeonToLevel } from './tile/DungeonIntegration.js';

const level = dungeonToLevel(dungeon, {
  name: 'Procedural Dungeon',
  difficulty: 2,
  guardCount: 3
});

// level is now compatible with LEVEL_LAYOUTS
```

### Validate a Dungeon

```javascript
import { validateDungeon } from './tile/DungeonValidator.js';

const result = validateDungeon(dungeon.grid, levelData);

if (!result.valid) {
  console.error('Validation failed:', result.errors);
} else {
  console.log('Validation passed with', result.warnings.length, 'warnings');
}
```

### Check Connectivity

```javascript
import { validateConnectivity } from './tile/DungeonValidator.js';

const result = validateConnectivity(dungeon.grid);
console.log('Connected tiles:', result.stats.connectedTiles);
console.log('Connectivity:', result.stats.connectivityPercent + '%');
```

## Validation

The system includes three hard validators:

### 1. Connectivity Validator
- Ensures all walkable tiles are reachable
- Uses flood-fill algorithm
- Reports disconnected regions
- Returns connectivity percentage

### 2. Walkability Validator
- Checks player start is walkable
- Checks exit is walkable
- Checks all objectives are walkable
- Validates guard patrol points
- Validates paths between key locations

### 3. Objective-Slot Validator
- Ensures objectives are in room interiors
- Checks wall clearance around objectives
- Validates minimum objective spacing
- Reports placement warnings

## Integration with Existing System

### Compatibility Layer

The `DungeonIntegration` module provides seamless integration:

```javascript
import { 
  dungeonToLevel, 
  levelToDungeon,
  generateHybridLevel 
} from './tile/DungeonIntegration.js';

// Convert dungeon to level
const level = dungeonToLevel(dungeon);

// Convert existing level to dungeon format
const dungeonData = levelToDungeon(existingLevel);

// Generate hybrid (combines existing level with dungeon geometry)
const hybrid = generateHybridLevel(baseLevel, {
  overridePositions: true,
  mergePatrols: true
});
```

### Level Loading Pipeline

The dungeon system is designed to work alongside the existing level loading:

```javascript
import { LEVEL_LAYOUTS } from './levels.js';
import { generateDungeon, dungeonToLevel } from './tile/index.js';

// Option 1: Use existing levels (default)
const level = LEVEL_LAYOUTS[0];

// Option 2: Generate procedural dungeon
const dungeon = generateDungeon();
const level = dungeonToLevel(dungeon);

// Option 3: Hybrid approach
const hybrid = generateHybridLevel(LEVEL_LAYOUTS[0]);
```

## Configuration

### Dungeon Generation Config

```javascript
{
  minRooms: 4,           // Minimum number of rooms
  maxRooms: 8,           // Maximum number of rooms
  minRoomWidth: 3,       // Minimum room width in tiles
  maxRoomWidth: 6,       // Maximum room width in tiles
  minRoomHeight: 3,      // Minimum room height in tiles
  maxRoomHeight: 5,      // Maximum room height in tiles
  corridorWidth: 1,      // 1 for narrow, 2 for wide corridors
  doorChance: 0.7,       // Probability of door placement (0-1)
  loopChance: 0.3,       // Probability of additional connections (0-1)
  padding: 1,            // Minimum space between rooms
  borderPadding: 2       // Minimum space from map border
}
```

### Tile Metadata

Each tile type has associated metadata:

```javascript
{
  walk_player: boolean,   // Can player walk on this tile?
  walk_enemy: boolean,    // Can enemy walk on this tile?
  blocks_los: boolean,    // Does this tile block line of sight?
  cost_enemy: number,     // Movement cost for pathfinding
  semantic: string,       // Semantic type name
  interactive: boolean,   // Can player interact with this tile?
  state: string,          // Current state (e.g., 'open', 'closed')
  canSpawn: string[]      // What can spawn on this tile?
}
```

## Testing

Run the dungeon system tests:

```bash
npm run test:e2e tests/dungeon-system.spec.js
```

All 24 tests should pass, covering:
- Tile type identification
- Dungeon generation
- Connectivity validation
- Walkability validation
- Objective-slot validation
- Level conversion
- Full integration

## Future Enhancements

### Planned Features
1. Seed-based generation for reproducible dungeons
2. Theme support (different tile sets)
3. Prefab room templates
4. Advanced loop generation
5. Boss room placement
6. Secret room generation
7. Dynamic door states (open/close during gameplay)

### Migration Hooks

The system provides these hooks for future integration:

1. **Pre-generation hook** - Modify config before generation
2. **Post-generation hook** - Modify dungeon after generation
3. **Pre-validation hook** - Add custom validation rules
4. **Post-validation hook** - Handle validation results
5. **Pre-conversion hook** - Modify level before conversion
6. **Post-conversion hook** - Modify level after conversion

Example:
```javascript
const dungeon = generateDungeon(config, {
  onPreGenerate: (config) => {
    // Modify config
    config.minRooms = 5;
  },
  onPostGenerate: (dungeon) => {
    // Add custom rooms
    dungeon.rooms.push(customRoom);
  }
});
```

## API Reference

See individual module files for detailed API documentation:
- `DungeonTileTypes.js` - Tile type constants and utilities
- `DungeonGenerator.js` - Generation classes and functions
- `DungeonValidator.js` - Validation classes and functions
- `DungeonIntegration.js` - Conversion and integration functions

## Performance

- Generation time: ~10-50ms for typical dungeon
- Validation time: ~5-20ms for full validation
- Memory usage: ~50KB for dungeon grid + metadata
- Build size impact: +8KB minified, +2KB gzipped

## Troubleshooting

### Common Issues

1. **"Disconnected regions detected"**
   - Increase room count
   - Increase loop chance
   - Check door placement logic

2. **"No valid path from player start to exit"**
   - Ensure rooms are connected
   - Check for locked doors blocking paths
   - Verify corridor generation

3. **"Objective not in room interior"**
   - Increase room sizes
   - Decrease objective count
   - Check room detection logic

### Debug Mode

Enable debug logging:
```javascript
import { setTileAIEnabled } from './tile/index.js';
setTileAIEnabled(true); // Enables debug output
```

## License

Part of GhostShift project. See main LICENSE file.
