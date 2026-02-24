/**
 * Guard Module Index
 * 
 * Phase P1: Modular guard AI system extracted from main.js monolith.
 * 
 * Architecture:
 * - GuardAI: Main orchestrator that coordinates all components
 * - GuardStateMachine: State management with hysteresis
 * - StuckDetector: Stuck detection and recovery
 * - MovementSolver: Obstacle avoidance and direction calculation
 * - GuardDiagnostics: Runtime diagnostics and anomaly detection
 * 
 * Usage:
 * ```javascript
 * import { GuardAI, GUARD_STATES, GUARD_AI_CONFIG } from './guard/index.js';
 * 
 * const ai = new GuardAI(config);
 * ai.initialize(patrolPoints, isWallAtFn, generateSearchPatternFn, Date.now(), TILE_SIZE);
 * 
 * // In update loop:
 * const result = ai.update(
 *   guard.x, guard.y, guard.body.velocity.x, guard.body.velocity.y,
 *   awareness, playerVisible, { x: player.x, y: player.y },
 *   baseSpeed, Date.now()
 * );
 * 
 * guard.body.setVelocity(result.vx, result.vy);
 * guardAngle = result.angle;
 * ```
 * 
 * @module guard/index
 */

// Import main orchestrator for re-export and factory function
import { GuardAI, GUARD_STATES, GUARD_AI_CONFIG } from './GuardAI.js';

// Re-export main orchestrator
export { GuardAI, GUARD_STATES, GUARD_AI_CONFIG };

// State machine
export { 
  GuardStateMachine, 
  GUARD_STATES as GUARD_STATE_CONSTANTS,
  STATE_MACHINE_CONFIG 
} from './GuardStateMachine.js';

// Stuck detection
export { 
  StuckDetector, 
  STUCK_DETECTOR_CONFIG 
} from './StuckDetector.js';

// Movement solver
export { 
  MovementSolver, 
  MOVEMENT_SOLVER_CONFIG 
} from './MovementSolver.js';

// Diagnostics
export {
  GuardDiagnostics,
  DIAGNOSTIC_LEVEL,
  DIAGNOSTIC_CONFIG,
  getGuardDiagnostics,
  setDiagnosticsEnabled
} from './GuardDiagnostics.js';

// Canary Metrics Logger (observability)
export {
  CanaryMetricsLogger,
  CANARY_METRICS_CONFIG,
  ANOMALY_TYPES,
  SEVERITY,
  getCanaryMetricsLogger
} from './CanaryMetricsLogger.js';

/**
 * Create a guard AI instance with default configuration
 * @param {Object} options - Configuration options
 * @returns {GuardAI}
 */
export function createGuardAI(options = {}) {
  return new GuardAI({ ...GUARD_AI_CONFIG, ...options });
}

export default GuardAI;
