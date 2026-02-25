/**
 * Guard Coordinator Module
 * 
 * Manages multi-enemy coordination during alert states.
 * Assigns roles and handles doorway contention.
 * 
 * Phase B: Multi-enemy coordination for improved tactical behavior.
 * 
 * Roles:
 * - pursuer: Direct chase of player
 * - flanker: Moves to intercept escape routes
 * - room_checker: Systematically checks nearby rooms
 * 
 * @module guard/GuardCoordinator
 */

import { GUARD_STATES_V2, TRANSITION_REASONS } from './GuardStateMachineV2.js';

/**
 * Coordination roles
 */
export const COORD_ROLES = {
  PURSUER: 'pursuer',
  FLANKER: 'flanker',
  ROOM_CHECKER: 'room_checker',
  UNASSIGNED: 'unassigned'
};

/**
 * Coordinator configuration
 */
export const COORDINATOR_CONFIG = {
  // Maximum number of guards that can coordinate
  maxCoordinatingGuards: 4,
  
  // Role assignment priority (higher = more important to fill first)
  rolePriority: {
    pursuer: 3,
    flanker: 2,
    room_checker: 1
  },
  
  // Flanking configuration
  flanking: {
    // Distance to project player movement for interception
    projectionDistance: 150,
    // Angle spread for flankers (radians)
    flankAngleSpread: Math.PI / 3,
    // Minimum distance for effective flanking
    minFlankDistance: 80,
    // Maximum distance for flanking
    maxFlankDistance: 300
  },
  
  // Room checking configuration
  roomChecking: {
    // Maximum rooms to check
    maxRoomsToCheck: 3,
    // Distance threshold for room boundary
    roomDetectionRadius: 100,
    // Time to spend per room
    roomCheckDuration: 3000
  },
  
  // Doorway contention configuration
  doorwayContention: {
    // Detection radius for doorway conflicts
    contentionRadius: 60,
    // Time to wait before yielding
    yieldTimeout: 500,
    // Minimum separation distance
    minSeparation: 40,
    // Direction alternation cooldown
    directionCooldown: 800
  },
  
  // Coordination update interval (ms)
  updateInterval: 200,
  
  // Role reassignment cooldown (ms)
  reassignmentCooldown: 1000
};

/**
 * Guard Coordinator
 * Manages multi-enemy tactical coordination
 */
export class GuardCoordinator {
  constructor(config = {}) {
    this.config = { ...COORDINATOR_CONFIG, ...config };
    
    // Registered guards
    this._guards = new Map(); // guardId -> GuardInfo
    
    // Current alert state
    this._alertActive = false;
    this._alertPosition = null;
    this._alertTime = 0;
    
    // Role assignments
    this._roleAssignments = new Map(); // guardId -> role
    
    // Doorway contention tracking
    this._doorwayConflicts = new Map(); // doorwayKey -> ConflictInfo
    
    // Last coordination update
    this._lastUpdate = 0;
    
    // Diagnostics
    this._coordinationEvents = [];
    this._maxEvents = 50;
  }
  
  /**
   * Register a guard with the coordinator
   * @param {string} guardId - Unique guard identifier
   * @param {Object} guardInfo - Guard information
   */
  registerGuard(guardId, guardInfo = {}) {
    this._guards.set(guardId, {
      id: guardId,
      position: guardInfo.position || { x: 0, y: 0 },
      state: guardInfo.state || GUARD_STATES_V2.PATROL,
      role: COORD_ROLES.UNASSIGNED,
      lastRoleChange: 0,
      ...guardInfo
    });
    
    this._recordEvent('guard_registered', { guardId });
  }
  
  /**
   * Unregister a guard from the coordinator
   * @param {string} guardId - Guard identifier
   */
  unregisterGuard(guardId) {
    this._guards.delete(guardId);
    this._roleAssignments.delete(guardId);
    this._recordEvent('guard_unregistered', { guardId });
  }
  
  /**
   * Update guard position and state
   * @param {string} guardId - Guard identifier
   * @param {Object} update - Update data
   */
  updateGuard(guardId, update) {
    const guard = this._guards.get(guardId);
    if (!guard) return;
    
    if (update.position) guard.position = { ...update.position };
    if (update.state) guard.state = update.state;
    if (update.velocity) guard.velocity = { ...update.velocity };
    
    this._guards.set(guardId, guard);
  }
  
  /**
   * Trigger alert coordination
   * @param {{x: number, y: number}} alertPosition - Alert position
   * @param {number} now - Current time in ms
   */
  triggerAlert(alertPosition, now = Date.now()) {
    this._alertActive = true;
    this._alertPosition = { ...alertPosition };
    this._alertTime = now;
    
    // Immediately assign roles
    this._assignRoles(now);
    
    this._recordEvent('alert_triggered', { position: alertPosition });
  }
  
