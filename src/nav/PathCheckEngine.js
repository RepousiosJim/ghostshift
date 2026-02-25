/**
 * PathCheckEngine - Search pattern generators for GhostShift enemy AI
 * 
 * Phase A: Pattern generators for intelligent search behavior.
 * 
 * Patterns:
 * - Lane sweep: Systematic corridor search
 * - Branch check: Junction branch exploration
 * - Expanding ring: Radial search from last known position
 * 
 * @module nav/PathCheckEngine
 */

import { worldToTile, tileToWorld, isInBounds, euclideanDistance } from '../tile/TileGrid.js';
import { NavGraph, NAV_NODE_TYPES } from './NavGraph.js';

// ==================== PATTERN CONFIG ====================

export const PATH_CHECK_CONFIG = {
  // Lane sweep
  laneSweepSpacing: 2,           // Tiles between sweep lanes
  laneSweepMaxWidth: 10,         // Maximum corridor width for lane sweep
  
  // Branch check
  branchCheckMaxDepth: 5,        // Maximum tiles to explore per branch
  branchCheckMinNodes: 3,        // Minimum nodes to consider a branch
  
  // Expanding ring
  ringInitialRadius: 2,          // Starting ring radius in tiles
  ringExpansionRate: 2,          // Tiles to expand per ring
  ringMaxRadius: 15,             // Maximum search radius
  ringPointsPerRing: 8,          // Points to check per ring
  ringPrioritizeWalkable: true,  // Skip non-walkable tiles
  
  // General
  patternTimeout: 10000,         // Ms before pattern times out
  maxPatternPoints: 50,          // Maximum points in a pattern
  
  // Debug
  debug: false
};

// ==================== PATTERN TYPES ====================

export const PATTERN_TYPES = {
  LANE_SWEEP: 'lane_sweep',
  BRANCH_CHECK: 'branch_check',
  EXPANDING_RING: 'expanding_ring',
  ROOM_SWEEP: 'room_sweep',
  CORRIDOR_SEARCH: 'corridor_search'
};

// ==================== SEARCH PATTERN CLASS ====================

/**
 * Represents a generated search pattern
 */
class SearchPattern {
  constructor(type, points, origin) {
    this.type = type;
    this.points = points; // Array of {tx, ty, x, y, priority}
    this.origin = origin; // {tx, ty} where pattern started
    this.currentIndex = 0;
    this.createdAt = Date.now();
    this.completed = false;
  }
  
  getNextPoint() {
    if (this.currentIndex >= this.points.length) {
      this.completed = true;
      return null;
    }
    return this.points[this.currentIndex++];
  }
  
  getCurrentPoint() {
    if (this.currentIndex >= this.points.length) return null;
    return this.points[this.currentIndex];
  }
  
  peekNextPoint() {
    if (this.currentIndex + 1 >= this.points.length) return null;
    return this.points[this.currentIndex + 1];
  }
  
  reset() {
    this.currentIndex = 0;
    this.completed = false;
  }
  
  getProgress() {
    return {
      current: this.currentIndex,
      total: this.points.length,
      percent: (this.currentIndex / this.points.length) * 100
    };
  }
}

// ==================== PATH CHECK ENGINE CLASS ====================

/**
 * PathCheckEngine - Generates search patterns for enemy AI
 */
export class PathCheckEngine {
  constructor(navGraph, tileMetadata, config = {}) {
    this.navGraph = navGraph;
    this.metadata = tileMetadata;
    this.config = { ...PATH_CHECK_CONFIG, ...config };
    
    // Active patterns tracking
    this._activePatterns = new Map(); // agentId -> SearchPattern
    
    // Pattern history for analytics
    this._patternHistory = [];
    this._maxHistoryLength = 100;
  }
  
  // ==================== LANE SWEEP ====================
  
