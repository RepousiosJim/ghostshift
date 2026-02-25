/**
 * RoomSweepGenerator - Room sweep route generator for GhostShift
 * 
 * Phase A: Systematic room search pattern generation.
 * 
 * Pattern: doorway -> corners -> center -> exit
 * Optimized for thorough room clearing behavior.
 * 
 * @module nav/RoomSweepGenerator
 */

import { worldToTile, tileToWorld, isInBounds } from '../tile/TileGrid.js';
import { NavGraph, NAV_NODE_TYPES } from './NavGraph.js';

// ==================== ROOM SWEEP CONFIG ====================

export const ROOM_SWEEP_CONFIG = {
  // Corner detection
  cornerSearchRadius: 3,         // Tiles to search for corners
  
  // Sweep pattern
  includeCorners: true,          // Include corner checks
  includeCenter: true,           // Include center point
  includeDoorways: true,         // Check all doorways
  includePerimeter: false,       // Walk full perimeter (optional)
  
  // Priorities
  cornerPriority: 1.2,           // Priority for corner points
  centerPriority: 1.0,           // Priority for center point
  doorwayPriority: 1.5,          // Priority for doorway checks
  
  // Limits
  maxPointsPerSweep: 20,         // Maximum points in sweep pattern
  
  // Debug
  debug: false
};

// ==================== SWEEP PATTERN TYPES ====================

export const SWEEP_TYPES = {
  STANDARD: 'standard',          // doorway -> corners -> center -> exit
  PERIMETER: 'perimeter',        // Walk full perimeter
  SPIRAL: 'spiral',              // Spiral inward from edges
  CROSS: 'cross'                 // Cross pattern through center
};

// ==================== ROOM SWEEP CLASS ====================

/**
 * RoomSweepGenerator - Generates room sweep patterns
 */
export class RoomSweepGenerator {
  constructor(navGraph, tileMetadata, config = {}) {
    this.navGraph = navGraph;
    this.metadata = tileMetadata;
    this.config = { ...ROOM_SWEEP_CONFIG, ...config };
  }
  
  /**
   * Generate a standard room sweep pattern
   * Pattern: entry_doorway -> corners -> center -> exit_doorway
   * 
   * @param {number} roomRoomId - Room ID from NavGraph
   * @param {number} entryTx - Entry tile X (doorway we're coming from)
   * @param {number} entryTy - Entry tile Y
   * @returns {Object} Sweep pattern with points array
   */
  generateStandardSweep(roomId, entryTx = null, entryTy = null) {
    const room = this.navGraph.getRoom(roomId);
    if (!room) {
      return this._emptySweep('standard');
    }
    
    const points = [];
    
    // 1. Entry doorway (if specified)
    if (entryTx !== null && entryTy !== null) {
      points.push(this._createPoint(entryTx, entryTy, 'entry', this.config.doorwayPriority));
    }
    
    // 2. Find all corners
    if (this.config.includeCorners) {
      const corners = this._findRoomCorners(room);
      for (const corner of corners) {
        points.push(this._createPoint(corner.tx, corner.ty, 'corner', this.config.cornerPriority));
      }
    }
    
    // 3. Center point
    if (this.config.includeCenter) {
      points.push(this._createPoint(room.center.tx, room.center.ty, 'center', this.config.centerPriority));
    }
    
    // 4. Other doorways (potential exits)
    if (this.config.includeDoorways) {
      for (const doorway of room.doorways) {
        // Skip entry doorway
        if (entryTx !== null && entryTy !== null && 
            doorway.tx === entryTx && doorway.ty === entryTy) {
          continue;
        }
        points.push(this._createPoint(doorway.tx, doorway.ty, 'exit', this.config.doorwayPriority));
      }
    }
    
    // Sort points: entry first, then corners, center, then exits
    const sortedPoints = this._sortSweepPoints(points);
    
    // Limit points
    const limitedPoints = sortedPoints.slice(0, this.config.maxPointsPerSweep);
    
    if (this.config.debug) {
      console.log(`[RoomSweepGenerator] Standard sweep for room ${roomId}: ${limitedPoints.length} points`);
    }
    
    return {
      type: SWEEP_TYPES.STANDARD,
      roomId,
      roomBounds: room.bounds,
      points: limitedPoints,
      entryPoint: { tx: entryTx, ty: entryTy },
      expectedDuration: this._estimateDuration(limitedPoints)
    };
  }
  
  /**
   * Generate perimeter sweep pattern
   * Walks the full perimeter of the room
   * 
   * @param {number} roomId - Room ID
   * @returns {Object} Sweep pattern
   */
  generatePerimeterSweep(roomId) {
    const room = this.navGraph.getRoom(roomId);
    if (!room) {
      return this._emptySweep('perimeter');
    }
    
    const points = [];
    const { minX, minY, maxX, maxY } = room.bounds;
    
    // Walk perimeter clockwise from top-left
    // Top edge
    for (let x = minX; x <= maxX; x++) {
      this._addIfWalkable(points, x, minY, 'perimeter', 0.8);
    }
    
    // Right edge
    for (let y = minY + 1; y <= maxY; y++) {
      this._addIfWalkable(points, maxX, y, 'perimeter', 0.8);
    }
    
    // Bottom edge
    for (let x = maxX - 1; x >= minX; x--) {
      this._addIfWalkable(points, x, maxY, 'perimeter', 0.8);
    }
    
    // Left edge
    for (let y = maxY - 1; y >= minY + 1; y--) {
      this._addIfWalkable(points, minX, y, 'perimeter', 0.8);
    }
    
    // Add doorways as high priority
    for (const doorway of room.doorways) {
      points.push(this._createPoint(doorway.tx, doorway.ty, 'doorway', this.config.doorwayPriority));
    }
    
    const limitedPoints = points.slice(0, this.config.maxPointsPerSweep);
    
    return {
      type: SWEEP_TYPES.PERIMETER,
      roomId,
      roomBounds: room.bounds,
      points: limitedPoints,
      expectedDuration: this._estimateDuration(limitedPoints)
    };
  }
  
  /**
   * Generate spiral sweep pattern
   * Spirals inward from room edges
   * 
   * @param {number} roomId - Room ID
   * @returns {Object} Sweep pattern
   */
  generateSpiralSweep(roomId) {
    const room = this.navGraph.getRoom(roomId);
    if (!room) {
      return this._emptySweep('spiral');
    }
    
    const points = [];
    const { minX, minY, maxX, maxY } = room.bounds;
    const centerX = Math.floor((minX + maxX) / 2);
    const centerY = Math.floor((minY + maxY) / 2);
    
    // Spiral outward from center
    let x = centerX;
    let y = centerY;
    let dx = 0;
    let dy = -1;
    const maxRadius = Math.max(maxX - minX, maxY - minY);
    
    for (let i = 0; i < maxRadius * maxRadius * 2; i++) {
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        this._addIfWalkable(points, x, y, 'spiral', 1);
      }
      
      // Spiral direction change
      if (x === y || (x < centerY && x === -y) || (x > centerY && x === -y + 1)) {
        const temp = dx;
        dx = -dy;
        dy = temp;
      }
      
      x += dx;
      y += dy;
      
      if (points.length >= this.config.maxPointsPerSweep) break;
    }
    
    // Add doorways
    for (const doorway of room.doorways) {
      // Check if not already in spiral
      if (!points.some(p => p.tx === doorway.tx && p.ty === doorway.ty)) {
        points.push(this._createPoint(doorway.tx, doorway.ty, 'doorway', this.config.doorwayPriority));
      }
    }
    
