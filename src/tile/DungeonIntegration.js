/**
 * DungeonIntegration - Integration layer for dungeon system with existing levels
 * 
 * Provides compatibility between dungeon-generated layouts and existing level format.
 * Allows seamless integration without breaking existing level loading pipeline.
 * 
 * @module tile/DungeonIntegration
 */

import { DungeonGenerator, DUNGEON_CONFIG } from './DungeonGenerator.js';
import { 
  DUNGEON_TILE_TYPES, 
  isRoomFloor, 
  isCorridorFloor 
} from './DungeonTileTypes.js';
import { validateDungeon } from './DungeonValidator.js';
import { MAP_WIDTH, MAP_HEIGHT, isInBounds } from './TileGrid.js';

// ==================== DUNGEON TO LEVEL CONVERTER ====================

/**
 * Convert dungeon layout to legacy level format
 * @param {Object} dungeon - Generated dungeon from DungeonGenerator
 * @param {Object} options - Conversion options
 * @returns {Object} Level object compatible with LEVEL_LAYOUTS
 */
export function dungeonToLevel(dungeon, options = {}) {
  const level = {
    name: options.name || 'Dungeon Level',
    difficulty: options.difficulty || 1,
    obstacles: [],
    guardPatrol: [],
    cameras: [],
    motionSensors: [],
    laserGrids: [],
    patrolDrones: [],
    playerStart: null,
    exitZone: null,
    dataCore: null,
    keyCard: null,
    hackTerminal: null
  };
  
  // Convert walls to obstacles
  level.obstacles = extractObstacles(dungeon.grid);
  
  // Place player start in first room
  if (dungeon.rooms.length > 0) {
    const firstRoom = dungeon.rooms[0];
    level.playerStart = {
      x: firstRoom.center.x,
      y: firstRoom.center.y
    };
  }
  
  // Place exit in last room
  if (dungeon.rooms.length > 1) {
    const lastRoom = dungeon.rooms[dungeon.rooms.length - 1];
    level.exitZone = {
      x: lastRoom.center.x,
      y: lastRoom.center.y
    };
  }
  
  // Place objectives in room interiors
  placeObjectives(level, dungeon, options);
  
  // Generate guard patrol routes along corridors
  if (options.generatePatrols !== false) {
    level.guardPatrol = generatePatrolRoutes(dungeon, options);
  }
  
  // Add metadata
  level._dungeonMeta = {
    generated: true,
    roomCount: dungeon.rooms.length,
    corridorCount: dungeon.corridors.length,
    timestamp: new Date().toISOString()
  };
  
  return level;
}

/**
 * Extract obstacles from dungeon grid
 * @param {Uint8Array} grid - Dungeon tile grid
 * @returns {Array<{x: number, y: number}>}
 */
export function extractObstacles(grid) {
  const obstacles = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const idx = y * MAP_WIDTH + x;
      if (grid[idx] === DUNGEON_TILE_TYPES.WALL) {
        obstacles.push({ x, y });
      }
    }
  }
  return obstacles;
}

/**
 * Place objectives in room interiors
 * @param {Object} level - Level object to modify
 * @param {Object} dungeon - Generated dungeon
 * @param {Object} options - Placement options
 */
function placeObjectives(level, dungeon, options) {
  const rooms = dungeon.rooms.filter(r => r.width >= 3 && r.height >= 3);
  
  if (rooms.length < 3) {
    console.warn('[DungeonIntegration] Not enough rooms for objective placement');
    return;
  }
  
  // Shuffle rooms for variety
  const shuffled = [...rooms].sort(() => Math.random() - 0.5);
  
  // Place dataCore in a room (not first or last)
  if (shuffled.length > 2) {
    const dataCoreRoom = shuffled[Math.floor(shuffled.length / 2)];
    level.dataCore = {
      x: dataCoreRoom.center.x,
      y: dataCoreRoom.center.y
    };
  }
  
  // Place keyCard in another room
  if (shuffled.length > 1) {
    const keyCardRoom = shuffled[1];
    // Offset from center to avoid stacking
    level.keyCard = {
      x: Math.max(keyCardRoom.x + 1, Math.min(keyCardRoom.x + keyCardRoom.width - 2, keyCardRoom.center.x + 1)),
      y: keyCardRoom.center.y
    };
  }
  
  // Place hackTerminal in another room
  if (shuffled.length > 0) {
    const hackRoom = shuffled[0];
    level.hackTerminal = {
      x: hackRoom.center.x,
      y: Math.max(hackRoom.y + 1, Math.min(hackRoom.y + hackRoom.height - 2, hackRoom.center.y - 1))
    };
  }
}

/**
 * Generate patrol routes along corridors
 * @param {Object} dungeon - Generated dungeon
 * @param {Object} options - Generation options
 * @returns {Array>}
 */
function generatePatrolRoutes(dungeon, options) {
  const patrols = [];
  const guardCount = options.guardCount || Math.min(3, dungeon.corridors.length);
  
  for (let i = 0; i < guardCount; i++) {
    const corridor = dungeon.corridors[i % dungeon.corridors.length];
    
    if (corridor.path.length < 2) continue;
    
    // Create patrol points along corridor
    const points = selectPatrolPoints(corridor.path, 3);
    
    patrols.push({
      points: points,
      speed: 100 + Math.random() * 50,
      detectRadius: 150
    });
  }
  
  return patrols;
}

