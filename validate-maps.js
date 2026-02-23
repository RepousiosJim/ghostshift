// Quick validation script for GhostShift map positions
// Updated for Phase 14 expanded maps (22x18)
const MAP_WIDTH = 22;
const MAP_HEIGHT = 18;

// Read actual levels from source
import { LEVEL_LAYOUTS } from './src/levels.js';

function validatePosition(name, field, pos) {
  if (!pos) return { valid: false, reason: 'missing' };
  const xValid = pos.x >= 0 && pos.x < MAP_WIDTH;
  const yValid = pos.y >= 0 && pos.y < MAP_HEIGHT;
  if (xValid && yValid) return { valid: true };
  return { valid: false, reason: `out of bounds (x=${pos.x}, y=${pos.y}, max x=${MAP_WIDTH-1}, max y=${MAP_HEIGHT-1})` };
}

console.log('=== GhostShift Map Position Validation ===\n');
console.log(`Map bounds: x=[0,${MAP_WIDTH-1}], y=[0,${MAP_HEIGHT-1}]\n`);

let totalErrors = 0;

LEVEL_LAYOUTS.forEach((level, idx) => {
  console.log(`Level ${idx + 1}: ${level.name}`);
  const fields = ['playerStart', 'exitZone', 'dataCore', 'keyCard', 'hackTerminal', 'securityCode', 'powerCell'];
  
  fields.forEach(field => {
    if (level[field]) {
      const result = validatePosition(level.name, field, level[field]);
      const status = result.valid ? '✓' : '✗';
      if (!result.valid) {
        totalErrors++;
        console.log(`  ${status} ${field}: ${result.reason}`);
      }
    }
  });
  
  // Check obstacles
  if (level.obstacles) {
    level.obstacles.forEach((obs, i) => {
      const result = validatePosition(level.name, 'obstacles', obs);
      if (!result.valid) {
        totalErrors++;
        console.log(`  ✗ obstacles[${i}]: ${result.reason}`);
      }
    });
  }
  
  // Check cameras
  if (level.cameras) {
    level.cameras.forEach((cam, i) => {
      const result = validatePosition(level.name, 'cameras', cam);
      if (!result.valid) {
        totalErrors++;
        console.log(`  ✗ cameras[${i}]: ${result.reason}`);
      }
    });
  }
  
  // Check motionSensors
  if (level.motionSensors) {
    level.motionSensors.forEach((ms, i) => {
      const result = validatePosition(level.name, 'motionSensors', ms);
      if (!result.valid) {
        totalErrors++;
        console.log(`  ✗ motionSensors[${i}]: ${result.reason}`);
      }
    });
  }
  
  // Check patrolDrones
  if (level.patrolDrones) {
    level.patrolDrones.forEach((drone, i) => {
      const result = validatePosition(level.name, 'patrolDrones', drone);
      if (!result.valid) {
        totalErrors++;
        console.log(`  ✗ patrolDrones[${i}]: ${result.reason}`);
      }
      // Check patrol waypoints
      if (drone.patrol) {
        drone.patrol.forEach((pt, j) => {
          const ptResult = validatePosition(level.name, 'patrolDrones.patrol', pt);
          if (!ptResult.valid) {
            totalErrors++;
            console.log(`  ✗ patrolDrones[${i}].patrol[${j}]: ${ptResult.reason}`);
          }
        });
      }
    });
  }
  
  console.log('');
});

console.log('=== Summary ===');
console.log(`Total errors: ${totalErrors}`);
console.log(`Status: ${totalErrors === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
