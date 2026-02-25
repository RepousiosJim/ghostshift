/**
 * NavGraph - Tile-derived navigation graph for GhostShift
 * 
 * Phase A: Core nav graph with semantic node types for intelligent enemy pathing.
 * 
 * Features:
 * - Tile-derived graph with node types (corridor, doorway, room interior, chokepoint)
 * - Connectivity analysis for path planning
 * - Room detection and boundary identification
 * - Chokepoint detection for tactical awareness
 * 
 * @module nav/NavGraph
 */

import { worldToTile, tileToWorld, isInBounds, TILE_SIZE } from '../tile/TileGrid.js';

// ==================== NODE TYPES ====================

export const NAV_NODE_TYPES = {
  CORRIDOR: 'corridor',         // Narrow passage (1-2 tile width)
  DOORWAY: 'doorway',           // Transition between rooms
  ROOM_INTERIOR: 'room_interior', // Open room area
  CHOKEPOINT: 'chokepoint',     // Strategic narrow point
  JUNCTION: 'junction',         // Intersection of multiple paths
  DEAD_END: 'dead_end',         // End of corridor (no exit except backtrack)
  WALL: 'wall'                  // Non-walkable (for reference)
};

export const NODE_TYPE_PRIORITIES = {
  [NAV_NODE_TYPES.CHOKEPOINT]: 3,    // Highest - tactical points
  [NAV_NODE_TYPES.DOORWAY]: 2,       // Room transitions
  [NAV_NODE_TYPES.JUNCTION]: 2,      // Decision points
  [NAV_NODE_TYPES.CORRIDOR]: 1,      // Standard movement
  [NAV_NODE_TYPES.ROOM_INTERIOR]: 1, // Standard movement
  [NAV_NODE_TYPES.DEAD_END]: 0       // Avoid unless necessary
};

// ==================== NAV GRAPH CONFIG ====================

export const NAV_GRAPH_CONFIG = {
  // Corridor detection thresholds
  corridorWidthMin: 1,           // Minimum width for corridor
  corridorWidthMax: 3,           // Maximum width for corridor
  roomMinArea: 16,               // Minimum tiles for room interior
  
  // Chokepoint detection
  chokepointWidth: 2,            // Max width for chokepoint
  chokepointMinNeighbors: 2,     // Must have connections on both sides
  
  // Junction detection
  junctionMinConnections: 3,     // Minimum connections for junction
  
  // Doorway detection
  doorwayWallProximity: 1,       // Tiles from wall to be considered doorway
  
  // Graph update
  updateInterval: 100,           // Ms between graph updates
  
  // Debug
  debug: false
};

// ==================== NAV NODE CLASS ====================

/**
 * Navigation node in the graph
 */
class NavNode {
  constructor(tx, ty, type = NAV_NODE_TYPES.CORRIDOR) {
    this.tx = tx;
    this.ty = ty;
    this.type = type;
    this.neighbors = new Map(); // key: "tx,ty", value: { node, cost }
    this.connections = 0;
    this.roomId = null;         // Assigned room ID if in room interior
    this.isWalkable = true;
    this.strategicValue = 0;    // Calculated strategic importance
    this.lastVisited = 0;       // Timestamp for patrol patterns
  }
  
  key() {
    return `${this.tx},${this.ty}`;
  }
  
  worldPos() {
    return tileToWorld(this.tx, this.ty);
  }
  
  addNeighbor(node, cost = 1) {
    const key = node.key();
    if (!this.neighbors.has(key)) {
      this.neighbors.set(key, { node, cost });
      this.connections = this.neighbors.size;
    }
  }
  
  removeNeighbor(node) {
    this.neighbors.delete(node.key());
    this.connections = this.neighbors.size;
  }
  
  getNeighborNodes() {
    return Array.from(this.neighbors.values()).map(n => n.node);
  }
  
  getNeighborCosts() {
    return Array.from(this.neighbors.values()).map(n => ({ node: n.node, cost: n.cost }));
  }
}

// ==================== NAV GRAPH CLASS ====================

/**
 * NavGraph - Navigation graph built from tile grid
 */
export class NavGraph {
  constructor(tileGrid, tileMetadata, config = {}) {
    this.grid = tileGrid;
    this.metadata = tileMetadata;
    this.config = { ...NAV_GRAPH_CONFIG, ...config };
    
    // Node storage
    this.nodes = new Map(); // key: "tx,ty", value: NavNode
    
    // Room tracking
    this.rooms = new Map(); // key: roomId, value: { bounds, nodes, doorways }
    this._nextRoomId = 1;
    
    // Statistics
    this._stats = {
      totalNodes: 0,
      corridors: 0,
      doorways: 0,
      roomInteriors: 0,
      chokepoints: 0,
      junctions: 0,
      deadEnds: 0
    };
    
    // Build initial graph
    this.buildGraph();
  }
  
