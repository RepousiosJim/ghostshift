/**
 * DungeonGenerator - Procedural dungeon generation for GhostShift
 * 
 * Generates room+corridor layouts with:
 * - Non-overlapping rooms
 * - Corridor connectors
 * - Optional loop creation
 * - Door placement at boundaries
 * 
 * @module tile/DungeonGenerator
 */

import { 
  DUNGEON_TILE_TYPES,
  isRoomFloor,
  isCorridorFloor
} from './DungeonTileTypes.js';

import { 
  isInBounds,
  manhattanDistance,
  MAP_WIDTH,
  MAP_HEIGHT
} from './TileGrid.js';

// ==================== CONFIGURATION ====================

/**
 * Default dungeon generation configuration
 */
export const DUNGEON_CONFIG = {
  minRooms: 4,
  maxRooms: 8,
  minRoomWidth: 3,
  maxRoomWidth: 6,
  minRoomHeight: 3,
  maxRoomHeight: 5,
  corridorWidth: 1,       // 1 or 2 for narrow/wide corridors
  doorChance: 0.7,        // Chance to place door at room entrance
  loopChance: 0.3,        // Chance to create additional connections
  padding: 1,             // Minimum space between rooms
  borderPadding: 2        // Minimum space from map border
};

// ==================== ROOM CLASS ====================

/**
 * Represents a dungeon room
 */
export class Room {
  constructor(x, y, width, height, id) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.center = {
      x: Math.floor(x + width / 2),
      y: Math.floor(y + height / 2)
    };
    this.tiles = [];
    this.doors = [];
    this.connections = [];
  }
  
  /**
   * Get all tiles in this room
   * @returns {Array<{x: number, y: number}>}
   */
  getTiles() {
    if (this.tiles.length === 0) {
      for (let dy = 0; dy < this.height; dy++) {
        for (let dx = 0; dx < this.width; dx++) {
          this.tiles.push({ x: this.x + dx, y: this.y + dy });
        }
      }
    }
    return this.tiles;
  }
  
  /**
   * Check if a point is inside this room
   * @param {number} x - Tile X
   * @param {number} y - Tile Y
   * @returns {boolean}
   */
  contains(x, y) {
    return x >= this.x && x < this.x + this.width &&
           y >= this.y && y < this.y + this.height;
  }
  
  /**
   * Check if this room overlaps with another room (with padding)
   * @param {Room} other - Other room
   * @param {number} padding - Padding between rooms
   * @returns {boolean}
   */
  overlaps(other, padding = 1) {
    return !(this.x + this.width + padding <= other.x ||
             other.x + other.width + padding <= this.x ||
             this.y + this.height + padding <= other.y ||
             other.y + other.height + padding <= this.y);
  }
  
  /**
   * Get edge tiles (perimeter)
   * @returns {Array<{x: number, y: number}>}
   */
  getEdgeTiles() {
    const edges = [];
    for (let dx = 0; dx < this.width; dx++) {
      edges.push({ x: this.x + dx, y: this.y }); // Top
      edges.push({ x: this.x + dx, y: this.y + this.height - 1 }); // Bottom
    }
    for (let dy = 1; dy < this.height - 1; dy++) {
      edges.push({ x: this.x, y: this.y + dy }); // Left
      edges.push({ x: this.x + this.width - 1, y: this.y + dy }); // Right
    }
    return edges;
  }
}

// ==================== CORRIDOR CLASS ====================

/**
 * Represents a corridor connecting rooms
 */
export class Corridor {
  constructor(startRoom, endRoom, path, id) {
    this.id = id;
    this.startRoom = startRoom;
    this.endRoom = endRoom;
    this.path = path; // Array of {x, y}
    this.doors = [];
  }
  
  /**
   * Get all tiles in this corridor
   * @returns {Array<{x: number, y: number}>}
   */
  getTiles() {
    return this.path;
  }
}

// ==================== DUNGEON GENERATOR ====================

/**
 * Main dungeon generator class
 */
