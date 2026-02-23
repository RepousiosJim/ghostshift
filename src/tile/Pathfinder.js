/**
 * Pathfinder - A* pathfinding on enemy-walkable tiles with caching
 * 
 * Phase A: Core pathfinding implementation for tile-locked navigation.
 * Features:
 * - A* algorithm with 8-directional movement
 * - Path caching with TTL
 * - Line-of-sight smoothing
 * - Dynamic obstacle avoidance
 * 
 * @module tile/Pathfinder
 */

import { TileGrid, worldToTile, tileToWorld, isInBounds, euclideanDistance } from './TileGrid.js';
import { TileMetadata, TERRAIN_COSTS } from './TileMetadata.js';

// ==================== PATHFINDER CONFIG ====================

export const PATHFINDER_CONFIG = {
  // Maximum nodes to explore before giving up
  maxIterations: 2000,
  
  // Path cache TTL in milliseconds
  cacheTTL: 5000,
  
  // Maximum cache size
  maxCacheSize: 100,
  
  // Enable 8-directional movement (includes diagonals)
  allowDiagonal: true,
  
  // Enable path smoothing (removes unnecessary waypoints)
  enableSmoothing: true,
  
  // Heuristic weight (1.0 = standard A*, >1.0 = weighted, faster but less optimal)
  heuristicWeight: 1.0,
  
  // Debug mode
  debug: false
};

// ==================== PRIORITY QUEUE ====================

/**
 * Simple binary heap priority queue for A*
 */
class PriorityQueue {
  constructor() {
    this.heap = [];
  }
  
  push(element, priority) {
    this.heap.push({ element, priority });
    this._bubbleUp(this.heap.length - 1);
  }
  
  pop() {
    if (this.heap.length === 0) return null;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._bubbleDown(0);
    }
    return min.element;
  }
  
  peek() {
    return this.heap.length > 0 ? this.heap[0].element : null;
  }
  
  isEmpty() {
    return this.heap.length === 0;
  }
  
  size() {
    return this.heap.length;
  }
  
  _bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].priority <= this.heap[index].priority) break;
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }
  
  _bubbleDown(index) {
    const length = this.heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;
      
      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === index) break;
      
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
}

// ==================== PATH NODE ====================

/**
 * Node in the pathfinding graph
 */
class PathNode {
  constructor(tx, ty) {
    this.tx = tx;
    this.ty = ty;
    this.g = 0; // Cost from start
    this.h = 0; // Heuristic cost to goal
    this.f = 0; // Total cost (g + h)
    this.parent = null;
  }
  
  key() {
    return `${this.tx},${this.ty}`;
  }
}

// ==================== PATHFINDER CLASS ====================

/**
 * Pathfinder - A* pathfinding implementation
 */
export class Pathfinder {
  /**
   * Create a new Pathfinder
   * @param {TileGrid} tileGrid - Tile grid reference
   * @param {TileMetadata} tileMetadata - Tile metadata reference
   * @param {Object} config - Optional config overrides
   */
  constructor(tileGrid, tileMetadata, config = {}) {
    this.grid = tileGrid;
    this.metadata = tileMetadata;
    this.config = { ...PATHFINDER_CONFIG, ...config };
    
    // Path cache: key = "startKey:endKey", value = {path, timestamp}
    this._cache = new Map();
    
    // Statistics
    this._stats = {
      pathsCalculated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averagePathLength: 0
    };
  }
  
  /**
   * Find path from start to goal (world coordinates)
   * @param {number} startX - Start world X
   * @param {number} startY - Start world Y
   * @param {number} goalX - Goal world X
   * @param {number} goalY - Goal world Y
   * @returns {Array<{x: number, y: number}>|null} Path as world coordinates or null
   */
  findPathWorld(startX, startY, goalX, goalY) {
    const start = worldToTile(startX, startY);
    const goal = worldToTile(goalX, goalY);
    const tilePath = this.findPath(start.tx, start.ty, goal.tx, goal.ty);
    
    if (!tilePath) return null;
    
    // Convert tile path to world coordinates
    return tilePath.map(tile => tileToWorld(tile.tx, tile.ty));
  }
  