  /**
   * Clear alert state
   */
  clearAlert() {
    this._alertActive = false;
    this._alertPosition = null;
    
    // Reset all roles
    for (const [guardId, guard] of this._guards) {
      guard.role = COORD_ROLES.UNASSIGNED;
      this._guards.set(guardId, guard);
    }
    
    this._roleAssignments.clear();
    this._recordEvent('alert_cleared', {});
  }
  
  /**
   * Main coordination update
   * @param {number} now - Current time in ms
   * @returns {Object} Coordination results
   */
  update(now = Date.now()) {
    if (now - this._lastUpdate < this.config.updateInterval) {
      return { roles: this._getRoleSnapshot(), conflicts: [] };
    }
    
    this._lastUpdate = now;
    
    // Update role assignments if alert is active
    if (this._alertActive) {
      this._assignRoles(now);
    }
    
    // Detect and resolve doorway conflicts
    const conflicts = this._resolveDoorwayConflicts(now);
    
    return {
      roles: this._getRoleSnapshot(),
      conflicts,
      alertActive: this._alertActive,
      alertPosition: this._alertPosition
    };
  }
  
  /**
   * Get role for a specific guard
   * @param {string} guardId - Guard identifier
   * @returns {string} Role name
   */
  getRole(guardId) {
    const guard = this._guards.get(guardId);
    return guard?.role || COORD_ROLES.UNASSIGNED;
  }
  
  /**
   * Get flanking target for a guard
   * @param {string} guardId - Guard identifier
   * @param {{x: number, y: number}} playerPos - Player position
   * @param {{x: number, y: number}} playerVelocity - Player velocity
   * @returns {{x: number, y: number}|null} Flanking target position
   */
  getFlankingTarget(guardId, playerPos, playerVelocity) {
    const guard = this._guards.get(guardId);
    if (!guard || guard.role !== COORD_ROLES.FLANKER) return null;
    
    const flanking = this.config.flanking;
    
    // Project player movement
    const speed = Math.hypot(playerVelocity?.x || 0, playerVelocity?.y || 0);
    if (speed < 10) {
      // Player not moving significantly - circle around
      return this._getCirclePosition(guard.position, playerPos, flanking.projectionDistance);
    }
    
    // Calculate interception point
    const playerDir = Math.atan2(playerVelocity.y, playerVelocity.x);
    
    // Determine flank side based on guard position relative to player
    const guardToPlayerAngle = Math.atan2(
      guard.position.y - playerPos.y,
      guard.position.x - playerPos.x
    );
    
    // Flank from opposite side of player movement
    const flankAngle = playerDir + Math.PI + flanking.flankAngleSpread * 
                       (this._angleDiff(guardToPlayerAngle, playerDir) > 0 ? 1 : -1);
    
    const targetDist = Math.min(
      flanking.maxFlankDistance,
      Math.max(flanking.minFlankDistance, flanking.projectionDistance)
    );
    
    return {
      x: playerPos.x + Math.cos(flankAngle) * targetDist,
      y: playerPos.y + Math.sin(flankAngle) * targetDist
    };
  }
  
