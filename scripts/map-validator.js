#!/usr/bin/env node
/**
 * GhostShift Map Tiling Validator
 * Validates map layouts against tiled movement conventions
 * 
 * Layer Conventions:
 * - Floor layer: All tiles not in obstacles array (walkable by default)
 * - Wall layer: obstacles[] array (blocking tiles)
 * - Nav layer: Derived from floor - wall, defines valid movement grid
 * - Vision blockers: Walls naturally block vision (implicit)
 * 
 * Validation Rules:
 * 1. Player/Enemy spawns must be on walkable tiles
 * 2. Patrol waypoints must be on walkable tiles
 * 3. Objectives must be reachable from player start
 * 4. No isolated/unreachable nav islands
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map dimensions (must match main.js)
const MAP_WIDTH = 22;
const MAP_HEIGHT = 18;
const TILE_SIZE = 48;

// Validation result tracking
class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.infos = [];  // Renamed to avoid conflict with method
  }
  
  error(msg) { this.errors.push(msg); }
  warn(msg) { this.warnings.push(msg); }
  info(msg) { this.infos.push(msg); }
  
  get valid() { return this.errors.length === 0; }
  get hasWarnings() { return this.warnings.length > 0; }
  
  summary() {
    return {
      valid: this.valid,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      infoCount: this.infos.length
    };
  }
}

/**
 * Build a 2D navigation grid from obstacles
 * Returns a 2D array where true = walkable, false = blocked
 */
export function buildNavGrid(level) {
  const grid = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(true));
  
  // Mark obstacles as blocked
  if (level.obstacles && Array.isArray(level.obstacles)) {
    for (const obs of level.obstacles) {
      if (obs && Number.isFinite(obs.x) && Number.isFinite(obs.y)) {
        const tx = Math.floor(obs.x);
        const ty = Math.floor(obs.y);
        if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
          grid[ty][tx] = false;
        }
      }
    }
  }
  
  return grid;
}

/**
 * Check if a tile coordinate is walkable
 */
export function isWalkable(grid, x, y) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return false;
  return grid[ty][tx];
}

/**
 * Validate that a point is on a walkable tile
 */
function validateWalkablePosition(result, grid, point, fieldName, levelName) {
  if (!point) {
    result.warn(`[${levelName}] ${fieldName}: missing position`);
    return false;
  }
  
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    result.error(`[${levelName}] ${fieldName}: invalid coordinates (${point.x}, ${point.y})`);
    return false;
  }
  
  // Check bounds
  if (point.x < 0 || point.x >= MAP_WIDTH || point.y < 0 || point.y >= MAP_HEIGHT) {
    result.error(`[${levelName}] ${fieldName}: out of bounds (${point.x}, ${point.y}), max (${MAP_WIDTH-1}, ${MAP_HEIGHT-1})`);
    return false;
  }
  
  // Check walkable
  if (!isWalkable(grid, point.x, point.y)) {
    result.error(`[${levelName}] ${fieldName}: placed on blocked tile (${point.x}, ${point.y})`);
    return false;
  }
  
  return true;
}

/**
 * Find connected components using flood fill
 * Returns array of regions, each region is array of {x,y} tiles
 */
export function findConnectedComponents(grid) {
  const visited = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(false));
  const regions = [];
  
  function floodFill(startX, startY) {
    const region = [];
    const stack = [{x: startX, y: startY}];
    
    while (stack.length > 0) {
      const {x, y} = stack.pop();
      
      if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) continue;
      if (visited[y][x]) continue;
      if (!grid[y][x]) continue; // blocked
      
      visited[y][x] = true;
      region.push({x, y});
      
      // 4-directional (cardinal only for tile-based movement)
      stack.push({x: x + 1, y});
      stack.push({x: x - 1, y});
      stack.push({x, y: y + 1});
      stack.push({x, y: y - 1});
    }
    
    return region;
  }
  
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (!visited[y][x] && grid[y][x]) {
        const region = floodFill(x, y);
        if (region.length > 0) {
          regions.push(region);
        }
      }
    }
  }
  
  // Sort by size descending
  regions.sort((a, b) => b.length - a.length);
  
  return regions;
}

/**
 * Check if a point is in a region
 */
function pointInRegion(point, region) {
  const tx = Math.floor(point.x);
  const ty = Math.floor(point.y);
  return region.some(t => t.x === tx && t.y === ty);
}

/**
 * Find which region contains a point
 */
function findRegionForPoint(point, regions) {
  const tx = Math.floor(point.x);
  const ty = Math.floor(point.y);
  return regions.findIndex(region => region.some(t => t.x === tx && t.y === ty));
}

/**
 * BFS to check if path exists between two points
 */