  /**
   * Find path from start to goal (tile coordinates)
   * @param {number} startTx - Start tile X
   * @param {number} startTy - Start tile Y
   * @param {number} goalTx - Goal tile X
   * @param {number} goalTy - Goal tile Y
   * @returns {Array<{tx: number, ty: number}>|null} Path as tile coordinates or null
   */
  findPath(startTx, startTy, goalTx, goalTy) {
    // Check cache first
    const cacheKey = this._getCacheKey(startTx, startTy, goalTx, goalTy);
    const cached = this._getCachedPath(cacheKey);
    if (cached) {
      this._stats.cacheHits++;
      return cached;
    }
    this._stats.cacheMisses++;
    
    // Validate start and goal
    if (!this.metadata.canEnemyWalk(startTx, startTy)) {
      // Try to find nearest walkable tile
      const nearest = this.grid.findNearestWalkable(
        ...Object.values(tileToWorld(startTx, startTy)),
        'enemy'
      );
      if (nearest) {
        startTx = nearest.tx;
        startTy = nearest.ty;
      } else {
        return null;
      }
    }
    
    if (!this.metadata.canEnemyWalk(goalTx, goalTy)) {
      const nearest = this.grid.findNearestWalkable(
        ...Object.values(tileToWorld(goalTx, goalTy)),
        'enemy'
      );
      if (nearest) {
        goalTx = nearest.tx;
        goalTy = nearest.ty;
      } else {
        return null;
      }
    }
    
    // Run A*
    const path = this._astar(startTx, startTy, goalTx, goalTy);
    
    if (path) {
      // Apply smoothing if enabled
      let finalPath = path;
      if (this.config.enableSmoothing && path.length > 2) {
        finalPath = this._smoothPath(path);
      }
      
      // Cache the result
      this._cachePath(cacheKey, finalPath);
      
      // Update stats
      this._stats.pathsCalculated++;
      this._stats.averagePathLength = 
        (this._stats.averagePathLength * (this._stats.pathsCalculated - 1) + finalPath.length) 
        / this._stats.pathsCalculated;
      
      if (this.config.debug) {
        console.log(`[Pathfinder] Path found: ${finalPath.length} tiles`);
      }
    }
    
    return path;
  }
  
