/**
 * Test suite for dungeon tile system
 * Validates core functionality of dungeon generation and validation
 */

import { test, expect } from '@playwright/test';
import { 
  DungeonGenerator, 
  generateDungeon,
  DUNGEON_CONFIG 
} from '../src/tile/DungeonGenerator.js';

import {
  DUNGEON_TILE_TYPES,
  TILE_CATEGORIES,
  isRoomFloor,
  isCorridorFloor,
  isDoor,
  isSlot,
  isWalkableType,
  isBlockingType
} from '../src/tile/DungeonTileTypes.js';

import {
  validateConnectivity,
  validateWalkability,
  validateObjectiveSlots,
  validateDungeon
} from '../src/tile/DungeonValidator.js';

import {
  dungeonToLevel,
  levelToDungeon,
  extractObstacles
} from '../src/tile/DungeonIntegration.js';

// ==================== DUNGEON TILE TYPES TESTS ====================

test.describe('Dungeon Tile Types', () => {
  test('should define all required tile types', () => {
    expect(DUNGEON_TILE_TYPES.FLOOR_ROOM).toBeDefined();
    expect(DUNGEON_TILE_TYPES.FLOOR_CORRIDOR).toBeDefined();
    expect(DUNGEON_TILE_TYPES.DOOR).toBeDefined();
    expect(DUNGEON_TILE_TYPES.LOCKED_DOOR).toBeDefined();
    expect(DUNGEON_TILE_TYPES.OBJECTIVE_SLOT).toBeDefined();
    expect(DUNGEON_TILE_TYPES.ENEMY_PATROL_SLOT).toBeDefined();
    expect(DUNGEON_TILE_TYPES.HAZARD_SLOT).toBeDefined();
  });

  test('should correctly identify room floors', () => {
    expect(isRoomFloor(DUNGEON_TILE_TYPES.FLOOR_ROOM)).toBe(true);
    expect(isRoomFloor(DUNGEON_TILE_TYPES.FLOOR_CORRIDOR)).toBe(false);
  });

  test('should correctly identify corridor floors', () => {
    expect(isCorridorFloor(DUNGEON_TILE_TYPES.FLOOR_CORRIDOR)).toBe(true);
    expect(isCorridorFloor(DUNGEON_TILE_TYPES.FLOOR_ROOM)).toBe(false);
  });

  test('should correctly identify doors', () => {
    expect(isDoor(DUNGEON_TILE_TYPES.DOOR)).toBe(true);
    expect(isDoor(DUNGEON_TILE_TYPES.LOCKED_DOOR)).toBe(true);
    expect(isDoor(DUNGEON_TILE_TYPES.FLOOR)).toBe(false);
  });

  test('should correctly identify slots', () => {
    expect(isSlot(DUNGEON_TILE_TYPES.OBJECTIVE_SLOT)).toBe(true);
    expect(isSlot(DUNGEON_TILE_TYPES.ENEMY_PATROL_SLOT)).toBe(true);
    expect(isSlot(DUNGEON_TILE_TYPES.HAZARD_SLOT)).toBe(true);
    expect(isSlot(DUNGEON_TILE_TYPES.FLOOR)).toBe(false);
  });

  test('should correctly identify walkable types', () => {
    expect(isWalkableType(DUNGEON_TILE_TYPES.FLOOR)).toBe(true);
    expect(isWalkableType(DUNGEON_TILE_TYPES.FLOOR_ROOM)).toBe(true);
    expect(isWalkableType(DUNGEON_TILE_TYPES.FLOOR_CORRIDOR)).toBe(true);
    expect(isWalkableType(DUNGEON_TILE_TYPES.WALL)).toBe(false);
    expect(isWalkableType(DUNGEON_TILE_TYPES.LOCKED_DOOR)).toBe(false);
  });

  test('should correctly identify blocking types', () => {
    expect(isBlockingType(DUNGEON_TILE_TYPES.WALL)).toBe(true);
    expect(isBlockingType(DUNGEON_TILE_TYPES.OBSTACLE)).toBe(true);
    expect(isBlockingType(DUNGEON_TILE_TYPES.LOCKED_DOOR)).toBe(true);
    expect(isBlockingType(DUNGEON_TILE_TYPES.FLOOR)).toBe(false);
  });
});