  /**
   * Generate lane sweep pattern for corridor search
   * Systematically sweeps along a corridor with perpendicular checks
   * 
   * @param {number} originTx - Starting tile X
   * @param {number} originTy - Starting tile Y
   * @param {string} direction - 'horizontal' or 'vertical' sweep direction
   * @returns {SearchPattern}
   */
  generateLaneSweep(originTx, originTy, direction = 'auto') {
    const originNode = this.navGraph.getNode(originTx, originTy);
    if (!originNode) {
      return new SearchPattern(PATTERN_TYPES.LANE_SWEEP, [], { tx: originTx, ty: originTy });
    }
    
    // Determine sweep direction based on corridor orientation
    if (direction === 'auto') {
      direction = this._determineCorridorDirection(originNode);
    }
    
    // Get corridor nodes
    const corridorNodes = this.navGraph.getCorridorNodes(originTx, originTy);
    if (corridorNodes.length === 0) {
      // Fallback to single point
      return new SearchPattern(PATTERN_TYPES.LANE_SWEEP, [
        this._createPatternPoint(originTx, originTy, 1)
      ], { tx: originTx, ty: originTy });
    }
    
    // Sort corridor nodes along sweep axis
    const sortedNodes = this._sortNodesByAxis(corridorNodes, direction);
    
    // Generate sweep points
    const points = [];
    const spacing = this.config.laneSweepSpacing;
    
    for (let i = 0; i < sortedNodes.length; i += spacing) {
      const node = sortedNodes[i];
      
      // Add primary sweep point
      points.push(this._createPatternPoint(node.tx, node.ty, 1));
      
      // Add perpendicular check points
      const perpPoints = this._getPerpendicularPoints(node, direction);
      for (const pp of perpPoints) {
        points.push(this._createPatternPoint(pp.tx, pp.ty, 0.7));
      }
    }
    
    // Deduplicate and limit
    const uniquePoints = this._deduplicatePoints(points);
    const limitedPoints = uniquePoints.slice(0, this.config.maxPatternPoints);
    
    if (this.config.debug) {
      console.log(`[PathCheckEngine] Lane sweep: ${limitedPoints.length} points`);
    }
    
    return new SearchPattern(PATTERN_TYPES.LANE_SWEEP, limitedPoints, { tx: originTx, ty: originTy });
  }
  
  /**
   * Determine corridor orientation
   * @private
   */
  _determineCorridorDirection(node) {
    // Check if corridor extends more horizontally or vertically
    let horizExtent = 0;
    let vertExtent = 0;
    
    // Count walkable tiles in each direction
    for (let dx = -5; dx <= 5; dx++) {
      if (this.metadata.canEnemyWalk(node.tx + dx, node.ty)) {
        horizExtent = Math.max(horizExtent, Math.abs(dx));
      }
    }
    
    for (let dy = -5; dy <= 5; dy++) {
      if (this.metadata.canEnemyWalk(node.tx, node.ty + dy)) {
        vertExtent = Math.max(vertExtent, Math.abs(dy));
      }
    }
    
    return horizExtent >= vertExtent ? 'horizontal' : 'vertical';
  }
  
  /**
   * Sort nodes by axis
   * @private
   */
  _sortNodesByAxis(nodes, direction) {
    return [...nodes].sort((a, b) => {
      if (direction === 'horizontal') {
        return a.tx - b.tx;
      }
      return a.ty - b.ty;
    });
  }
  
  /**
   * Get perpendicular check points
   * @private
   */
  _getPerpendicularPoints(node, direction) {
    const points = [];
    const checkDist = 2;
    
    if (direction === 'horizontal') {
      // Check up and down
      for (let dy = -checkDist; dy <= checkDist; dy++) {
        if (dy === 0) continue;
        if (this.metadata.canEnemyWalk(node.tx, node.ty + dy)) {
          points.push({ tx: node.tx, ty: node.ty + dy });
        }
      }
    } else {
      // Check left and right
      for (let dx = -checkDist; dx <= checkDist; dx++) {
        if (dx === 0) continue;
        if (this.metadata.canEnemyWalk(node.tx + dx, node.ty)) {
          points.push({ tx: node.tx + dx, ty: node.ty });
        }
      }
    }
    
    return points;
  }
  
  // ==================== BRANCH CHECK ====================
  
