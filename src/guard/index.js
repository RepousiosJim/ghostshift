/**
 * Guard Module Index
 * 
 * Phase P1: Modular guard AI system extracted from main.js monolith.
 * Phase B: Enhanced AI with state machine V2, coordination, and anti-stuck tuning.
 * 
 * Architecture:
 * - GuardAI: Main orchestrator that coordinates all components (legacy)
 * - GuardAIV2: Enhanced orchestrator with new states and coordination
 * - GuardStateMachine: State management with hysteresis (legacy)
 * - GuardStateMachineV2: Enhanced state machine with SweepRoom, SearchPaths, ReturnToPatrol
 * - GuardCoordinator: Multi-enemy coordination (pursuer, flanker, room-checker)
 * - StuckDetector: Stuck detection and recovery (legacy)
 * - StuckDetectorV2: Enhanced stuck detection with doorway contention and hotspot tracking
 * - MovementSolver: Obstacle avoidance and direction calculation
 * - GuardDiagnostics: Runtime diagnostics and anomaly detection
 * 
 * Usage (V2):
 * ```javascript
 * import { GuardAIV2, GuardCoordinator, GUARD_STATES_V2, GUARD_AI_V2_CONFIG } from './guard/index.js';
 * 
 * const coordinator = new GuardCoordinator();
 * const ai = new GuardAIV2(config);
 * ai.setCoordinator(coordinator);
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

// Re-export main orchestrator (legacy)
export { GuardAI, GUARD_STATES, GUARD_AI_CONFIG };

// Import V2 orchestrator
import { GuardAIV2, GUARD_STATES_V2, GUARD_AI_V2_CONFIG, DIFFICULTY_PRESETS } from './GuardAIV2.js';

// Re-export V2 orchestrator
export { GuardAIV2, GUARD_STATES_V2, GUARD_AI_V2_CONFIG, DIFFICULTY_PRESETS };

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

// Nav-aware Guard AI (Phase A: nav graph integration)
export {
  GuardNavAdapter,
  NAV_ADAPTER_CONFIG
} from './GuardNavAdapter.js';

// Phase B: State Machine V2 with enhanced states
export {
  GuardStateMachineV2,
  GUARD_STATES_V2 as GUARD_STATE_V2_CONSTANTS,
  STATE_MACHINE_V2_CONFIG,
  TRANSITION_REASONS
} from './GuardStateMachineV2.js';

// Phase B: Multi-enemy coordination
export {
  GuardCoordinator,
  COORD_ROLES,
  COORDINATOR_CONFIG
} from './GuardCoordinator.js';

// Phase B: Enhanced stuck detection
export {
  StuckDetectorV2,
  STUCK_DETECTOR_V2_CONFIG
} from './StuckDetectorV2.js';

/**
 * Create a guard AI instance with default configuration
 * @param {Object} options - Configuration options
 * @returns {GuardAI}
 */
export function createGuardAI(options = {}) {
  return new GuardAI({ ...GUARD_AI_CONFIG, ...options });
}

/**
 * Create a nav-aware guard AI instance
 * @param {Object} options - Configuration options
 * @returns {GuardNavAdapter}
 */
export function createNavGuardAI(options = {}) {
  return new GuardNavAdapter({ ...GUARD_AI_CONFIG, ...options });
}

/**
 * Create a guard AI V2 instance with enhanced features
 * @param {Object} options - Configuration options
 * @returns {GuardAIV2}
 */
export function createGuardAIV2(options = {}) {
  return new GuardAIV2({ ...GUARD_AI_V2_CONFIG, ...options });
}

/**
 * Create a guard coordinator for multi-enemy coordination
 * @param {Object} options - Configuration options
 * @returns {GuardCoordinator}
 */
export function createGuardCoordinator(options = {}) {
  return new GuardCoordinator(options);
}

export default GuardAI;