  /**
   * Build navigation graph from tile grid
   */
  buildGraph() {
    this.nodes.clear();
    this.rooms.clear();
    this._nextRoomId = 1;
    
    // Phase 1: Create nodes for all walkable tiles
    this._createNodes();
    
    // Phase 2: Connect neighbors
    this._connectNeighbors();
    
    // Phase 3: Classify node types
    this._classifyNodes();
    
    // Phase 4: Detect rooms
    this._detectRooms();
    
    // Phase 5: Identify chokepoints and doorways
    this._identifyStrategicPoints();
    
    // Update statistics
    this._updateStats();
    
    if (this.config.debug) {
      console.log('[NavGraph] Built graph:', this._stats);
    }
  }
  
  /**
   * Create nodes for all walkable tiles
   * @private
   */
  _createNodes() {
    for (let ty = 0; ty < this.grid.height; ty++) {
      for (let tx = 0; tx < this.grid.width; tx++) {
        if (this.metadata.canEnemyWalk(tx, ty)) {
          const node = new NavNode(tx, ty);
          this.nodes.set(node.key(), node);
        }
      }
    }
  }
  
  /**
   * Connect neighboring nodes
   * @private
   */
  _connectNeighbors() {
    const directions = [
      { dx: 0, dy: -1, cost: 1 },   // Up
      { dx: 0, dy: 1, cost: 1 },    // Down
      { dx: -1, dy: 0, cost: 1 },   // Left
      { dx: 1, dy: 0, cost: 1 },    // Right
      { dx: -1, dy: -1, cost: 1.414 }, // Diagonals
      { dx: 1, dy: -1, cost: 1.414 },
      { dx: -1, dy: 1, cost: 1.414 },
      { dx: 1, dy: 1, cost: 1.414 }
    ];
    
    for (const [key, node] of this.nodes) {
      for (const dir of directions) {
        const neighborKey = `${node.tx + dir.dx},${node.ty + dir.dy}`;
        const neighbor = this.nodes.get(neighborKey);
        
        if (neighbor) {
          // For diagonals, check we're not cutting corners
          if (dir.dx !== 0 && dir.dy !== 0) {
            const adj1 = this.nodes.get(`${node.tx + dir.dx},${node.ty}`);
            const adj2 = this.nodes.get(`${node.tx},${node.ty + dir.dy}`);
            if (!adj1 || !adj2) continue;
          }
          
          node.addNeighbor(neighbor, dir.cost);
        }
      }
    }
  }
  
  /**
   * Classify node types based on local geometry
   * @private
   */
  _classifyNodes() {
    for (const [key, node] of this.nodes) {
      node.type = this._classifyNode(node);
    }
  }
  
  /**
   * Classify a single node's type
   * @param {NavNode} node
   * @returns {string} Node type
   * @private
   */
  _classifyNode(node) {
    const { tx, ty } = node;
    const connections = node.connections;
    
    // Dead end: only one way in/out
    if (connections === 1) {
      return NAV_NODE_TYPES.DEAD_END;
    }
    
    // Junction: multiple paths converge
    if (connections >= this.config.junctionMinConnections) {
      return NAV_NODE_TYPES.JUNCTION;
    }
    
    // Calculate local width (horizontal and vertical)
    const horizWidth = this._measureWidth(tx, ty, 'horizontal');
    const vertWidth = this._measureWidth(tx, ty, 'vertical');
    const minWidth = Math.min(horizWidth, vertWidth);
    const maxWidth = Math.max(horizWidth, vertWidth);
    
    // Corridor: narrow in at least one dimension
    if (minWidth <= this.config.corridorWidthMax && minWidth >= this.config.corridorWidthMin) {
      return NAV_NODE_TYPES.CORRIDOR;
    }
    
    // Check for doorway: narrow transition between open areas
    const isDoorway = this._checkDoorway(tx, ty, horizWidth, vertWidth);
    if (isDoorway) {
      return NAV_NODE_TYPES.DOORWAY;
    }
    
    // Default to room interior for open areas
    return NAV_NODE_TYPES.ROOM_INTERIOR;
  }
  
  /**
   * Measure width of walkable area in a direction
   * @param {number} tx
   * @param {number} ty
   * @param {string} direction - 'horizontal' or 'vertical'
   * @returns {number} Width in tiles
   * @private
   */
  _measureWidth(tx, ty, direction) {
    let width = 1;
    
    if (direction === 'horizontal') {
      // Measure left
      for (let x = tx - 1; x >= 0; x--) {
        if (this.metadata.canEnemyWalk(x, ty)) width++;
        else break;
      }
      // Measure right
      for (let x = tx + 1; x < this.grid.width; x++) {
        if (this.metadata.canEnemyWalk(x, ty)) width++;
        else break;
      }
    } else {
      // Measure up
      for (let y = ty - 1; y >= 0; y--) {
        if (this.metadata.canEnemyWalk(tx, y)) width++;
        else break;
      }
      // Measure down
      for (let y = ty + 1; y < this.grid.height; y++) {
        if (this.metadata.canEnemyWalk(tx, y)) width++;
        else break;
      }
    }
    
    return width;
  }
  
  /**
   * Check if position is a doorway (narrow transition between open areas)
   * @private
   */
  _checkDoorway(tx, ty, horizWidth, vertWidth) {
    // Doorway: narrow in one dimension, open in perpendicular direction
    const isNarrowHoriz = horizWidth <= 3;
    const isOpenVert = vertWidth >= 4;
    const isNarrowVert = vertWidth <= 3;
    const isOpenHoriz = horizWidth >= 4;
    
    // Also check wall proximity on both sides of narrow dimension
    const wallProximity = this.config.doorwayWallProximity;
    
    if (isNarrowHoriz && isOpenVert) {
      // Check walls on left and right
      const leftWall = !this.metadata.canEnemyWalk(tx - wallProximity - 1, ty);
      const rightWall = !this.metadata.canEnemyWalk(tx + wallProximity + 1, ty);
      return leftWall || rightWall;
    }
    
    if (isNarrowVert && isOpenHoriz) {
      // Check walls above and below
      const topWall = !this.metadata.canEnemyWalk(tx, ty - wallProximity - 1);
      const bottomWall = !this.metadata.canEnemyWalk(tx, ty + wallProximity + 1);
      return topWall || bottomWall;
    }
    
    return false;
  }
  
  /**
   * Detect room interiors using flood fill
   * @private
   */
  _detectRooms() {
    const visited = new Set();
    
    for (const [key, node] of this.nodes) {
      if (visited.has(key)) continue;
      if (node.type !== NAV_NODE_TYPES.ROOM_INTERIOR) continue;
      
      // Flood fill to find connected room interior
      const roomNodes = this._floodFillRoom(node, visited);
      
      if (roomNodes.length >= this.config.roomMinArea) {
        const roomId = this._nextRoomId++;
        const room = this._createRoom(roomId, roomNodes);
        this.rooms.set(roomId, room);
        
        // Assign room ID to nodes
        for (const rn of roomNodes) {
          rn.roomId = roomId;
        }
      }
    }
  }
  
  /**
   * Flood fill to find connected room interior nodes
   * @private
   */
  _floodFillRoom(startNode, visited) {
    const roomNodes = [];
    const queue = [startNode];
    
    while (queue.length > 0) {
      const node = queue.shift();
      const key = node.key();
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      // Only include room interior nodes (not corridors, doorways)
      if (node.type === NAV_NODE_TYPES.ROOM_INTERIOR || node.type === NAV_NODE_TYPES.JUNCTION) {
        roomNodes.push(node);
        
        // Expand to neighbors of same type
        for (const { node: neighbor } of node.getNeighborCosts()) {
          if (!visited.has(neighbor.key()) && 
              (neighbor.type === NAV_NODE_TYPES.ROOM_INTERIOR || neighbor.type === NAV_NODE_TYPES.JUNCTION)) {
            queue.push(neighbor);
          }
        }
      }
    }
    
    return roomNodes;
  }
  
  /**
   * Create room object from nodes
   * @private
   */
  _createRoom(roomId, nodes) {
    // Calculate bounds
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const node of nodes) {
      minX = Math.min(minX, node.tx);
      minY = Math.min(minY, node.ty);
      maxX = Math.max(maxX, node.tx);
      maxY = Math.max(maxY, node.ty);
    }
    
    // Find doorways connected to this room
    const doorways = [];
    for (const node of nodes) {
      for (const { node: neighbor } of node.getNeighborCosts()) {
        if (neighbor.type === NAV_NODE_TYPES.DOORWAY && !doorways.includes(neighbor)) {
          doorways.push(neighbor);
        }
      }
    }
    