  /**
   * Get room check targets for a guard
   * @param {string} guardId - Guard identifier
   * @param {Array} nearbyRooms - List of nearby rooms to check
   * @returns {Array<{x: number, y: number}>} Room check targets
   */
  getRoomCheckTargets(guardId, nearbyRooms) {
    const guard = this._guards.get(guardId);
    if (!guard || guard.role !== COORD_ROLES.ROOM_CHECKER) return [];
    
    const config = this.config.roomChecking;
    
    // Sort rooms by distance to guard
    const sortedRooms = (nearbyRooms || [])
      .map(room => ({
        ...room,
        distance: Math.hypot(
          (room.center?.x || room.x) - guard.position.x,
          (room.center?.y || room.y) - guard.position.y
        )
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, config.maxRoomsToCheck);
    
    // Generate check points for each room
    const checkPoints = [];
    for (const room of sortedRooms) {
      const center = room.center || { x: room.x, y: room.y };
      checkPoints.push(center);
      
      // Add perimeter points for thorough checking
      if (room.width && room.height) {
        const halfW = room.width / 2;
        const halfH = room.height / 2;
        checkPoints.push(
          { x: center.x - halfW * 0.5, y: center.y - halfH * 0.5 },
          { x: center.x + halfW * 0.5, y: center.y + halfH * 0.5 },
          { x: center.x - halfW * 0.5, y: center.y + halfH * 0.5 },
          { x: center.x + halfW * 0.5, y: center.y - halfH * 0.5 }
        );
      }
    }
    
    return checkPoints;
  }
  
  /**
   * Check if a guard should yield at doorway
   * @param {string} guardId - Guard identifier
   * @param {{x: number, y: number}} doorwayPos - Doorway position
   * @param {number} now - Current time in ms
   * @returns {{shouldYield: boolean, yieldDirection: number|null}}
   */
  checkDoorwayContention(guardId, doorwayPos, now = Date.now()) {
    const guard = this._guards.get(guardId);
    if (!guard) return { shouldYield: false, yieldDirection: null };
    
    const config = this.config.doorwayContention;
    const doorwayKey = this._getDoorwayKey(doorwayPos);
    
    // Check for other guards near this doorway
    const nearbyGuards = [];
    for (const [otherId, otherGuard] of this._guards) {
      if (otherId === guardId) continue;
      
      const dist = Math.hypot(
        otherGuard.position.x - doorwayPos.x,
        otherGuard.position.y - doorwayPos.y
      );
      
      if (dist < config.contentionRadius) {
        nearbyGuards.push({
          id: otherId,
          guard: otherGuard,
          distance: dist
        });
      }
    }
    
    if (nearbyGuards.length === 0) {
      // No contention
      this._doorwayConflicts.delete(doorwayKey);
      return { shouldYield: false, yieldDirection: null };
    }
    
    // Determine who has priority
    const myPriority = this._getGuardPriority(guard);
    let shouldYield = false;
    let yieldDirection = null;
    
    for (const { guard: otherGuard, distance } of nearbyGuards) {
      const otherPriority = this._getGuardPriority(otherGuard);
      
      if (otherPriority > myPriority) {
        // Other guard has higher priority - yield
        shouldYield = true;
        // Calculate yield direction (perpendicular to doorway)
        const dx = guard.position.x - doorwayPos.x;
        const dy = guard.position.y - doorwayPos.y;
        const angle = Math.atan2(dy, dx);
        yieldDirection = angle + Math.PI / 2;
        break;
      } else if (otherPriority === myPriority) {
        // Equal priority - guard closer to doorway goes first
        const myDist = Math.hypot(
          guard.position.x - doorwayPos.x,
          guard.position.y - doorwayPos.y
        );
        
        if (distance < myDist) {
          shouldYield = true;
          const dx = guard.position.x - doorwayPos.x;
          const dy = guard.position.y - doorwayPos.y;
          const angle = Math.atan2(dy, dx);
          yieldDirection = angle + Math.PI / 2;
          break;
        }
      }
    }
    
    // Record conflict for diagnostics
    if (shouldYield) {
      this._doorwayConflicts.set(doorwayKey, {
        guards: [guardId, ...nearbyGuards.map(g => g.id)],
        yieldingGuard: guardId,
        time: now
      });
    }
    
    return { shouldYield, yieldDirection };
  }
  
  /**
   * Assign roles to guards based on alert state
   * @param {number} now - Current time in ms
   * @private
   */
  _assignRoles(now) {
    const guards = Array.from(this._guards.values());
    
    if (guards.length === 0) return;
    
    // Filter guards that can be assigned
    const availableGuards = guards.filter(g => 
      g.state !== GUARD_STATES_V2.CHASE && // Already chasing
      now - g.lastRoleChange >= this.config.reassignmentCooldown
    );
    
    if (availableGuards.length === 0) return;
    
    // Sort by distance to alert position
    const sortedGuards = availableGuards.sort((a, b) => {
      const distA = Math.hypot(
        a.position.x - (this._alertPosition?.x || 0),
        a.position.y - (this._alertPosition?.y || 0)
      );
      const distB = Math.hypot(
        b.position.x - (this._alertPosition?.x || 0),
        b.position.y - (this._alertPosition?.y || 0)
      );
      return distA - distB;
    });
    
    // Assign roles
    const rolePriority = this.config.rolePriority;
    const roles = [COORD_ROLES.PURSUER, COORD_ROLES.FLANKER, COORD_ROLES.ROOM_CHECKER];
    
    for (const role of roles) {
      // Check if role already assigned
      const roleAssigned = guards.some(g => g.role === role);
      if (roleAssigned && role !== COORD_ROLES.FLANKER) continue; // Allow multiple flankers
      
      // Find best guard for this role
      for (const guard of sortedGuards) {
        if (guard.role !== COORD_ROLES.UNASSIGNED && guard.role !== role) continue;
        
        // Assign role
        guard.role = role;
        guard.lastRoleChange = now;
        this._guards.set(guard.id, guard);
        this._roleAssignments.set(guard.id, role);
        
        this._recordEvent('role_assigned', { guardId: guard.id, role });
        break;
      }
    }
  }
  
  /**
   * Resolve doorway conflicts
   * @param {number} now - Current time in ms
   * @returns {Array} List of resolved conflicts
   * @private
   */
  _resolveDoorwayConflicts(now) {
    const resolvedConflicts = [];
    const config = this.config.doorwayContention;
    
    for (const [doorwayKey, conflict] of this._doorwayConflicts) {
      // Check if conflict still active
      if (now - conflict.time > config.yieldTimeout * 3) {
        // Conflict timed out - clear it
        this._doorwayConflicts.delete(doorwayKey);
        resolvedConflicts.push({ doorwayKey, reason: 'timeout' });
        continue;
      }
      
      // Check if guards have moved apart
      const positions = conflict.guards
        .map(id => this._guards.get(id)?.position)
        .filter(Boolean);
      
      if (positions.length >= 2) {
        const minDist = this._getMinSeparation(positions);
        if (minDist > config.minSeparation * 1.5) {
          // Guards have separated - conflict resolved
          this._doorwayConflicts.delete(doorwayKey);
          resolvedConflicts.push({ doorwayKey, reason: 'separated' });
        }
      }
    }
    
    return resolvedConflicts;
  }
  
  /**
   * Get minimum separation between positions
   * @private
   */
  _getMinSeparation(positions) {
    let minDist = Infinity;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dist = Math.hypot(
          positions[i].x - positions[j].x,
          positions[i].y - positions[j].y
        );
        minDist = Math.min(minDist, dist);
      }
    }
    return minDist;
  }
  