/**
 * Select patrol points from corridor path
 * @param {Array} path - Corridor path
 * @param {number} count - Number of points to select
 * @returns {Array<{x: number, y: number}>}
 */
function selectPatrolPoints(path, count) {
  if (path.length <= count) {
    return path.map(p => ({ x: p.x, y: p.y }));
  }
  
  const points = [];
  const step = Math.floor(path.length / (count - 1));
  
  for (let i = 0; i < count - 1; i++) {
    const idx = Math.min(i * step, path.length - 1);
    points.push({ x: path[idx].x, y: path[idx].y });
  }
  
  // Add last point
  points.push({ x: path[path.length - 1].x, y: path[path.length - 1].y });
  
  return points;
}

// ==================== LEVEL TO DUNGEON CONVERTERS ====================

/**
 * Convert existing level to dungeon grid format
 * @param {Object} level - Existing level from LEVEL_LAYOUTS
 * @returns {Object} Dungeon-compatible grid and metadata
 */
export function levelToDungeon(level) {
  const grid = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  grid.fill(DUNGEON_TILE_TYPES.WALL);
  
  // Mark all non-obstacle tiles as floor
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const isObstacle = level.obstacles?.some(o => o.x === x && o.y === y);
      if (!isObstacle) {
        const idx = y * MAP_WIDTH + x;
        grid[idx] = DUNGEON_TILE_TYPES.FLOOR;
      }
    }
  }
  
  // Mark special tiles
  if (level.playerStart) {
    markTile(grid, level.playerStart.x, level.playerStart.y, DUNGEON_TILE_TYPES.PLAYER_START);
  }
  
  if (level.exitZone) {
    markTile(grid, level.exitZone.x, level.exitZone.y, DUNGEON_TILE_TYPES.EXIT);
  }
  
  if (level.dataCore) {
    markTile(grid, level.dataCore.x, level.dataCore.y, DUNGEON_TILE_TYPES.OBJECTIVE_SLOT);
  }
  
  if (level.keyCard) {
    markTile(grid, level.keyCard.x, level.keyCard.y, DUNGEON_TILE_TYPES.OBJECTIVE_SLOT);
  }
  
  if (level.hackTerminal) {
    markTile(grid, level.hackTerminal.x, level.hackTerminal.y, DUNGEON_TILE_TYPES.OBJECTIVE_SLOT);
  }
  
  return {
    grid,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    level: level
  };
}

/**
 * Mark a tile in the grid
 * @param {Uint8Array} grid - Tile grid
 * @param {number} x - Tile X
 * @param {number} y - Tile Y
 * @param {number} type - Tile type
 */
function markTile(grid, x, y, type) {
  if (isInBounds(x, y)) {
    const idx = y * MAP_WIDTH + x;
    grid[idx] = type;
  }
}

// ==================== HYBRID GENERATION ====================

/**
 * Generate a hybrid level combining dungeon generation with existing level structure
 * @param {Object} baseLevel - Base level to enhance
 * @param {Object} options - Generation options
 * @returns {Object} Enhanced level
 */
export function generateHybridLevel(baseLevel, options = {}) {
  // Start with base level structure
  const level = { ...baseLevel };
  
  // Generate dungeon
  const generator = new DungeonGenerator(options.dungeonConfig);
  const dungeon = generator.generate();
  
  // Validate dungeon
  const validation = validateDungeon(dungeon.grid, level);
  
  if (!validation.valid) {
    console.warn('[DungeonIntegration] Generated dungeon failed validation:', validation.errors);
    // Fall back to base level
    return baseLevel;
  }
  
  // Convert dungeon to level format
  const dungeonLevel = dungeonToLevel(dungeon, {
    ...options,
    name: baseLevel.name + ' (Dungeon Enhanced)',
    difficulty: baseLevel.difficulty
  });
  
  // Merge: keep base level metadata, use dungeon geometry
  level.obstacles = dungeonLevel.obstacles;
  level._dungeonMeta = dungeonLevel._dungeonMeta;
  
  // Optionally override positions
  if (options.overridePositions) {
    level.playerStart = dungeonLevel.playerStart;
    level.exitZone = dungeonLevel.exitZone;
    level.dataCore = dungeonLevel.dataCore;
    level.keyCard = dungeonLevel.keyCard;
    level.hackTerminal = dungeonLevel.hackTerminal;
  }
  
  // Merge patrol routes
  if (options.mergePatrols !== false) {
    level.guardPatrol = [
      ...(baseLevel.guardPatrol || []),
      ...dungeonLevel.guardPatrol
    ];
  }
  
  return level;
}

// ==================== VALIDATION INTEGRATION ====================

/**
 * Validate level with dungeon validators
 * @param {Object} level - Level to validate
 * @returns {Object} Validation result
 */
export function validateLevelWithDungeonRules(level) {
  const dungeonData = levelToDungeon(level);
  return validateDungeon(dungeonData.grid, level);
}

// ==================== EXPORTS ====================
export default {
  dungeonToLevel,
  extractObstacles,
  levelToDungeon,
  generateHybridLevel,
  validateLevelWithDungeonRules
};