export class DungeonGenerator {
  /**
   * Create a new dungeon generator
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = { ...DUNGEON_CONFIG, ...config };
    this.rooms = [];
    this.corridors = [];
    this.grid = null;
    this.nextRoomId = 0;
    this.nextCorridorId = 0;
  }
  
  /**
   * Generate a complete dungeon layout
   * @returns {Object} Dungeon layout with rooms, corridors, and tile grid
   */
  generate() {
    // Initialize grid with walls
    this.grid = this._createEmptyGrid();
    this.rooms = [];
    this.corridors = [];
    
    // Generate rooms
    this._generateRooms();
    
    // Connect rooms with corridors
    this._connectRooms();
    
    // Add loops if configured
    if (Math.random() < this.config.loopChance) {
      this._addLoops();
    }
    
    // Place doors at room/corridor boundaries
    this._placeDoors();
    
    // Mark room interiors
    this._markRoomInteriors();
    
    // Mark corridors
    this._markCorridors();
    
    return {
      grid: this.grid,
      rooms: this.rooms,
      corridors: this.corridors,
      width: MAP_WIDTH,
      height: MAP_HEIGHT
    };
  }
  
  /**
   * Create empty grid filled with walls
   * @private
   * @returns {Uint8Array}
   */
  _createEmptyGrid() {
    const grid = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
    grid.fill(DUNGEON_TILE_TYPES.WALL);
    return grid;
  }
  
  /**
   * Get grid index for coordinates
   * @private
   * @param {number} x - Tile X
   * @param {number} y - Tile Y
   * @returns {number}
   */
  _getIndex(x, y) {
    return y * MAP_WIDTH + x;
  }
  
  /**
   * Get tile at position
   * @private
   * @param {number} x - Tile X
   * @param {number} y - Tile Y
   * @returns {number}
   */
  _getTile(x, y) {
    if (!isInBounds(x, y)) return DUNGEON_TILE_TYPES.WALL;
    return this.grid[this._getIndex(x, y)];
  }
  
  /**
   * Set tile at position
   * @private
   * @param {number} x - Tile X
   * @param {number} y - Tile Y
   * @param {number} type - Tile type
   */
  _setTile(x, y, type) {
    if (!isInBounds(x, y)) return;
    this.grid[this._getIndex(x, y)] = type;
  }
  
  /**
   * Generate random non-overlapping rooms
   * @private
   */
  _generateRooms() {
    const targetRooms = this.config.minRooms + 
      Math.floor(Math.random() * (this.config.maxRooms - this.config.minRooms + 1));
    
    let attempts = 0;
    const maxAttempts = targetRooms * 100;
    
    while (this.rooms.length < targetRooms && attempts < maxAttempts) {
      attempts++;
      
      const width = this.config.minRoomWidth + 
        Math.floor(Math.random() * (this.config.maxRoomWidth - this.config.minRoomWidth + 1));
      const height = this.config.minRoomHeight + 
        Math.floor(Math.random() * (this.config.maxRoomHeight - this.config.minRoomHeight + 1));
      
      const x = this.config.borderPadding + 
        Math.floor(Math.random() * (MAP_WIDTH - width - 2 * this.config.borderPadding));
      const y = this.config.borderPadding + 
        Math.floor(Math.random() * (MAP_HEIGHT - height - 2 * this.config.borderPadding));
      
      const room = new Room(x, y, width, height, this.nextRoomId++);
      
      // Check for overlaps
      const overlaps = this.rooms.some(r => 
        room.overlaps(r, this.config.padding)
      );
      
      if (!overlaps) {
        this.rooms.push(room);
        this._carveRoom(room);
      }
    }
  }
  
  /**
   * Carve room into grid
   * @private
   * @param {Room} room - Room to carve
   */
  _carveRoom(room) {
    for (const tile of room.getTiles()) {
      this._setTile(tile.x, tile.y, DUNGEON_TILE_TYPES.FLOOR);
    }
  }
  