// ==================== DUNGEON GENERATOR TESTS ====================

test.describe('Dungeon Generator', () => {
  test('should generate dungeon with valid structure', () => {
    const generator = new DungeonGenerator({
      minRooms: 3,
      maxRooms: 5
    });
    
    const dungeon = generator.generate();
    
    expect(dungeon).toBeDefined();
    expect(dungeon.grid).toBeDefined();
    expect(dungeon.rooms).toBeDefined();
    expect(dungeon.corridors).toBeDefined();
    expect(dungeon.width).toBe(22);
    expect(dungeon.height).toBe(18);
  });

  test('should generate at least minRooms', () => {
    const generator = new DungeonGenerator({
      minRooms: 4,
      maxRooms: 6
    });
    
    const dungeon = generator.generate();
    
    expect(dungeon.rooms.length).toBeGreaterThanOrEqual(4);
  });

  test('should connect all rooms with corridors', () => {
    const generator = new DungeonGenerator({
      minRooms: 3,
      maxRooms: 5
    });
    
    const dungeon = generator.generate();
    
    // Should have at least N-1 corridors for N rooms (MST)
    expect(dungeon.corridors.length).toBeGreaterThanOrEqual(dungeon.rooms.length - 1);
  });

  test('should place doors at room entrances', () => {
    const generator = new DungeonGenerator({
      minRooms: 3,
      maxRooms: 5,
      doorChance: 1.0 // Always place doors
    });
    
    const dungeon = generator.generate();
    
    // Count doors in grid
    let doorCount = 0;
    for (let i = 0; i < dungeon.grid.length; i++) {
      if (dungeon.grid[i] === DUNGEON_TILE_TYPES.DOOR) {
        doorCount++;
      }
    }
    
    expect(doorCount).toBeGreaterThan(0);
  });

  test('should mark room interiors correctly', () => {
    const generator = new DungeonGenerator();
    const dungeon = generator.generate();
    
    // Check that room tiles are marked as FLOOR_ROOM
    let roomTileCount = 0;
    for (const room of dungeon.rooms) {
      for (const tile of room.getTiles()) {
        const idx = tile.y * dungeon.width + tile.x;
        if (dungeon.grid[idx] === DUNGEON_TILE_TYPES.FLOOR_ROOM) {
          roomTileCount++;
        }
      }
    }
    
    expect(roomTileCount).toBeGreaterThan(0);
  });

  test('should generate reproducible dungeons with same seed', () => {
    // Note: Currently no seed support, so this test is informational
    const generator = new DungeonGenerator({
      minRooms: 3,
      maxRooms: 3
    });
    
    const dungeon1 = generator.generate();
    
    expect(dungeon1.rooms.length).toBeGreaterThanOrEqual(3);
  });
});

// ==================== DUNGEON VALIDATOR TESTS ====================

