/**
 * Movement Solver Module
 * 
 * Handles obstacle avoidance and direction calculation for guard AI.
 * Phase P1: Extracted from main.js monolith for maintainability.
 * 
 * Features:
 * - Obstacle lookahead detection
 * - Alternative direction finding
 * - Wall clearance force calculation
 * - Narrow corridor detection
 * - Direction smoothing
 * 
 * @module guard/MovementSolver
 */

/**
 * Movement solver configuration
 */
export const MOVEMENT_SOLVER_CONFIG = {
  // Lookahead distance for obstacle detection (relative to TILE_SIZE)
  lookaheadFactor: 1.8,
  
  // Corner check radius for finding path around corners
  cornerCheckRadius: 40,
  
  // Wall clearance distance (pixels)
  wallClearanceDistance: 12,
  
  // Narrow corridor detection
  narrowCorridorWallThreshold: 3,
  narrowCorridorRadius: 60,
  narrowCorridorPushForce: 0.5,
  
  // Direction smoothing factor (0-1, higher = smoother)
  directionSmoothing: 0.15,
  
  // Alternative direction weights
  avoidWeights: {
    forward: 1.0,
    perpendicular: 0.7,
    reverse: 0.15
  }
};

/**
 * Movement Solver
 * Calculates optimal movement direction considering obstacles
 */
export class MovementSolver {
  constructor(config = {}, tileGrid = null) {
    this.config = { ...MOVEMENT_SOLVER_CONFIG, ...config };
    this._tileGrid = tileGrid;
    this._tileSize = 48;  // Default tile size
    
    // Collision detection function (injected from scene)
    this._isWallAtFn = null;
    
    // Diagnostics
    this._lastAlternativeDir = null;
    this._obstacleAvoidanceEvents = [];
  }
  
  /**
   * Set the wall detection function
   * @param {function} fn - Function(x, y) -> boolean
   */
  setWallDetectionFunction(fn) {
    this._isWallAtFn = fn;
  }
  
  /**
   * Set tile size
   * @param {number} size
   */
  setTileSize(size) {
    this._tileSize = size;
  }
  
  /**
   * Check if position has obstacle/wall
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Array} obstacles - Optional obstacle array (if no wall detection fn)
   * @returns {boolean}
   */
  isWallAt(x, y, obstacles = null) {
    if (this._isWallAtFn) {
      return this._isWallAtFn(x, y);
    }
    
    // Fallback to obstacle array check
    if (!obstacles) return false;
    
    const halfTile = this._tileSize / 2 - 2;
    
    for (const o of obstacles) {
      const ox = o.x * this._tileSize + this._tileSize / 2;
      const oy = o.y * this._tileSize + this._tileSize / 2;
      
      if (x > ox - halfTile && x < ox + halfTile &&
          y > oy - halfTile && y < oy + halfTile) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if guard is in narrow corridor
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {boolean}
   */
  isNarrowCorridor(x, y) {
    const radius = this.config.narrowCorridorRadius;
    let nearbyWallCount = 0;
    
    // Check in 8 directions
    const directions = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 0.707, dy: 0.707 }, { dx: -0.707, dy: 0.707 },
      { dx: 0.707, dy: -0.707 }, { dx: -0.707, dy: -0.707 }
    ];
    
    for (const dir of directions) {
      const checkX = x + dir.dx * radius;
      const checkY = y + dir.dy * radius;
      if (this.isWallAt(checkX, checkY)) {
        nearbyWallCount++;
      }
    }
    
    return nearbyWallCount >= this.config.narrowCorridorWallThreshold;
  }
  