export function hasPath(grid, from, to) {
  const startTx = Math.floor(from.x);
  const startTy = Math.floor(from.y);
  const endTx = Math.floor(to.x);
  const endTy = Math.floor(to.y);
  
  if (!isWalkable(grid, startTx, startTy) || !isWalkable(grid, endTx, endTy)) {
    return false;
  }
  
  const visited = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(false));
  const queue = [{x: startTx, y: startTy}];
  visited[startTy][startTx] = true;
  
  while (queue.length > 0) {
    const {x, y} = queue.shift();
    
    if (x === endTx && y === endTy) return true;
    
    const neighbors = [
      {x: x + 1, y},
      {x: x - 1, y},
      {x, y: y + 1},
      {x, y: y - 1}
    ];
    
    for (const n of neighbors) {
      if (n.x >= 0 && n.x < MAP_WIDTH && n.y >= 0 && n.y < MAP_HEIGHT) {
        if (!visited[n.y][n.x] && grid[n.y][n.x]) {
          visited[n.y][n.x] = true;
          queue.push(n);
        }
      }
    }
  }
  
  return false;
}

/**
 * Validate a single level layout
 */
export function validateLevel(level, index) {
  const result = new ValidationResult();
  const levelName = level.name || `Level ${index + 1}`;
  
  result.info(`\n=== Validating: ${levelName} ===`);
  
  // Build navigation grid
  const grid = buildNavGrid(level);
  const walkableCount = grid.flat().filter(Boolean).length;
  const totalTiles = MAP_WIDTH * MAP_HEIGHT;
  result.info(`Nav grid: ${walkableCount}/${totalTiles} walkable tiles (${((walkableCount/totalTiles)*100).toFixed(1)}%)`);
  
  // Check for isolated regions
  const regions = findConnectedComponents(grid);
  result.info(`Connected regions: ${regions.length}`);
  
  if (regions.length > 1) {
    // Find main region (largest)
    const mainRegion = regions[0];
    result.warn(`[${levelName}] ${regions.length - 1} isolated nav island(s) detected`);
    result.info(`  Main region: ${mainRegion.length} tiles`);
    for (let i = 1; i < regions.length; i++) {
      result.info(`  Isolated island ${i}: ${regions[i].length} tiles at (${regions[i][0].x}, ${regions[i][0].y})`);
    }
  }
  
  // Validate player spawn
  validateWalkablePosition(result, grid, level.playerStart, 'playerStart', levelName);
  
  // Validate exit zone
  validateWalkablePosition(result, grid, level.exitZone, 'exitZone', levelName);
  
  // Validate objectives
  if (level.dataCore) validateWalkablePosition(result, grid, level.dataCore, 'dataCore', levelName);
  if (level.keyCard) validateWalkablePosition(result, grid, level.keyCard, 'keyCard', levelName);
  if (level.hackTerminal) validateWalkablePosition(result, grid, level.hackTerminal, 'hackTerminal', levelName);
  if (level.relayTerminal) validateWalkablePosition(result, grid, level.relayTerminal, 'relayTerminal', levelName);
  if (level.securityCode) validateWalkablePosition(result, grid, level.securityCode, 'securityCode', levelName);
  if (level.powerCell) validateWalkablePosition(result, grid, level.powerCell, 'powerCell', levelName);
  
  // Validate cameras (can be on walls, but warn)
  if (level.cameras && Array.isArray(level.cameras)) {
    level.cameras.forEach((cam, i) => {
      if (!isWalkable(grid, cam.x, cam.y)) {
        result.warn(`[${levelName}] cameras[${i}]: placed on blocked tile (${cam.x}, ${cam.y}) - may be intentional`);
      }
    });
  }
  
  // Validate motion sensors (should be on walkable tiles)
  if (level.motionSensors && Array.isArray(level.motionSensors)) {
    level.motionSensors.forEach((ms, i) => {
      validateWalkablePosition(result, grid, ms, `motionSensors[${i}]`, levelName);
    });
  }
  
  // Validate laser grids (should be on walkable tiles for the beam to cross)
  if (level.laserGrids && Array.isArray(level.laserGrids)) {
    level.laserGrids.forEach((lg, i) => {
      validateWalkablePosition(result, grid, lg, `laserGrids[${i}]`, levelName);
    });
  }
  
  // Validate patrol drones and their waypoints
  if (level.patrolDrones && Array.isArray(level.patrolDrones)) {
    level.patrolDrones.forEach((drone, i) => {
      // Drone spawn position
      validateWalkablePosition(result, grid, drone, `patrolDrones[${i}]`, levelName);
      
      // Patrol waypoints
      if (drone.patrol && Array.isArray(drone.patrol)) {
        drone.patrol.forEach((pt, j) => {
          validateWalkablePosition(result, grid, pt, `patrolDrones[${i}].patrol[${j}]`, levelName);
        });
      } else {
        result.warn(`[${levelName}] patrolDrones[${i}]: missing or empty patrol waypoints`);
      }
    });
  }
  
  // Validate guard patrol waypoints
  if (level.guardPatrol && Array.isArray(level.guardPatrol)) {
    level.guardPatrol.forEach((pt, i) => {
      validateWalkablePosition(result, grid, pt, `guardPatrol[${i}]`, levelName);
    });
  }
  
  // Reachability checks (only if player start is valid)
  if (level.playerStart && isWalkable(grid, level.playerStart.x, level.playerStart.y)) {
    const playerRegion = findRegionForPoint(level.playerStart, regions);
    
    // Check exit reachability
    if (level.exitZone && isWalkable(grid, level.exitZone.x, level.exitZone.y)) {
      const exitRegion = findRegionForPoint(level.exitZone, regions);
      if (playerRegion !== exitRegion) {
        result.error(`[${levelName}] exitZone is NOT reachable from playerStart (different nav regions)`);
      } else if (!hasPath(grid, level.playerStart, level.exitZone)) {
        result.error(`[${levelName}] exitZone is NOT reachable from playerStart (no path found)`);
      } else {
        result.info(`[${levelName}] exitZone: reachable from playerStart ✓`);
      }
    }
    
    // Check key objectives reachability
    const objectives = [
      {name: 'dataCore', pos: level.dataCore},
      {name: 'keyCard', pos: level.keyCard},
      {name: 'hackTerminal', pos: level.hackTerminal}
    ];
    
    objectives.forEach(({name, pos}) => {
      if (pos && isWalkable(grid, pos.x, pos.y)) {
        if (!hasPath(grid, level.playerStart, pos)) {
          result.warn(`[${levelName}] ${name}: may not be reachable from playerStart`);
        } else {
          result.info(`[${levelName}] ${name}: reachable from playerStart ✓`);
        }
      }
    });
  }
  
  return result;
}