  /**
   * A* algorithm implementation
   * @private
   */
  _astar(startTx, startTy, goalTx, goalTy) {
    const openSet = new PriorityQueue();
    const closedSet = new Set();
    const allNodes = new Map();
    
    // Create start node
    const startNode = new PathNode(startTx, startTy);
    startNode.h = this._heuristic(startTx, startTy, goalTx, goalTy);
    startNode.f = startNode.h;
    openSet.push(startNode, startNode.f);
    allNodes.set(startNode.key(), startNode);
    
    let iterations = 0;
    
    while (!openSet.isEmpty() && iterations < this.config.maxIterations) {
      iterations++;
      
      const current = openSet.pop();
      const currentKey = current.key();
      
      // Check if reached goal
      if (current.tx === goalTx && current.ty === goalTy) {
        return this._reconstructPath(current);
      }
      
      closedSet.add(currentKey);
      
      // Get neighbors
      const neighbors = this.config.allowDiagonal
        ? this.grid.getNeighbors8(current.tx, current.ty, 'enemy')
        : this.grid.getNeighbors4(current.tx, current.ty, 'enemy').map(n => ({ ...n, cost: 1 }));
      
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.tx},${neighbor.ty}`;
        
        if (closedSet.has(neighborKey)) continue;
        
        // Get movement cost from metadata
        const terrainCost = this.metadata.getEnemyCost(neighbor.tx, neighbor.ty);
        const moveCost = neighbor.cost * terrainCost;
        
        const tentativeG = current.g + moveCost;
        
        // Check if this path is better
        let neighborNode = allNodes.get(neighborKey);
        
        if (!neighborNode) {
          neighborNode = new PathNode(neighbor.tx, neighbor.ty);
          neighborNode.h = this._heuristic(neighbor.tx, neighbor.ty, goalTx, goalTy);
          allNodes.set(neighborKey, neighborNode);
        }
        
        if (tentativeG < neighborNode.g || neighborNode.g === 0) {
          neighborNode.parent = current;
          neighborNode.g = tentativeG;
          neighborNode.f = neighborNode.g + neighborNode.h * this.config.heuristicWeight;
          
          // Add to open set
          openSet.push(neighborNode, neighborNode.f);
        }
      }
    }
    
    // No path found
    if (this.config.debug) {
      console.warn(`[Pathfinder] No path found after ${iterations} iterations`);
    }
    return null;
  }
  
  /**
   * Heuristic function (octile distance for 8-directional movement)
   * @private
   */
  _heuristic(tx1, ty1, tx2, ty2) {
    const dx = Math.abs(tx2 - tx1);
    const dy = Math.abs(ty2 - ty1);
    // Octile distance: allows for diagonal movement
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  }
  
  /**
   * Reconstruct path from goal node
   * @private
   */
  _reconstructPath(goalNode) {
    const path = [];
    let current = goalNode;
    
    while (current) {
      path.unshift({ tx: current.tx, ty: current.ty });
      current = current.parent;
    }
    
    return path;
  }
  
  /**
   * Smooth path using line-of-sight checks
   * Removes waypoints that can be skipped with direct line of sight
   * @private
   */
  _smoothPath(path) {
    if (path.length <= 2) return path;
    
    const smoothed = [path[0]];
    let current = 0;
    
    while (current < path.length - 1) {
      // Find furthest visible waypoint
      let furthest = current + 1;
      
      for (let i = path.length - 1; i > current + 1; i--) {
        if (this._hasLineOfSight(path[current], path[i])) {
          furthest = i;
          break;
        }
      }
      
      smoothed.push(path[furthest]);
      current = furthest;
    }
    
    return smoothed;
  }
  
  /**
   * Check if there's line of sight between two tiles (Bresenham)
   * @private
   */
  _hasLineOfSight(from, to) {
    let x0 = from.tx;
    let y0 = from.ty;
    const x1 = to.tx;
    const y1 = to.ty;
    
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    
    while (x0 !== x1 || y0 !== y1) {
      // Check current tile
      if (this.metadata.blocksLineOfSight(x0, y0)) {
        return false;
      }
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    
    return true;
  }
  
  // ==================== CACHE METHODS ====================
  
  _getCacheKey(startTx, startTy, goalTx, goalTy) {
    return `${startTx},${startTy}:${goalTx},${goalTy}`;
  }
  
  _getCachedPath(key) {
    const cached = this._cache.get(key);
    if (!cached) return null;
    
    // Check TTL
    if (Date.now() - cached.timestamp > this.config.cacheTTL) {
      this._cache.delete(key);
      return null;
    }
    
    // Return a copy to prevent mutation
    return cached.path.map(p => ({ ...p }));
  }
  
  _cachePath(key, path) {
    // Enforce max cache size
    if (this._cache.size >= this.config.maxCacheSize) {
      // Remove oldest entries
      const keys = Array.from(this._cache.keys());
      for (let i = 0; i < Math.floor(this.config.maxCacheSize * 0.3); i++) {
        this._cache.delete(keys[i]);
      }
    }
    
    this._cache.set(key, {
      path: path.map(p => ({ ...p })), // Store a copy
      timestamp: Date.now()
    });
  }
  
  /**
   * Clear the path cache
   */
  clearCache() {
    this._cache.clear();
  }
  
  /**
   * Invalidate paths involving a specific tile
   * @param {number} tx - Tile X
   * @param {number} ty - Tile Y
   */
  invalidateTile(tx, ty) {
    const tileKey = `${tx},${ty}`;
    for (const [key] of this._cache) {
      if (key.includes(tileKey)) {
        this._cache.delete(key);
      }
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  /**
   * Get pathfinding statistics
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      ...this._stats,
      cacheSize: this._cache.size,
      hitRate: this._stats.cacheHits / (this._stats.cacheHits + this._stats.cacheMisses) || 0
    };
  }
  
  /**
   * Check if a direct path exists (faster than full pathfinding)
   * @param {number} startTx - Start tile X
   * @param {number} startTy - Start tile Y
   * @param {number} goalTx - Goal tile X
   * @param {number} goalTy - Goal tile Y
   * @returns {boolean} True if direct line of sight exists
   */
  hasDirectPath(startTx, startTy, goalTx, goalTy) {
    return this._hasLineOfSight({ tx: startTx, ty: startTy }, { tx: goalTx, ty: goalTy });
  }
  
  /**
   * Get next waypoint in path (tile coordinates)
   * @param {Array} path - Path array
   * @param {number} currentTx - Current tile X
   * @param {number} currentTy - Current tile Y
   * @returns {{tx: number, ty: number}|null} Next waypoint or null
   */
  getNextWaypoint(path, currentTx, currentTy) {
    if (!path || path.length === 0) return null;
    
    // Find current position in path
    let currentIndex = -1;
    for (let i = 0; i < path.length; i++) {
      if (path[i].tx === currentTx && path[i].ty === currentTy) {
        currentIndex = i;
        break;
      }
    }
    
    // If not in path, find nearest
    if (currentIndex === -1) {
      let nearestDist = Infinity;
      for (let i = 0; i < path.length; i++) {
        const dist = Math.abs(path[i].tx - currentTx) + Math.abs(path[i].ty - currentTy);
        if (dist < nearestDist) {
          nearestDist = dist;
          currentIndex = i;
        }
      }
    }
    
    // Return next waypoint
    if (currentIndex < path.length - 1) {
      return path[currentIndex + 1];
    }
    
    return null;
  }
  
  /**
   * Simplify a path by removing redundant waypoints
   * @param {Array} path - Path array
   * @returns {Array} Simplified path
   */
  simplifyPath(path) {
    if (path.length <= 2) return path;
    
    const result = [path[0]];
    
    for (let i = 1; i < path.length - 1; i++) {
      const prev = result[result.length - 1];
      const curr = path[i];
      const next = path[i + 1];
      
      // Check if direction changes
      const dir1 = { x: Math.sign(curr.tx - prev.tx), y: Math.sign(curr.ty - prev.ty) };
      const dir2 = { x: Math.sign(next.tx - curr.tx), y: Math.sign(next.ty - curr.ty) };
      
      // Keep waypoint only if direction changes
      if (dir1.x !== dir2.x || dir1.y !== dir2.y) {
        result.push(curr);
      }
    }
    
    result.push(path[path.length - 1]);
    return result;
  }
}

// ==================== EXPORTS ====================
export { PriorityQueue };
export default Pathfinder;