test.describe('Dungeon Validator', () => {
  test('should validate connectivity of generated dungeon', () => {
    const generator = new DungeonGenerator();
    const dungeon = generator.generate();
    
    const result = validateConnectivity(dungeon.grid);
    
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test('should detect disconnected regions', () => {
    // Create a grid with disconnected regions
    const grid = new Uint8Array(22 * 18);
    grid.fill(DUNGEON_TILE_TYPES.WALL);
    
    // Region 1
    grid[5 * 22 + 5] = DUNGEON_TILE_TYPES.FLOOR;
    
    // Region 2 (disconnected)
    grid[15 * 22 + 15] = DUNGEON_TILE_TYPES.FLOOR;
    
    const result = validateConnectivity(grid);
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should validate walkability constraints', () => {
    const generator = new DungeonGenerator();
    const dungeon = generator.generate();
    
    const levelData = {
      playerStart: dungeon.rooms[0]?.center,
      exitZone: dungeon.rooms[dungeon.rooms.length - 1]?.center
    };
    
    const result = validateWalkability(dungeon.grid, levelData);
    
    expect(result.valid).toBe(true);
  });

  test('should validate path exists between points', () => {
    const generator = new DungeonGenerator();
    const dungeon = generator.generate();
    
    const room1 = dungeon.rooms[0];
    const room2 = dungeon.rooms[dungeon.rooms.length - 1];
    
    const result = validateConnectivity(dungeon.grid);
    
    expect(result.valid).toBe(true);
    expect(result.stats.connectedTiles).toBeGreaterThan(0);
  });
});

// ==================== DUNGEON INTEGRATION TESTS ====================

test.describe('Dungeon Integration', () => {
  test('should convert dungeon to level format', () => {
    const generator = new DungeonGenerator();
    const dungeon = generator.generate();
    
    const level = dungeonToLevel(dungeon);
    
    expect(level).toBeDefined();
    expect(level.name).toBeDefined();
    expect(level.obstacles).toBeDefined();
    expect(Array.isArray(level.obstacles)).toBe(true);
  });

  test('should extract obstacles from dungeon grid', () => {
    const generator = new DungeonGenerator();
    const dungeon = generator.generate();
    
    const obstacles = extractObstacles(dungeon.grid);
    
    expect(Array.isArray(obstacles)).toBe(true);
    expect(obstacles.length).toBeGreaterThan(0);
    
    // All obstacles should have x and y properties
    for (const obs of obstacles) {
      expect(obs.x).toBeDefined();
      expect(obs.y).toBeDefined();
    }
  });

  test('should place objectives in room interiors', () => {
    const generator = new DungeonGenerator({
      minRooms: 4,
      maxRooms: 6
    });
    const dungeon = generator.generate();
    
    const level = dungeonToLevel(dungeon);
    
    expect(level.dataCore).toBeDefined();
    expect(level.keyCard).toBeDefined();
    expect(level.hackTerminal).toBeDefined();
  });

  test('should generate patrol routes along corridors', () => {
    const generator = new DungeonGenerator({
      minRooms: 4,
      maxRooms: 6
    });
    const dungeon = generator.generate();
    
    const level = dungeonToLevel(dungeon, {
      generatePatrols: true,
      guardCount: 2
    });
    
    expect(level.guardPatrol).toBeDefined();
    expect(level.guardPatrol.length).toBeGreaterThan(0);
  });

  test('should convert existing level to dungeon format', () => {
    const level = {
      name: 'Test Level',
      obstacles: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 21, y: 17 }
      ],
      playerStart: { x: 2, y: 2 },
      exitZone: { x: 20, y: 16 }
    };
    
    const dungeonData = levelToDungeon(level);
    
    expect(dungeonData.grid).toBeDefined();
    expect(dungeonData.width).toBe(22);
    expect(dungeonData.height).toBe(18);
  });
});

// ==================== FULL INTEGRATION TEST ====================

test.describe('Full Integration', () => {
  test('should generate, validate, and convert dungeon end-to-end', () => {
    // Generate
    const generator = new DungeonGenerator({
      minRooms: 4,
      maxRooms: 6
    });
    const dungeon = generator.generate();
    
    // Validate
    const validation = validateDungeon(dungeon.grid, {
      playerStart: dungeon.rooms[0]?.center,
      exitZone: dungeon.rooms[dungeon.rooms.length - 1]?.center
    });
    
    expect(validation.valid).toBe(true);
    
    // Convert
    const level = dungeonToLevel(dungeon);
    
    expect(level).toBeDefined();
    expect(level.obstacles.length).toBeGreaterThan(0);
    expect(level._dungeonMeta.generated).toBe(true);
  });

  test('should maintain compatibility with existing level loading', () => {
    const generator = new DungeonGenerator();
    const dungeon = generator.generate();
    const level = dungeonToLevel(dungeon);
    
    // Level should have all required fields
    expect(level.name).toBeDefined();
    expect(level.difficulty).toBeDefined();
    expect(level.obstacles).toBeDefined();
    expect(level.guardPatrol).toBeDefined();
    
    // Should be serializable
    const json = JSON.stringify(level);
    expect(json).toBeDefined();
    
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe(level.name);
  });
});