  /**
   * Connect rooms with corridors using minimum spanning tree
   * @private
   */
  _connectRooms() {
    if (this.rooms.length < 2) return;
    
    // Build MST using Prim's algorithm
    const connected = new Set([0]);
    const connections = [];
    
    while (connected.size < this.rooms.length) {
      let bestDist = Infinity;
      let bestPair = null;
      
      for (const connectedId of connected) {
        for (let i = 0; i < this.rooms.length; i++) {
          if (connected.has(i)) continue;
          
          const dist = manhattanDistance(
            this.rooms[connectedId].center.x,
            this.rooms[connectedId].center.y,
            this.rooms[i].center.x,
            this.rooms[i].center.y
          );
          
          if (dist < bestDist) {
            bestDist = dist;
            bestPair = [connectedId, i];
          }
        }
      }
      
      if (bestPair) {
        connected.add(bestPair[1]);
        connections.push(bestPair);
        
        // Create corridor
        const corridor = this._createCorridor(
          this.rooms[bestPair[0]],
          this.rooms[bestPair[1]]
        );
        this.corridors.push(corridor);
        
        // Track room connections
        this.rooms[bestPair[0]].connections.push(bestPair[1]);
        this.rooms[bestPair[1]].connections.push(bestPair[0]);
      }
    }
  }
  
