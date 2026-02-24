#!/usr/bin/env node
/**
 * GhostShift Room Layout Helper
 * Utilities for creating rooms-and-corridors based map layouts
 */

/**
 * Create a rectangular room with walls and optional door
 * @param {number} x - Top-left X coordinate
 * @param {number} y - Top-left Y coordinate  
 * @param {number} width - Room width in tiles
 * @param {number} height - Room height in tiles
 * @param {Object} options - Door configuration
 * @returns {Array} Array of wall obstacle coordinates
 */
export function createRoom(x, y, width, height, options = {}) {
  const obstacles = [];
  const {
    doorTop = false,
    doorBottom = false,
    doorLeft = false,
    doorRight = false,
    doorOffsetTop = Math.floor(width / 2),
    doorOffsetBottom = Math.floor(width / 2),
    doorOffsetLeft = Math.floor(height / 2),
    doorOffsetRight = Math.floor(height / 2),
    doorWidthTop = 1,
    doorWidthBottom = 1,
    doorWidthLeft = 1,
    doorWidthRight = 1
  } = options;

  // Top wall
  for (let dx = 0; dx < width; dx++) {
    const isDoor = doorTop && dx >= doorOffsetTop && dx < doorOffsetTop + doorWidthTop;
    if (!isDoor) {
      obstacles.push({x: x + dx, y: y});
    }
  }

  // Bottom wall
  for (let dx = 0; dx < width; dx++) {
    const isDoor = doorBottom && dx >= doorOffsetBottom && dx < doorOffsetBottom + doorWidthBottom;
    if (!isDoor) {
      obstacles.push({x: x + dx, y: y + height - 1});
    }
  }

  // Left wall
  for (let dy = 0; dy < height; dy++) {
    const isDoor = doorLeft && dy >= doorOffsetLeft && dy < doorOffsetLeft + doorWidthLeft;
    if (!isDoor) {
      obstacles.push({x: x, y: y + dy});
    }
  }

  // Right wall
  for (let dy = 0; dy < height; dy++) {
    const isDoor = doorRight && dy >= doorOffsetRight && dy < doorOffsetRight + doorWidthRight;
    if (!isDoor) {
      obstacles.push({x: x + width - 1, y: y + dy});
    }
  }

  return obstacles;
}

/**
 * Create a horizontal corridor wall (top or bottom)
 * @param {number} x1 - Start X coordinate
 * @param {number} x2 - End X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} options - Gap configuration
 * @returns {Array} Array of wall obstacle coordinates
 */
export function createHorizontalWall(x1, x2, y, options = {}) {
  const obstacles = [];
  const {
    gaps = [] // Array of {start, width} for door gaps
  } = options;

  for (let x = x1; x <= x2; x++) {
    const isGap = gaps.some(gap => x >= gap.start && x < gap.start + gap.width);
    if (!isGap) {
      obstacles.push({x, y});
    }
  }

  return obstacles;
}

/**
 * Create a vertical corridor wall (left or right)
 * @param {number} y1 - Start Y coordinate
 * @param {number} y2 - End Y coordinate
 * @param {number} x - X coordinate
 * @param {Object} options - Gap configuration
 * @returns {Array} Array of wall obstacle coordinates
 */
export function createVerticalWall(y1, y2, x, options = {}) {
  const obstacles = [];
  const {
    gaps = [] // Array of {start, width} for door gaps
  } = options;

  for (let y = y1; y <= y2; y++) {
    const isGap = gaps.some(gap => y >= gap.start && y < gap.start + gap.width);
    if (!isGap) {
      obstacles.push({x, y});
    }
  }

  return obstacles;
}

/**
 * Create a T-junction corridor intersection
 * @param {number} x - Center X of junction
 * @param {number} y - Center Y of junction
 * @param {string} orientation - 'up', 'down', 'left', 'right'
 * @param {number} armLength - Length of each arm
 * @returns {Object} Junction metadata (no obstacles, junction is walkable)
 */
export function createTJunction(x, y, orientation, armLength = 3) {
  return {
    center: {x, y},
    orientation,
    armLength,
    type: 't-junction'
  };
}

/**
 * Get the center of a room for objective placement
 * @param {number} x - Room top-left X
 * @param {number} y - Room top-left Y
 * @param {number} width - Room width
 * @param {number} height - Room height
 * @returns {Object} Center coordinates {x, y}
 */
export function getRoomCenter(x, y, width, height) {
  return {
    x: x + Math.floor(width / 2),
    y: y + Math.floor(height / 2)
  };
}

/**
 * Validate room dimensions
 * @param {number} width - Room width
 * @param {number} height - Room height
 * @returns {boolean} True if dimensions are valid
 */
export function isValidRoom(width, height) {
  const MIN_SIZE = 3;
  const MAX_SIZE = 7;
  return width >= MIN_SIZE && height >= MIN_SIZE && 
         width <= MAX_SIZE && height <= MAX_SIZE;
}

/**
 * Create patrol waypoints along a corridor
 * @param {Array} corridorPath - Array of {x, y} points defining corridor path
 * @returns {Array} Patrol waypoints
 */
export function createCorridorPatrol(corridorPath) {
  return corridorPath.map(point => ({...point}));
}

/**
 * Merge multiple obstacle arrays into one
 * @param {...Array} obstacleArrays - Multiple arrays of obstacles
 * @returns {Array} Merged and deduplicated obstacles
 */
export function mergeObstacles(...obstacleArrays) {
  const seen = new Set();
  const merged = [];

  for (const arr of obstacleArrays) {
    for (const obs of arr) {
      const key = `${obs.x},${obs.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(obs);
      }
    }
  }

  return merged;
}

/**
 * Add padding around obstacles to ensure clearance
 * @param {Array} obstacles - Original obstacles
 * @param {number} padding - Padding tiles
 * @param {number} mapWidth - Map width limit
 * @param {number} mapHeight - Map height limit
 * @returns {Array} Padded obstacles
 */
export function padObstacles(obstacles, padding, mapWidth, mapHeight) {
  const padded = new Set();

  for (const obs of obstacles) {
    for (let dy = -padding; dy <= padding; dy++) {
      for (let dx = -padding; dx <= padding; dx++) {
        const newX = obs.x + dx;
        const newY = obs.y + dy;
        if (newX >= 0 && newX < mapWidth && newY >= 0 && newY < mapHeight) {
          padded.add(`${newX},${newY}`);
        }
      }
    }
  }

  return Array.from(padded).map(key => {
    const [x, y] = key.split(',').map(Number);
    return {x, y};
  });
}

// Export all utilities
export default {
  createRoom,
  createHorizontalWall,
  createVerticalWall,
  createTJunction,
  getRoomCenter,
  isValidRoom,
  createCorridorPatrol,
  mergeObstacles,
  padObstacles
};