    return {
      type: SWEEP_TYPES.SPIRAL,
      roomId,
      roomBounds: room.bounds,
      points,
      expectedDuration: this._estimateDuration(points)
    };
  }
  
  /**
   * Generate cross sweep pattern
   * Cross pattern through center
   * 
   * @param {number} roomId - Room ID
   * @returns {Object} Sweep pattern
   */
  generateCrossSweep(roomId) {
    const room = this.navGraph.getRoom(roomId);
    if (!room) {
      return this._emptySweep('cross');
    }
    
    const points = [];
    const { minX, minY, maxX, maxY } = room.bounds;
    const centerX = Math.floor((minX + maxX) / 2);
    const centerY = Math.floor((minY + maxY) / 2);
    
    // Horizontal line
    for (let x = minX; x <= maxX; x++) {
      this._addIfWalkable(points, x, centerY, 'cross_h', 0.9);
    }
    
    // Vertical line
    for (let y = minY; y <= maxY; y++) {
      this._addIfWalkable(points, centerX, y, 'cross_v', 0.9);
    }
    
    // Add doorways
    for (const doorway of room.doorways) {
      if (!points.some(p => p.tx === doorway.tx && p.ty === doorway.ty)) {
        points.push(this._createPoint(doorway.tx, doorway.ty, 'doorway', this.config.doorwayPriority));
      }
    }
    
    return {
      type: SWEEP_TYPES.CROSS,
      roomId,
      roomBounds: room.bounds,
      points,
      expectedDuration: this._estimateDuration(points)
    };
  }
  
  /**
   * Get best sweep pattern for a room based on room characteristics
   * 
   * @param {number} roomId - Room ID
   * @param {Object} context - Context { entryTx, entryTy, urgency }
   * @returns {Object} Best sweep pattern
   */
  getBestSweep(roomId, context = {}) {
    const room = this.navGraph.getRoom(roomId);
    if (!room) {
      return this._emptySweep('standard');
    }
    
    // Choose pattern based on room size and shape
    const { minX, minY, maxX, maxY } = room.bounds;
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const area = room.area;
    
    // Small rooms: standard sweep is sufficient
    if (area < 25) {
      return this.generateStandardSweep(roomId, context.entryTx, context.entryTy);
    }
    
    // Large rooms: use perimeter or cross for efficiency
    if (area >= 50) {
      // Very large: perimeter first
      if (width > 8 || height > 8) {
        return this.generatePerimeterSweep(roomId);
      }
      // Medium-large: cross pattern
      return this.generateCrossSweep(roomId);
    }
    
    // Medium rooms: spiral for thorough search
    if (context.urgency === 'high') {
      // Urgent: cross pattern for speed
      return this.generateCrossSweep(roomId);
    }
    
    // Default: standard sweep
    return this.generateStandardSweep(roomId, context.entryTx, context.entryTy);
  }
  
  /**
   * Generate sweep from world coordinates
   * 
   * @param {number} worldX - World X position
   * @param {number} worldY - World Y position
   * @param {string} sweepType - Type of sweep (optional)
   * @returns {Object|null} Sweep pattern or null if not in a room
   */
  generateSweepFromWorld(worldX, worldY, sweepType = 'auto') {
    const { tx, ty } = worldToTile(worldX, worldY);
    const room = this.navGraph.getRoomAt(tx, ty);
    
    if (!room) return null;
    
    if (sweepType === 'auto') {
      return this.getBestSweep(room.id, { entryTx: tx, entryTy: ty });
    }
    
    switch (sweepType) {
      case SWEEP_TYPES.STANDARD:
        return this.generateStandardSweep(room.id, tx, ty);
      case SWEEP_TYPES.PERIMETER:
        return this.generatePerimeterSweep(room.id);
      case SWEEP_TYPES.SPIRAL:
        return this.generateSpiralSweep(room.id);
      case SWEEP_TYPES.CROSS:
        return this.generateCrossSweep(room.id);
      default:
        return this.generateStandardSweep(room.id, tx, ty);
    }
  }
  
  // ==================== HELPER METHODS ====================
  
  /**
   * Find corner points in a room
   * @private
   */
  _findRoomCorners(room) {
    const corners = [];
    const { minX, minY, maxX, maxY, nodes } = room;
    
    // Find nodes at or near each corner
    const cornerPositions = [
      { tx: minX, ty: minY, name: 'top-left' },
      { tx: maxX, ty: minY, name: 'top-right' },
      { tx: maxX, ty: maxY, name: 'bottom-right' },
      { tx: minX, ty: maxY, name: 'bottom-left' }
    ];
    
    for (const pos of cornerPositions) {
      // Find nearest walkable node to this corner
      const nearest = this._findNearestRoomNode(room, pos.tx, pos.ty);
      if (nearest) {
        corners.push({ ...nearest, name: pos.name });
      }
    }
    
    return corners;
  }
  
  /**
   * Find nearest node in room to a position
   * @private
   */
  _findNearestRoomNode(room, tx, ty) {
    let nearest = null;
    let nearestDist = Infinity;
    
    for (const node of room.nodes) {
      const dist = Math.abs(node.tx - tx) + Math.abs(node.ty - ty);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { tx: node.tx, ty: node.ty };
      }
    }
    
    return nearest;
  }
  
  /**
   * Create a sweep point
   * @private
   */
  _createPoint(tx, ty, role, priority = 1) {
    const world = tileToWorld(tx, ty);
    return {
      tx, ty,
      x: world.x,
      y: world.y,
      role,
      priority
    };
  }
  
  /**
   * Add point if walkable
   * @private
   */
  _addIfWalkable(points, tx, ty, role, priority) {
    if (!this.metadata.canEnemyWalk(tx, ty)) return;
    
    // Don't duplicate
    if (points.some(p => p.tx === tx && p.ty === ty)) return;
    
    points.push(this._createPoint(tx, ty, role, priority));
  }
  
  /**
   * Sort sweep points in optimal order
   * @private
   */
  _sortSweepPoints(points) {
    // Group by role
    const groups = {
      entry: [],
      corner: [],
      center: [],
      exit: []
    };
    
    for (const point of points) {
      if (groups[point.role]) {
        groups[point.role].push(point);
      }
    }
    
    // Sort corners in clockwise order from entry (or top-left)
    const corners = groups.corner;
    if (corners.length > 0) {
      const refPoint = groups.entry[0] || { tx: 0, ty: 0 };
      corners.sort((a, b) => {
        const angleA = Math.atan2(a.ty - refPoint.ty, a.tx - refPoint.tx);
        const angleB = Math.atan2(b.ty - refPoint.ty, b.tx - refPoint.tx);
        return angleA - angleB;
      });
    }
    
    // Combine in order: entry -> corners -> center -> exits
    const sorted = [];
    sorted.push(...groups.entry);
    sorted.push(...corners);
    if (groups.center.length > 0) sorted.push(groups.center[0]);
    sorted.push(...groups.exit);
    
    return sorted;
  }
  
  /**
   * Estimate sweep duration in ms
   * @private
   */
  _estimateDuration(points) {
    if (points.length <= 1) return 0;
    
    // Calculate total path distance
    let totalDist = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      totalDist += Math.sqrt(dx * dx + dy * dy);
    }
    
    // Assume average guard speed of 150 pixels/second
    const avgSpeed = 150;
    return (totalDist / avgSpeed) * 1000;
  }
  
  /**
   * Create empty sweep result
   * @private
   */
  _emptySweep(type) {
    return {
      type,
      roomId: null,
      roomBounds: null,
      points: [],
      expectedDuration: 0
    };
  }
}

export default RoomSweepGenerator;