  /**
   * Get wall clearance force (pushes guard away from walls)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {{x: number, y: number}} Force vector
   */
  getWallClearanceForce(x, y) {
    const clearanceDist = this.config.wallClearanceDistance;
    let forceX = 0, forceY = 0;
    
    // Check 8 directions for nearby walls
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 0.707, dy: 0.707 },
      { dx: -0.707, dy: 0.707 },
      { dx: 0.707, dy: -0.707 },
      { dx: -0.707, dy: -0.707 }
    ];
    
    for (const dir of directions) {
      const checkX = x + dir.dx * clearanceDist;
      const checkY = y + dir.dy * clearanceDist;
      
      if (this.isWallAt(checkX, checkY)) {
        // Push away from wall
        forceX -= dir.dx * 0.25;
        forceY -= dir.dy * 0.25;
      }
    }
    
    // Normalize force
    const forceMag = Math.hypot(forceX, forceY);
    if (forceMag > 1) {
      forceX /= forceMag;
      forceY /= forceMag;
    }
    
    return { x: forceX, y: forceY };
  }
  
  /**
   * Check if there's an obstacle ahead
   * @param {number} x - Current X position
   * @param {number} y - Current Y position
   * @param {number} vx - X velocity direction
   * @param {number} vy - Y velocity direction
   * @param {number} speed - Current speed
   * @returns {boolean}
   */
  hasObstacleAhead(x, y, vx, vy, speed) {
    const lookahead = this.config.lookaheadFactor * this._tileSize;
    const speedNorm = Math.hypot(vx, vy);
    
    if (speedNorm < 0.1) return false;
    
    const checkX = x + (vx / speedNorm) * lookahead;
    const checkY = y + (vy / speedNorm) * lookahead;
    
    return this.isWallAt(checkX, checkY);
  }
  
  /**
   * Find alternative direction when blocked
   * @param {number} x - Current X position
   * @param {number} y - Current Y position
   * @param {number} desiredVx - Desired X velocity
   * @param {number} desiredVy - Desired Y velocity
   * @param {number} speed - Target speed
   * @param {boolean} isStuck - Is guard currently stuck?
   * @param {boolean} isFlipFlopping - Is guard flip-flopping?
   * @param {Array} recentAngles - Recent direction angles for flip-flop penalty
   * @returns {{vx: number, vy: number}|null}
   */
  findAlternativeDirection(x, y, desiredVx, desiredVy, speed, isStuck = false, isFlipFlopping = false, recentAngles = []) {
    const weights = this.config.avoidWeights;
    const checkRadius = this.config.cornerCheckRadius;
    
    // Normalize desired direction
    const desiredSpeed = Math.hypot(desiredVx, desiredVy);
    if (desiredSpeed === 0) return null;
    const desiredNx = desiredVx / desiredSpeed;
    const desiredNy = desiredVy / desiredSpeed;
    
    // Generate candidate directions with weights
    const candidates = [
      { vx: desiredNx * speed, vy: desiredNy * speed, weight: weights.forward, name: 'forward' },
      { vx: -desiredNy * speed, vy: desiredNx * speed, weight: weights.perpendicular, name: 'cw' },
      { vx: desiredNy * speed, vy: -desiredNx * speed, weight: weights.perpendicular, name: 'ccw' },
      { vx: (desiredNx - desiredNy) * 0.707 * speed, vy: (desiredNy + desiredNx) * 0.707 * speed, weight: weights.perpendicular * 0.9, name: 'cw45' },
      { vx: (desiredNx + desiredNy) * 0.707 * speed, vy: (desiredNy - desiredNx) * 0.707 * speed, weight: weights.perpendicular * 0.9, name: 'ccw45' },
      { vx: -desiredNx * speed, vy: -desiredNy * speed, weight: weights.reverse, name: 'reverse' }
    ];
    
    // If flip-flopping, penalize directions similar to recent directions
    if (isFlipFlopping && recentAngles.length > 0) {
      candidates.forEach(candidate => {
        const candidateAngle = Math.atan2(candidate.vy, candidate.vx);
        
        for (const recentAngle of recentAngles) {
          let angleDiff = Math.abs(candidateAngle - recentAngle);
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
          
          // Heavy penalty for opposite direction
          if (Math.abs(Math.abs(angleDiff) - Math.PI) < 0.5) {
            candidate.weight *= 0.1;
          }
          // Moderate penalty for similar direction
          else if (Math.abs(angleDiff) < 0.5) {
            candidate.weight *= 0.5;
          }
        }
      });
    }
    
    // Sort by weight (higher is better)
    candidates.sort((a, b) => b.weight - a.weight);
    
    // Try each candidate
    for (const candidate of candidates) {
      const checkX = x + candidate.vx / speed * checkRadius;
      const checkY = y + candidate.vy / speed * checkRadius;
      
      if (!this.isWallAt(checkX, checkY)) {
        // Additional clearance check
        if (this.hasPathClearance(x, y, checkX, checkY, 8)) {
          this._lastAlternativeDir = { vx: candidate.vx, vy: candidate.vy, name: candidate.name };
          return { vx: candidate.vx, vy: candidate.vy };
        }
      }
    }
    
    // If all else fails, try random perturbations
    const angle = Math.atan2(desiredVy, desiredVx);
    for (let offset = 15; offset <= 90; offset += 15) {
      for (const sign of [1, -1]) {
        const testAngle = angle + (offset * sign) * Math.PI / 180;
        const testVx = Math.cos(testAngle) * speed;
        const testVy = Math.sin(testAngle) * speed;
        
        const testX = x + testVx / speed * checkRadius * 0.5;
        const testY = y + testVy / speed * checkRadius * 0.5;
        
        if (!this.isWallAt(testX, testY)) {
          this._lastAlternativeDir = { vx: testVx, vy: testVy, name: `perturb_${offset}` };
          return { vx: testVx, vy: testVy };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check if a path has clearance from walls
   * @param {number} x1 - Start X
   * @param {number} y1 - Start Y
   * @param {number} x2 - End X
   * @param {number} y2 - End Y
   * @param {number} clearance - Clearance distance
   * @returns {boolean}
   */
  hasPathClearance(x1, y1, x2, y2, clearance) {
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      
      // Check perpendicular offsets for clearance
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      
      const nx = -dy / len;
      const ny = dx / len;
      
      if (this.isWallAt(px + nx * clearance, py + ny * clearance) ||
          this.isWallAt(px - nx * clearance, py - ny * clearance)) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Apply direction smoothing to prevent jitter
   * @param {number} desiredVx - Desired X velocity
   * @param {number} desiredVy - Desired Y velocity
   * @param {number} currentVx - Current X velocity
   * @param {number} currentVy - Current Y velocity
   * @param {number} effectiveSpeed - Target speed
   * @returns {{vx: number, vy: number}}
   */
  smoothDirection(desiredVx, desiredVy, currentVx, currentVy, effectiveSpeed) {
    // Skip smoothing if current velocity is zero
    if (currentVx === 0 && currentVy === 0) {
      return { vx: desiredVx, vy: desiredVy };
    }
    
    const smooth = this.config.directionSmoothing;
    let vx = currentVx * (1 - smooth) + desiredVx * smooth;
    let vy = currentVy * (1 - smooth) + desiredVy * smooth;
    
    // Re-normalize to maintain speed
    const newSpeed = Math.hypot(vx, vy);
    if (newSpeed > 0) {
      vx = (vx / newSpeed) * effectiveSpeed;
      vy = (vy / newSpeed) * effectiveSpeed;
    }
    
    return { vx, vy };
  }
  
  /**
   * Calculate movement towards target
   * @param {number} x - Current X
   * @param {number} y - Current Y
   * @param {number} targetX - Target X
   * @param {number} targetY - Target Y
   * @param {number} speed - Movement speed
   * @returns {{vx: number, vy: number, dist: number, sqDist: number, dx: number, dy: number}}
   */
  calculateMovement(x, y, targetX, targetY, speed) {
    const dx = targetX - x;
    const dy = targetY - y;
    const sqDist = dx * dx + dy * dy;
    const dist = Math.sqrt(sqDist);
    
    if (dist < 1) {
      return { vx: 0, vy: 0, dist, sqDist, dx, dy };
    }
    
    return {
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      dist,
      sqDist,
      dx,
      dy
    };
  }
  
  /**
   * Get diagnostics
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      lastAlternativeDir: this._lastAlternativeDir,
      hasWallDetectionFn: !!this._isWallAtFn
    };
  }
}

export default MovementSolver;