  /**
   * Create corridor between two rooms
   * @private
   * @param {Room} room1 - Start room
   * @param {Room} room2 - End room
   * @returns {Corridor}
   */
  _createCorridor(room1, room2) {
    const path = [];
    let x = room1.center.x;
    let y = room1.center.y;
    const targetX = room2.center.x;
    const targetY = room2.center.y;
    
    // L-shaped corridor (random direction priority)
    const horizontalFirst = Math.random() < 0.5;
    
    if (horizontalFirst) {
      // Move horizontally first
      while (x !== targetX) {
        if (!room1.contains(x, y) && !room2.contains(x, y)) {
          path.push({ x, y });
        }
        x += x < targetX ? 1 : -1;
      }
      // Then vertically
      while (y !== targetY) {
        if (!room1.contains(x, y) && !room2.contains(x, y)) {
          path.push({ x, y });
        }
        y += y < targetY ? 1 : -1;
      }
    } else {
      // Move vertically first
      while (y !== targetY) {
        if (!room1.contains(x, y) && !room2.contains(x, y)) {
          path.push({ x, y });
        }
        y += y < targetY ? 1 : -1;
      }
      // Then horizontally
      while (x !== targetX) {
        if (!room1.contains(x, y) && !room2.contains(x, y)) {
          path.push({ x, y });
        }
        x += x < targetX ? 1 : -1;
      }
    }
    
    // Carve corridor into grid
    for (const tile of path) {
      if (this._getTile(tile.x, tile.y) === DUNGEON_TILE_TYPES.WALL) {
        this._setTile(tile.x, tile.y, DUNGEON_TILE_TYPES.FLOOR);
        
        // Wide corridors
        if (this.config.corridorWidth > 1) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (this._getTile(tile.x + dx, tile.y + dy) === DUNGEON_TILE_TYPES.WALL) {
                this._setTile(tile.x + dx, tile.y + dy, DUNGEON_TILE_TYPES.FLOOR);
              }
            }
          }
        }
      }
    }
    
    return new Corridor(room1, room2, path, this.nextCorridorId++);
  }
  
  /**
   * Add additional connections for loops
   * @private
   */
  _addLoops() {
    if (this.rooms.length < 3) return;
    
    // Try to add 1-2 extra connections
    const loopCount = 1 + Math.floor(Math.random() * 2);
    
    for (let i = 0; i < loopCount; i++) {
      // Find two unconnected rooms that are close
      let bestDist = Infinity;
      let bestPair = null;
      
      for (let a = 0; a < this.rooms.length; a++) {
        for (let b = a + 1; b < this.rooms.length; b++) {
          // Skip if already connected
          if (this.rooms[a].connections.includes(b)) continue;
          
          const dist = manhattanDistance(
            this.rooms[a].center.x,
            this.rooms[a].center.y,
            this.rooms[b].center.x,
            this.rooms[b].center.y
          );
          
          if (dist < bestDist) {
            bestDist = dist;
            bestPair = [a, b];
          }
        }
      }
      
      if (bestPair) {
        const corridor = this._createCorridor(
          this.rooms[bestPair[0]],
          this.rooms[bestPair[1]]
        );
        this.corridors.push(corridor);
        
        this.rooms[bestPair[0]].connections.push(bestPair[1]);
        this.rooms[bestPair[1]].connections.push(bestPair[0]);
      }
    }
  }
  
  /**
   * Place doors at room/corridor boundaries
   * @private
   */
  _placeDoors() {
    for (const room of this.rooms) {
      // Find corridor entry points
      const entryPoints = this._findRoomEntries(room);
      
      for (const entry of entryPoints) {
        if (Math.random() < this.config.doorChance) {
          this._setTile(entry.x, entry.y, DUNGEON_TILE_TYPES.DOOR);
          room.doors.push(entry);
          
          // Track in corridor
          for (const corridor of this.corridors) {
            const idx = corridor.path.findIndex(p => p.x === entry.x && p.y === entry.y);
            if (idx !== -1) {
              corridor.doors.push(entry);
            }
          }
        }
      }
    }
  }
  
  /**
   * Find corridor entry points for a room
   * @private
   * @param {Room} room - Room to check
   * @returns {Array<{x: number, y: number}>}
   */
  _findRoomEntries(room) {
    const entries = [];
    const checked = new Set();
    
    for (const tile of room.getTiles()) {
      // Check 4 neighbors
      const neighbors = [
        { x: tile.x - 1, y: tile.y },
        { x: tile.x + 1, y: tile.y },
        { x: tile.x, y: tile.y - 1 },
        { x: tile.x, y: tile.y + 1 }
      ];
      
      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.y}`;
        if (checked.has(key)) continue;
        checked.add(key);
        
        // Entry point = walkable tile outside room adjacent to room
        if (!room.contains(neighbor.x, neighbor.y) &&
            this._getTile(neighbor.x, neighbor.y) === DUNGEON_TILE_TYPES.FLOOR) {
          entries.push(neighbor);
        }
      }
    }
    
    return entries;
  }
  
  /**
   * Mark room interior tiles
   * @private
   */
  _markRoomInteriors() {
    for (const room of this.rooms) {
      for (const tile of room.getTiles()) {
        const current = this._getTile(tile.x, tile.y);
        // Only mark floor tiles (not doors)
        if (current === DUNGEON_TILE_TYPES.FLOOR) {
          this._setTile(tile.x, tile.y, DUNGEON_TILE_TYPES.FLOOR_ROOM);
        }
      }
    }
  }
  
  /**
   * Mark corridor tiles
   * @private
   */
  _markCorridors() {
    for (const corridor of this.corridors) {
      for (const tile of corridor.path) {
        const current = this._getTile(tile.x, tile.y);
        // Only mark floor tiles (not doors or room floors)
        if (current === DUNGEON_TILE_TYPES.FLOOR) {
          this._setTile(tile.x, tile.y, DUNGEON_TILE_TYPES.FLOOR_CORRIDOR);
        }
      }
    }
  }
  
  /**
   * Convert dungeon grid to obstacle array for compatibility
   * @returns {Array<{x: number, y: number}>}
   */
  toObstacleArray() {
    const obstacles = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this._getTile(x, y);
        if (tile === DUNGEON_TILE_TYPES.WALL) {
          obstacles.push({ x, y });
        }
      }
    }
    return obstacles;
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Generate a dungeon layout
 * @param {Object} config - Configuration options
 * @returns {Object} Generated dungeon
 */
export function generateDungeon(config = {}) {
  const generator = new DungeonGenerator(config);
  return generator.generate();
}

// ==================== EXPORTS ====================
export default {
  DungeonGenerator,
  Room,
  Corridor,
  DUNGEON_CONFIG,
  generateDungeon
};