  /**
   * Generate branch check pattern for junction exploration
   * Explores each branch of a junction to a limited depth
   * 
   * @param {number} originTx - Junction tile X
   * @param {number} originTy - Junction tile Y
   * @param {number} fromTx - Where we came from (to skip backtracking)
   * @param {number} fromTy - Where we came from
   * @returns {SearchPattern}
   */
  generateBranchCheck(originTx, originTy, fromTx = null, fromTy = null) {
    const originNode = this.navGraph.getNode(originTx, originTy);
    if (!originNode) {
      return new SearchPattern(PATTERN_TYPES.BRANCH_CHECK, [], { tx: originTx, ty: originTy });
    }
    
    // Get all branches from this junction
    const branches = this._identifyBranches(originNode, fromTx, fromTy);
    
    if (branches.length === 0) {
      // No branches, just return origin
      return new SearchPattern(PATTERN_TYPES.BRANCH_CHECK, [
        this._createPatternPoint(originTx, originTy, 1)
      ], { tx: originTx, ty: originTy });
    }
    
    // Generate check points for each branch
    const points = [];
    const maxDepth = this.config.branchCheckMaxDepth;
    
    for (const branch of branches) {
      // Add end point of branch
      const endPoint = branch.nodes[Math.min(branch.depth, branch.nodes.length - 1)];
      points.push(this._createPatternPoint(endPoint.tx, endPoint.ty, branch.priority));
      
      // Add intermediate points for long branches
      if (branch.nodes.length > 3) {
        const midIndex = Math.floor(branch.nodes.length / 2);
        const midPoint = branch.nodes[midIndex];
        points.push(this._createPatternPoint(midPoint.tx, midPoint.ty, branch.priority * 0.8));
      }
    }
    
    // Sort by priority
    points.sort((a, b) => b.priority - a.priority);
    
    const limitedPoints = points.slice(0, this.config.maxPatternPoints);
    
    if (this.config.debug) {
      console.log(`[PathCheckEngine] Branch check: ${limitedPoints.length} points from ${branches.length} branches`);
    }
    
    return new SearchPattern(PATTERN_TYPES.BRANCH_CHECK, limitedPoints, { tx: originTx, ty: originTy });
  }
  
  /**
   * Identify branches from a junction node
   * @private
   */
  _identifyBranches(junctionNode, fromTx, fromTy) {
    const branches = [];
    const visited = new Set([junctionNode.key()]);
    
    // Get neighbors (potential branch starts)
    const neighbors = junctionNode.getNeighborNodes();
    
    for (const startNode of neighbors) {
      // Skip where we came from
      if (fromTx !== null && fromTy !== null) {
        if (startNode.tx === fromTx && startNode.ty === fromTy) continue;
      }
      
      // Skip already explored
      if (visited.has(startNode.key())) continue;
      
      // Explore this branch
      const branch = this._exploreBranch(startNode, visited);
      if (branch.nodes.length >= this.config.branchCheckMinNodes) {
        branches.push(branch);
      }
    }
    
    // Sort branches by strategic value
    branches.sort((a, b) => b.priority - a.priority);
    
    return branches;
  }
  