  /**
   * Get guard priority for contention resolution
   * @private
   */
  _getGuardPriority(guard) {
    // Higher priority = goes first
    const statePriority = {
      [GUARD_STATES_V2.CHASE]: 5,
      [GUARD_STATES_V2.SEARCH_PATHS]: 4,
      [GUARD_STATES_V2.SWEEP_ROOM]: 3,
      [GUARD_STATES_V2.INVESTIGATE]: 2,
      [GUARD_STATES_V2.RETURN_TO_PATROL]: 1,
      [GUARD_STATES_V2.PATROL]: 0
    };
    
    const rolePriority = {
      [COORD_ROLES.PURSUER]: 3,
      [COORD_ROLES.FLANKER]: 2,
      [COORD_ROLES.ROOM_CHECKER]: 1,
      [COORD_ROLES.UNASSIGNED]: 0
    };
    
    return (statePriority[guard.state] || 0) * 10 + (rolePriority[guard.role] || 0);
  }
  
  /**
   * Get role snapshot
   * @private
   */
  _getRoleSnapshot() {
    const snapshot = {};
    for (const [guardId, guard] of this._guards) {
      snapshot[guardId] = guard.role;
    }
    return snapshot;
  }
  
  /**
   * Get doorway key for tracking
   * @private
   */
  _getDoorwayKey(pos) {
    // Round to tile coordinates for grouping
    return `${Math.round(pos.x / 48)}_${Math.round(pos.y / 48)}`;
  }
  
  /**
   * Calculate angle difference
   * @private
   */
  _angleDiff(a, b) {
    let diff = a - b;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  }
  
  /**
   * Get circular position around target
   * @private
   */
  _getCirclePosition(fromPos, targetPos, radius) {
    const angle = Math.atan2(
      fromPos.y - targetPos.y,
      fromPos.x - targetPos.x
    );
    
    // Move to opposite side
    const newAngle = angle + Math.PI;
    
    return {
      x: targetPos.x + Math.cos(newAngle) * radius,
      y: targetPos.y + Math.sin(newAngle) * radius
    };
  }
  
  /**
   * Record coordination event
   * @private
   */
  _recordEvent(type, data) {
    this._coordinationEvents.push({
      type,
      data,
      time: Date.now()
    });
    
    if (this._coordinationEvents.length > this._maxEvents) {
      this._coordinationEvents.shift();
    }
  }
  
  /**
   * Get diagnostics
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      guardCount: this._guards.size,
      alertActive: this._alertActive,
      alertPosition: this._alertPosition,
      roleAssignments: Object.fromEntries(this._roleAssignments),
      activeConflicts: this._doorwayConflicts.size,
      recentEvents: this._coordinationEvents.slice(-10)
    };
  }
  
  /**
   * Reset coordinator state
   */
  reset() {
    this._alertActive = false;
    this._alertPosition = null;
    this._alertTime = 0;
    this._roleAssignments.clear();
    this._doorwayConflicts.clear();
    this._coordinationEvents = [];
    
    for (const [guardId, guard] of this._guards) {
      guard.role = COORD_ROLES.UNASSIGNED;
      guard.lastRoleChange = 0;
      this._guards.set(guardId, guard);
    }
  }
  
  /**
   * Clear all registered guards
   */
  clear() {
    this._guards.clear();
    this._roleAssignments.clear();
    this._doorwayConflicts.clear();
    this.reset();
  }
}

export default GuardCoordinator;