/**
 * Main validation entry point
 */
export function validateAllLevels(levels) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         GhostShift Map Tiling Validator v1.0                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nMap dimensions: ${MAP_WIDTH}x${MAP_HEIGHT} (${MAP_WIDTH * MAP_HEIGHT} tiles)`);
  console.log(`Tile size: ${TILE_SIZE}px`);
  console.log(`Levels to validate: ${levels.length}\n`);
  
  const allResults = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  
  levels.forEach((level, index) => {
    const result = validateLevel(level, index);
    allResults.push({level, index, result});
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
  });
  
  // Print detailed results
  allResults.forEach(({level, result}) => {
    // Print info
    result.infos.forEach(msg => console.log(msg));
    
    // Print warnings
    result.warnings.forEach(msg => console.log(`  ⚠️  ${msg}`));
    
    // Print errors
    result.errors.forEach(msg => console.log(`  ❌ ${msg}`));
    
    // Level summary
    const status = result.valid ? '✓ PASS' : '✗ FAIL';
    const warnStr = result.hasWarnings ? ` (${result.warnings.length} warnings)` : '';
    console.log(`  Status: ${status}${warnStr}\n`);
  });
  
  // Final summary
  console.log('══════════════════════════════════════════════════════════════');
  console.log('VALIDATION SUMMARY');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`Total levels: ${levels.length}`);
  console.log(`Passed: ${allResults.filter(r => r.result.valid).length}`);
  console.log(`Failed: ${allResults.filter(r => !r.result.valid).length}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Total warnings: ${totalWarnings}`);
  console.log('');
  
  if (totalErrors === 0) {
    console.log('✅ ALL MAPS VALID - No blocking issues found');
    if (totalWarnings > 0) {
      console.log(`⚠️  ${totalWarnings} warnings should be reviewed`);
    }
    return { success: true, errors: totalErrors, warnings: totalWarnings };
  } else {
    console.log('❌ VALIDATION FAILED - Fix errors before shipping');
    return { success: false, errors: totalErrors, warnings: totalWarnings };
  }
}

/**
 * Export nav grid for external use
 */
export function exportNavGrid(level) {
  return buildNavGrid(level);
}

/**
 * Get tile neighbors (4-directional)
 */
export function getNeighbors(x, y) {
  return [
    {x: x + 1, y, dir: 'E'},
    {x: x - 1, y, dir: 'W'},
    {x, y: y + 1, dir: 'S'},
    {x, y: y - 1, dir: 'N'}
  ].filter(n => n.x >= 0 && n.x < MAP_WIDTH && n.y >= 0 && n.y < MAP_HEIGHT);
}

// CLI execution
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1].endsWith('map-validator.js');

if (isMainModule) {
  // Load levels from levels.js
  const levelsPath = path.join(__dirname, '..', 'src', 'levels.js');
  
  try {
    const { LEVEL_LAYOUTS } = await import('file://' + levelsPath);
    
    if (!LEVEL_LAYOUTS || LEVEL_LAYOUTS.length === 0) {
      console.error('No levels found in levels.js');
      process.exit(1);
    }
    
    const result = validateAllLevels(LEVEL_LAYOUTS);
    process.exit(result.success ? 0 : 1);
    
  } catch (err) {
    console.error('Failed to load levels:', err.message);
    console.error('Expected path:', levelsPath);
    process.exit(1);
  }
}

// Named exports for API usage
export const CONSTANTS = { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE };
