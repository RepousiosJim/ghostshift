/**
 * DungeonTileTypes - Strict tile grammar for dungeon-style maps
 * 
 * Extends the base TILE_TYPES with dungeon-specific semantic types:
 * - FLOOR variants (room vs corridor)
 * - Door types (normal, locked)
 * - Slot types for dynamic placement (objectives, enemies, hazards)
 * 
 * @module tile/DungeonTileTypes
 */

// ==================== DUNGEON TILE TYPES ====================

/**
 * Extended tile types for dungeon-style maps
 * Extends base TILE_TYPES with semantic dungeon tiles
 */
export const DUNGEON_TILE_TYPES = {
  // Base types (from TileGrid.js)
  FLOOR: 0,
  WALL: 1,
  OBSTACLE: 2,
  PLAYER_START: 3,
  GUARD_SPAWN: 4,
  ITEM: 5,
  EXIT: 6,
  CAMERA: 7,
  SENSOR: 8,
  LASER: 9,
  DRONE_PATH: 10,
  WATER: 11,
  VENT: 12,
  RESTRICTED: 13,
  
  // Dungeon-specific floor types
  FLOOR_ROOM: 20,        // Room interior floor
  FLOOR_CORRIDOR: 21,    // Corridor floor
  
  // Door types
  DOOR: 22,              // Normal door (walkable, blocks LOS when closed)
  LOCKED_DOOR: 23,       // Locked door (requires key, blocks movement)
  
  // Slot types (for dynamic placement)
  OBJECTIVE_SLOT: 24,    // Valid position for objectives
  ENEMY_PATROL_SLOT: 25, // Valid position for enemy patrol waypoints
  HAZARD_SLOT: 26        // Valid position for hazards (lasers, sensors)
};

/**
 * Tile type categories for filtering
 */
export const TILE_CATEGORIES = {
  WALKABLE: [
    DUNGEON_TILE_TYPES.FLOOR,
    DUNGEON_TILE_TYPES.FLOOR_ROOM,
    DUNGEON_TILE_TYPES.FLOOR_CORRIDOR,
    DUNGEON_TILE_TYPES.PLAYER_START,
    DUNGEON_TILE_TYPES.GUARD_SPAWN,
    DUNGEON_TILE_TYPES.ITEM,
    DUNGEON_TILE_TYPES.EXIT,
    DUNGEON_TILE_TYPES.CAMERA,
    DUNGEON_TILE_TYPES.SENSOR,
    DUNGEON_TILE_TYPES.LASER,
    DUNGEON_TILE_TYPES.DRONE_PATH,
    DUNGEON_TILE_TYPES.VENT,
    DUNGEON_TILE_TYPES.DOOR,
    DUNGEON_TILE_TYPES.OBJECTIVE_SLOT,
    DUNGEON_TILE_TYPES.ENEMY_PATROL_SLOT,
    DUNGEON_TILE_TYPES.HAZARD_SLOT
  ],
  
  BLOCKING: [
    DUNGEON_TILE_TYPES.WALL,
    DUNGEON_TILE_TYPES.OBSTACLE,
    DUNGEON_TILE_TYPES.LOCKED_DOOR,
    DUNGEON_TILE_TYPES.WATER
  ],
  
  ROOM_FLOORS: [
    DUNGEON_TILE_TYPES.FLOOR,
    DUNGEON_TILE_TYPES.FLOOR_ROOM
  ],
  
  CORRIDOR_FLOORS: [
    DUNGEON_TILE_TYPES.FLOOR_CORRIDOR
  ],
  
  DOORS: [
    DUNGEON_TILE_TYPES.DOOR,
    DUNGEON_TILE_TYPES.LOCKED_DOOR
  ],
  
  SLOTS: [
    DUNGEON_TILE_TYPES.OBJECTIVE_SLOT,
    DUNGEON_TILE_TYPES.ENEMY_PATROL_SLOT,
    DUNGEON_TILE_TYPES.HAZARD_SLOT
  ]
};

/**
 * Metadata for dungeon tile types
 * Extends DEFAULT_TILE_METADATA from TileMetadata.js
 */
export const DUNGEON_TILE_METADATA = {
  [DUNGEON_TILE_TYPES.FLOOR_ROOM]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 1.0,
    semantic: 'room'
  },
  
  [DUNGEON_TILE_TYPES.FLOOR_CORRIDOR]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 0.8,  // Slightly preferred for patrols
    semantic: 'corridor'
  },
  
  [DUNGEON_TILE_TYPES.DOOR]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: true,  // Blocks LOS when closed
    cost_enemy: 1.5,   // Slight cost for door traversal
    semantic: 'door',
    interactive: true,
    state: 'closed'    // Can be 'open' or 'closed'
  },
  
  [DUNGEON_TILE_TYPES.LOCKED_DOOR]: {
    walk_player: false, // Requires key
    walk_enemy: false,  // Enemies can't pass
    blocks_los: true,
    cost_enemy: Infinity,
    semantic: 'locked_door',
    interactive: true,
    requiresKey: true,
    state: 'locked'
  },
  
  [DUNGEON_TILE_TYPES.OBJECTIVE_SLOT]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 1.0,
    semantic: 'objective_slot',
    canSpawn: ['dataCore', 'keyCard', 'hackTerminal', 'relayTerminal', 'securityCode', 'powerCell']
  },
  
  [DUNGEON_TILE_TYPES.ENEMY_PATROL_SLOT]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 0.5,  // Preferred for patrol routes
    semantic: 'patrol_slot'
  },
  
  [DUNGEON_TILE_TYPES.HAZARD_SLOT]: {
    walk_player: true,
    walk_enemy: true,
    blocks_los: false,
    cost_enemy: 1.0,
    semantic: 'hazard_slot',
    canSpawn: ['laser', 'sensor', 'camera']
  }
};

/**
 * Check if tile type is a room floor
 * @param {number} tileType - Tile type constant
 * @returns {boolean}
 */
export function isRoomFloor(tileType) {
  return TILE_CATEGORIES.ROOM_FLOORS.includes(tileType);
}

/**
 * Check if tile type is a corridor floor
 * @param {number} tileType - Tile type constant
 * @returns {boolean}
 */
export function isCorridorFloor(tileType) {
  return TILE_CATEGORIES.CORRIDOR_FLOORS.includes(tileType);
}

/**
 * Check if tile type is a door
 * @param {number} tileType - Tile type constant
 * @returns {boolean}
 */
export function isDoor(tileType) {
  return TILE_CATEGORIES.DOORS.includes(tileType);
}

/**
 * Check if tile type is a slot
 * @param {number} tileType - Tile type constant
 * @returns {boolean}
 */
export function isSlot(tileType) {
  return TILE_CATEGORIES.SLOTS.includes(tileType);
}

/**
 * Check if tile type is walkable
 * @param {number} tileType - Tile type constant
 * @returns {boolean}
 */
export function isWalkableType(tileType) {
  return TILE_CATEGORIES.WALKABLE.includes(tileType);
}

/**
 * Check if tile type blocks movement
 * @param {number} tileType - Tile type constant
 * @returns {boolean}
 */
export function isBlockingType(tileType) {
  return TILE_CATEGORIES.BLOCKING.includes(tileType);
}

/**
 * Get semantic type for tile
 * @param {number} tileType - Tile type constant
 * @returns {string} Semantic type name
 */
export function getTileSemantic(tileType) {
  const meta = DUNGEON_TILE_METADATA[tileType];
  return meta?.semantic || 'unknown';
}

// ==================== EXPORTS ====================
export default {
  DUNGEON_TILE_TYPES,
  TILE_CATEGORIES,
  DUNGEON_TILE_METADATA,
  isRoomFloor,
  isCorridorFloor,
  isDoor,
  isSlot,
  isWalkableType,
  isBlockingType,
  getTileSemantic
};