    return {
      id: roomId,
      bounds: { minX, minY, maxX, maxY },
      center: { tx: Math.floor((minX + maxX) / 2), ty: Math.floor((minY + maxY) / 2) },
      nodes,
      doorways,
      area: nodes.length
    };
  }
  
  /**
   * Identify strategic points (chokepoints, high-value junctions)
   * @private
   */
  _identifyStrategicPoints() {
    for (const [key, node] of this.nodes) {
      // Check for chokepoint: narrow passage with multiple paths through it
      if (node.type === NAV_NODE_TYPES.CORRIDOR || node.type === NAV_NODE_TYPES.DOORWAY) {
        const isChokepoint = this._checkChokepoint(node);
        if (isChokepoint) {
          node.type = NAV_NODE_TYPES.CHOKEPOINT;
        }
      }
      
      // Calculate strategic value
      node.strategicValue = this._calculateStrategicValue(node);
    }
  }
  
  /**
   * Check if node is a chokepoint
   * @private
   */
  _checkChokepoint(node) {
    const { tx, ty } = node;
    
    // Must be narrow
    const horizWidth = this._measureWidth(tx, ty, 'horizontal');
    const vertWidth = this._measureWidth(tx, ty, 'vertical');
    const minWidth = Math.min(horizWidth, vertWidth);
    
    if (minWidth > this.config.chokepointWidth) return false;
    
    // Must have connections on multiple sides
    const connections = this._getConnectionDirections(node);
    if (connections.size < this.config.chokepointMinNeighbors) return false;
    
    return true;
  }
  
  /**
   * Get set of connection directions for a node
   * @private
   */
  _getConnectionDirections(node) {
    const directions = new Set();
    
    for (const { node: neighbor } of node.getNeighborCosts()) {
      const dx = neighbor.tx - node.tx;
      const dy = neighbor.ty - node.ty;
      
      if (dy < 0) directions.add('north');
      if (dy > 0) directions.add('south');
      if (dx < 0) directions.add('west');
      if (dx > 0) directions.add('east');
    }
    
    return directions;
  }
  
  /**
   * Calculate strategic value of a node
   * @private
   */
  _calculateStrategicValue(node) {
    let value = NODE_TYPE_PRIORITIES[node.type] || 0;
    
    // Bonus for being near objectives (would need objective data)
    // Bonus for high connectivity
    value += node.connections * 0.1;
    
    // Bonus for being doorway or chokepoint
    if (node.type === NAV_NODE_TYPES.DOORWAY || node.type === NAV_NODE_TYPES.CHOKEPOINT) {
      value += 1;
    }
    
    return value;
  }
  
  /**
   * Update statistics
   * @private
   */
  _updateStats() {
    this._stats = {
      totalNodes: this.nodes.size,
      corridors: 0,
      doorways: 0,
      roomInteriors: 0,
      chokepoints: 0,
      junctions: 0,
      deadEnds: 0,
      rooms: this.rooms.size
    };
    
    for (const [key, node] of this.nodes) {
      switch (node.type) {
        case NAV_NODE_TYPES.CORRIDOR: this._stats.corridors++; break;
        case NAV_NODE_TYPES.DOORWAY: this._stats.doorways++; break;
        case NAV_NODE_TYPES.ROOM_INTERIOR: this._stats.roomInteriors++; break;
        case NAV_NODE_TYPES.CHOKEPOINT: this._stats.chokepoints++; break;
        case NAV_NODE_TYPES.JUNCTION: this._stats.junctions++; break;
        case NAV_NODE_TYPES.DEAD_END: this._stats.deadEnds++; break;
      }
    }
  }
  
  // ==================== PUBLIC API ====================
  
  /**
   * Get node at tile coordinates
   * @param {number} tx
   * @param {number} ty
   * @returns {NavNode|null}
   */
  getNode(tx, ty) {
    return this.nodes.get(`${tx},${ty}`) || null;
  }
  
  /**
   * Get node at world coordinates
   * @param {number} x
   * @param {number} y
   * @returns {NavNode|null}
   */
  getNodeAtWorld(x, y) {
    const { tx, ty } = worldToTile(x, y);
    return this.getNode(tx, ty);
  }
  
  /**
   * Get all nodes of a specific type
   * @param {string} type
   * @returns {NavNode[]}
   */
  getNodesByType(type) {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }
  
  /**
   * Get room by ID
   * @param {number} roomId
   * @returns {Object|null}
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }
  
  /**
   * Get room containing a tile
   * @param {number} tx
   * @param {number} ty
   * @returns {Object|null}
   */
  getRoomAt(tx, ty) {
    const node = this.getNode(tx, ty);
    if (node && node.roomId) {
      return this.rooms.get(node.roomId);
    }
    return null;
  }
  
  /**
   * Get all doorways
   * @returns {NavNode[]}
   */
  getDoorways() {
    return this.getNodesByType(NAV_NODE_TYPES.DOORWAY);
  }
  
  /**
   * Get all chokepoints
   * @returns {NavNode[]}
   */
  getChokepoints() {
    return this.getNodesByType(NAV_NODE_TYPES.CHOKEPOINT);
  }
  
  /**
   * Get junctions
   * @returns {NavNode[]}
   */
  getJunctions() {
    return this.getNodesByType(NAV_NODE_TYPES.JUNCTION);
  }
  
  /**
   * Get dead ends
   * @returns {NavNode[]}
   */
  getDeadEnds() {
    return this.getNodesByType(NAV_NODE_TYPES.DEAD_END);
  }
  
  /**
   * Find nearest node of a specific type
   * @param {number} tx
   * @param {number} ty
   * @param {string} type
   * @returns {NavNode|null}
   */
  findNearestNodeOfType(tx, ty, type) {
    const nodes = this.getNodesByType(type);
    if (nodes.length === 0) return null;
    
    let nearest = null;
    let nearestDist = Infinity;
    
    for (const node of nodes) {
      const dist = Math.abs(node.tx - tx) + Math.abs(node.ty - ty);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = node;
      }
    }
    
    return nearest;
  }
  
  /**
   * Check if a path exists between two nodes
   * @param {number} startTx
   * @param {number} startTy
   * @param {number} endTx
   * @param {number} endTy
   * @returns {boolean}
   */
  hasPath(startTx, startTy, endTx, endTy) {
    const start = this.getNode(startTx, startTy);
    const end = this.getNode(endTx, endTy);
    
    if (!start || !end) return false;
    
    // BFS to check connectivity
    const visited = new Set();
    const queue = [start];
    
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === end) return true;
      
      visited.add(current.key());
      
      for (const { node: neighbor } of current.getNeighborCosts()) {
        if (!visited.has(neighbor.key())) {
          queue.push(neighbor);
        }
      }
    }
    
    return false;
  }
  
  /**
   * Get nodes along a corridor (for lane sweep)
   * @param {number} tx
   * @param {number} ty
   * @returns {NavNode[]}
   */
  getCorridorNodes(tx, ty) {
    const start = this.getNode(tx, ty);
    if (!start || start.type !== NAV_NODE_TYPES.CORRIDOR) return [];
    
    const corridorNodes = [];
    const visited = new Set();
    const queue = [start];
    
    while (queue.length > 0) {
      const node = queue.shift();
      if (visited.has(node.key())) continue;
      visited.add(node.key());
      
      if (node.type === NAV_NODE_TYPES.CORRIDOR || node.type === NAV_NODE_TYPES.CHOKEPOINT) {
        corridorNodes.push(node);
        
        for (const { node: neighbor } of node.getNeighborCosts()) {
          if (!visited.has(neighbor.key())) {
            queue.push(neighbor);
          }
        }
      }
    }
    
    return corridorNodes;
  }
  
  /**
   * Get statistics
   * @returns {Object}
   */
  getStats() {
    return { ...this._stats };
  }
  
  /**
   * Debug: Visualize graph (returns data for rendering)
   * @returns {Object}
   */
  debugVisualize() {
    const nodes = [];
    const edges = [];
    
    for (const [key, node] of this.nodes) {
      const world = node.worldPos();
      nodes.push({
        x: world.x,
        y: world.y,
        tx: node.tx,
        ty: node.ty,
        type: node.type,
        connections: node.connections,
        strategicValue: node.strategicValue,
        roomId: node.roomId
      });
      
      for (const { node: neighbor, cost } of node.getNeighborCosts()) {
        // Only add each edge once
        if (node.key() < neighbor.key()) {
          const neighborWorld = neighbor.worldPos();
          edges.push({
            x1: world.x, y1: world.y,
            x2: neighborWorld.x, y2: neighborWorld.y,
            cost
          });
        }
      }
    }
    
    const rooms = Array.from(this.rooms.values()).map(r => ({
      id: r.id,
      bounds: r.bounds,
      center: r.center,
      area: r.area,
      doorwayCount: r.doorways.length
    }));
    
    return { nodes, edges, rooms };
  }
}

export { NavNode };
export default NavGraph;