  /**
   * Explore a branch from a starting node
   * @private
   */
  _exploreBranch(startNode, visited) {
    const nodes = [];
    const queue = [{ node: startNode, depth: 0 }];
    let totalStrategicValue = 0;
    
    while (queue.length > 0 && nodes.length < this.config.branchCheckMaxDepth) {
      const { node, depth } = queue.shift();
      
      if (visited.has(node.key())) continue;
      visited.add(node.key());
      
      nodes.push(node);
      totalStrategicValue += node.strategicValue || 1;
      
      // Stop at junctions, doorways, or dead ends
      if (depth > 0 && (
        node.type === NAV_NODE_TYPES.JUNCTION ||
        node.type === NAV_NODE_TYPES.DOORWAY ||
        node.type === NAV_NODE_TYPES.DEAD_END
      )) {
        break;
      }
      
      // Continue to next node in branch
      const neighbors = node.getNeighborNodes();
      let foundNext = false;
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.key())) {
          queue.push({ node: neighbor, depth: depth + 1 });
          foundNext = true;
          break; // Only follow one path (the branch)
        }
      }
    }
    
    return {
      nodes,
      depth: nodes.length,
      priority: totalStrategicValue / Math.max(nodes.length, 1)
    };
  }
  
  // ==================== EXPANDING RING ====================
  
  /**
   * Generate expanding ring search pattern
   * Radiates outward from last known position
   * 
   * @param {number} originTx - Last known tile X
   * @param {number} originTy - Last known tile Y
   * @param {number} maxRadius - Maximum search radius (0 = use config default)
   * @returns {SearchPattern}
   */
  generateExpandingRing(originTx, originTy, maxRadius = 0) {
    const maxR = maxRadius || this.config.ringMaxRadius;
    const points = [];
    
    // Start with origin
    points.push(this._createPatternPoint(originTx, originTy, 2));
    
    // Generate rings
    let radius = this.config.ringInitialRadius;
    
    while (radius <= maxR && points.length < this.config.maxPatternPoints) {
      const ringPoints = this._generateRingPoints(originTx, originTy, radius);
      
      // Sort ring points by strategic value
      ringPoints.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      for (const rp of ringPoints) {
        if (points.length >= this.config.maxPatternPoints) break;
        points.push(rp);
      }
      
      radius += this.config.ringExpansionRate;
    }
    
    if (this.config.debug) {
      console.log(`[PathCheckEngine] Expanding ring: ${points.length} points, max radius ${radius}`);
    }
    
    return new SearchPattern(PATTERN_TYPES.EXPANDING_RING, points, { tx: originTx, ty: originTy });
  }
  
  /**
   * Generate points for a single ring
   * @private
   */
  _generateRingPoints(centerTx, centerTy, radius) {
    const points = [];
    const numPoints = this.config.ringPointsPerRing;
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const tx = Math.round(centerTx + Math.cos(angle) * radius);
      const ty = Math.round(centerTy + Math.sin(angle) * radius);
      
      // Check if walkable
      if (!this.metadata.canEnemyWalk(tx, ty)) {
        if (this.config.ringPrioritizeWalkable) {
          // Try to find nearest walkable
          const nearest = this._findNearestWalkable(tx, ty, 2);
          if (nearest) {
            const node = this.navGraph.getNode(nearest.tx, nearest.ty);
            points.push(this._createPatternPoint(nearest.tx, nearest.ty, 
              node?.strategicValue || 0.5));
          }
        }
        continue;
      }
      
      const node = this.navGraph.getNode(tx, ty);
      points.push(this._createPatternPoint(tx, ty, node?.strategicValue || 0.5));
    }
    
    return points;
  }
  
  /**
   * Find nearest walkable tile
   * @private
   */
  _findNearestWalkable(tx, ty, maxDist) {
    for (let d = 1; d <= maxDist; d++) {
      for (let dx = -d; dx <= d; dx++) {
        for (let dy = -d; dy <= d; dy++) {
          if (Math.abs(dx) !== d && Math.abs(dy) !== d) continue;
          if (this.metadata.canEnemyWalk(tx + dx, ty + dy)) {
            return { tx: tx + dx, ty: ty + dy };
          }
        }
      }
    }
    return null;
  }
  
  // ==================== CORRIDOR SEARCH ====================
  
  /**
   * Generate corridor search pattern
   * Searches along corridor in both directions from origin
   * 
   * @param {number} originTx - Origin tile X
   * @param {number} originTy - Origin tile Y
   * @returns {SearchPattern}
   */
  generateCorridorSearch(originTx, originTy) {
    const points = [];
    
    // Add origin
    points.push(this._createPatternPoint(originTx, originTy, 1.5));
    
    // Search in all 4 directions
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];
    
    for (const dir of directions) {
      let tx = originTx + dir.dx;
      let ty = originTy + dir.dy;
      let dist = 1;
      const maxDist = 8;
      
      while (dist <= maxDist && this.metadata.canEnemyWalk(tx, ty)) {
        const node = this.navGraph.getNode(tx, ty);
        const priority = Math.max(0.3, 1 - dist * 0.1);
        
        // Stop at junctions or doorways (add them but don't continue)
        points.push(this._createPatternPoint(tx, ty, 
          priority * (node?.strategicValue || 1)));
        
        if (node && (node.type === NAV_NODE_TYPES.JUNCTION || 
                     node.type === NAV_NODE_TYPES.DOORWAY)) {
          break;
        }
        
        tx += dir.dx;
        ty += dir.dy;
        dist++;
      }
    }
    
    // Sort by priority
    points.sort((a, b) => b.priority - a.priority);
    
    const limitedPoints = points.slice(0, this.config.maxPatternPoints);
    
    return new SearchPattern(PATTERN_TYPES.CORRIDOR_SEARCH, limitedPoints, 
      { tx: originTx, ty: originTy });
  }
  
  // ==================== INTELLIGENT PATTERN SELECTION ====================
  
  /**
   * Get best search pattern based on context
   * 
   * @param {number} originTx - Origin tile X
   * @param {number} originTy - Origin tile Y
   * @param {Object} context - Context info { lastSeenTx, lastSeenTy, cameFromTx, cameFromTy }
   * @returns {SearchPattern}
   */
  getBestPattern(originTx, originTy, context = {}) {
    const node = this.navGraph.getNode(originTx, originTy);
    
    if (!node) {
      // Fallback to expanding ring
      return this.generateExpandingRing(originTx, originTy);
    }
    
    // Check if we have last known player position
    if (context.lastSeenTx !== undefined && context.lastSeenTy !== undefined) {
      // Use expanding ring from last known position
      return this.generateExpandingRing(context.lastSeenTx, context.lastSeenTy);
    }
    
    // Choose pattern based on node type
    switch (node.type) {
      case NAV_NODE_TYPES.JUNCTION:
        return this.generateBranchCheck(originTx, originTy, 
          context.cameFromTx, context.cameFromTy);
      
      case NAV_NODE_TYPES.CORRIDOR:
      case NAV_NODE_TYPES.CHOKEPOINT:
        return this.generateLaneSweep(originTx, originTy);
      
      case NAV_NODE_TYPES.DOORWAY:
        // Check room interior or continue corridor
        return this.generateCorridorSearch(originTx, originTy);
      
      case NAV_NODE_TYPES.ROOM_INTERIOR:
        // Use expanding ring for room search
        return this.generateExpandingRing(originTx, originTy, 8);
      
      case NAV_NODE_TYPES.DEAD_END:
        // Just check this location
        return new SearchPattern(PATTERN_TYPES.CORRIDOR_SEARCH, [
          this._createPatternPoint(originTx, originTy, 1)
        ], { tx: originTx, ty: originTy });
      
      default:
        return this.generateExpandingRing(originTx, originTy);
    }
  }
  
  // ==================== ACTIVE PATTERN MANAGEMENT ====================
  
  /**
   * Start a new pattern for an agent
   * @param {string} agentId
   * @param {SearchPattern} pattern
   */
  startPattern(agentId, pattern) {
    this._activePatterns.set(agentId, pattern);
    this._recordPatternStart(pattern);
  }
  
  /**
   * Get active pattern for an agent
   * @param {string} agentId
   * @returns {SearchPattern|null}
   */
  getActivePattern(agentId) {
    const pattern = this._activePatterns.get(agentId);
    
    if (!pattern) return null;
    
    // Check timeout
    if (Date.now() - pattern.createdAt > this.config.patternTimeout) {
      this._activePatterns.delete(agentId);
      return null;
    }
    
    return pattern;
  }
  
  /**
   * Get next point from active pattern
   * @param {string} agentId
   * @returns {Object|null}
   */
  getNextPatternPoint(agentId) {
    const pattern = this.getActivePattern(agentId);
    if (!pattern) return null;
    
    const point = pattern.getNextPoint();
    
    if (pattern.completed) {
      this._activePatterns.delete(agentId);
      this._recordPatternComplete(pattern);
    }
    
    return point;
  }
  
  /**
   * Cancel active pattern
   * @param {string} agentId
   */
  cancelPattern(agentId) {
    const pattern = this._activePatterns.get(agentId);
    if (pattern) {
      this._recordPatternCancel(pattern);
    }
    this._activePatterns.delete(agentId);
  }
  
  // ==================== HELPER METHODS ====================
  
  /**
   * Create a pattern point
   * @private
   */
  _createPatternPoint(tx, ty, priority = 1) {
    const world = tileToWorld(tx, ty);
    return {
      tx,
      ty,
      x: world.x,
      y: world.y,
      priority
    };
  }
  
  /**
   * Deduplicate points
   * @private
   */
  _deduplicatePoints(points) {
    const seen = new Set();
    return points.filter(p => {
      const key = `${p.tx},${p.ty}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  /**
   * Record pattern start
   * @private
   */
  _recordPatternStart(pattern) {
    this._patternHistory.push({
      type: pattern.type,
      startTime: pattern.createdAt,
      pointCount: pattern.points.length,
      origin: pattern.origin
    });
    
    // Trim history
    if (this._patternHistory.length > this._maxHistoryLength) {
      this._patternHistory = this._patternHistory.slice(-this._maxHistoryLength);
    }
  }
  
  /**
   * Record pattern completion
   * @private
   */
  _recordPatternComplete(pattern) {
    const entry = this._patternHistory.find(e => 
      e.startTime === pattern.createdAt && e.type === pattern.type
    );
    if (entry) {
      entry.completed = true;
      entry.endTime = Date.now();
      entry.duration = entry.endTime - entry.startTime;
    }
  }
  
  /**
   * Record pattern cancellation
   * @private
   */
  _recordPatternCancel(pattern) {
    const entry = this._patternHistory.find(e => 
      e.startTime === pattern.createdAt && e.type === pattern.type
    );
    if (entry) {
      entry.cancelled = true;
      entry.endTime = Date.now();
    }
  }
  
  /**
   * Get pattern statistics
   * @returns {Object}
   */
  getStats() {
    const completed = this._patternHistory.filter(e => e.completed);
    const cancelled = this._patternHistory.filter(e => e.cancelled);
    
    const avgDuration = completed.length > 0
      ? completed.reduce((sum, e) => sum + (e.duration || 0), 0) / completed.length
      : 0;
    
    return {
      totalPatterns: this._patternHistory.length,
      completed: completed.length,
      cancelled: cancelled.length,
      avgDuration,
      activePatterns: this._activePatterns.size,
      historyLength: this._patternHistory.length
    };
  }
}

export { SearchPattern };
export default PathCheckEngine;
