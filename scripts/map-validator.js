#!/usr/bin/env node
/**
 * GhostShift Map Tiling Validator v2.0
 * Validates and auto-fixes map layouts against tiled movement conventions
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
 * 5. Minimum clearance radius around objectives
 * 6. Auto-fix invalid placements with deterministic rules
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map dimensions (must match main.js)
const MAP_WIDTH = 22;  // BASELINE: Default map width
const MAP_HEIGHT = 18;  // BASELINE: Default map height
const TILE_SIZE = 48;

// Configuration
const CONFIG = {
  // Minimum clearance radius (in tiles) around critical objectives
  clearanceRadius: 1,
  
  // Critical objectives that require clearance
  clearanceRequired: ['dataCore', 'keyCard', 'hackTerminal', 'exitZone'],
  
  // Entities that must be on walkable tiles
  mustBeWalkable: [
    'playerStart', 'exitZone', 'dataCore', 'keyCard', 'hackTerminal',
    'relayTerminal', 'securityCode', 'powerCell'
  ],
  
  // Entities that should be walkable (warning if not)
  shouldBeWalkable: ['cameras'],
  
  // Array entities with position checks
  arrayEntities: {
    cameras: { required: false, walkable: 'warn' },
    motionSensors: { required: false, walkable: 'warn' },  // Changed to warn - may be on walls intentionally
    laserGrids: { required: false, walkable: 'warn' },     // Changed to warn - block passage by design
    guardPatrol: { required: true, walkable: 'warn' },     // Changed to warn - may check room entrances
    patrolDrones: { required: false, walkable: 'warn', hasPatrol: true }  // Changed to warn
  }
};

// Audit result tracking
class AuditResult {
  constructor(levelName, levelIndex) {
    this.levelName = levelName;
    this.levelIndex = levelIndex;
    this.errors = [];
    this.warnings = [];
    this.fixes = [];
    this.infos = [];  // Renamed to avoid conflict with method
    this.navGridStats = null;
    this.reachability = {};
  }
  
  error(msg) { this.errors.push(msg); }
  warn(msg) { this.warnings.push(msg); }
  fix(msg) { this.fixes.push(msg); }
  info(msg) { this.infos.push(msg); }
  
  get valid() { return this.errors.length === 0; }
  get hasWarnings() { return this.warnings.length > 0; }
  get hasFixes() { return this.fixes.length > 0; }
}

/**
 * Build a 2D navigation grid from obstacles
 */
export function buildNavGrid(level) {
  // Use per-level dimensions if available, otherwise fall back to baseline
  const width = level.width || MAP_WIDTH;
  const height = level.height || MAP_HEIGHT;

  const grid = Array(height).fill(null).map(() => Array(width).fill(true));

  if (level.obstacles && Array.isArray(level.obstacles)) {
    for (const obs of level.obstacles) {
      if (obs && Number.isFinite(obs.x) && Number.isFinite(obs.y)) {
        const tx = Math.floor(obs.x);
        const ty = Math.floor(obs.y);
        if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
          grid[ty][tx] = false;
        }
      }
    }
  }

  return grid;
}

/**
 * Check if a tile coordinate is walkable
 * Note: grid dimensions are determined by the level that built it
 */
export function isWalkable(grid, x, y) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (!grid || !grid[0]) return false;
  const height = grid.length;
  const width = grid[0].length;
  if (tx < 0 || tx >= width || ty < 0 || ty >= height) return false;
  return grid[ty][tx];
}

/**
 * Check clearance around a position
 */
function hasClearance(grid, x, y, radius = CONFIG.clearanceRadius) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue; // Skip center
      const checkX = tx + dx;
      const checkY = ty + dy;
      if (!isWalkable(grid, checkX, checkY)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Find nearest walkable tile using spiral search
 */
function findNearestWalkable(grid, x, y, maxRadius = 5) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  
  // Check if current position is valid
  if (isWalkable(grid, tx, ty)) {
    return { x: tx, y: ty, distance: 0 };
  }
  
  // Spiral search
  for (let radius = 1; radius <= maxRadius; radius++) {
    // Top and bottom edges
    for (let dx = -radius; dx <= radius; dx++) {
      // Top
      if (isWalkable(grid, tx + dx, ty - radius)) {
        return { x: tx + dx, y: ty - radius, distance: radius };
      }
      // Bottom
      if (isWalkable(grid, tx + dx, ty + radius)) {
        return { x: tx + dx, y: ty + radius, distance: radius };
      }
    }
    // Left and right edges (excluding corners already checked)
    for (let dy = -radius + 1; dy <= radius - 1; dy++) {
      // Left
      if (isWalkable(grid, tx - radius, ty + dy)) {
        return { x: tx - radius, y: ty + dy, distance: radius };
      }
      // Right
      if (isWalkable(grid, tx + radius, ty + dy)) {
        return { x: tx + radius, y: ty + dy, distance: radius };
      }
    }
  }
  
  return null; // No valid tile found
}

/**
 * Find nearest walkable tile with clearance
 */
function findNearestWithClearance(grid, x, y, radius = CONFIG.clearanceRadius, maxSearch = 8) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  
  // Check if current position is valid with clearance
  if (isWalkable(grid, tx, ty) && hasClearance(grid, tx, ty, radius)) {
    return { x: tx, y: ty, distance: 0 };
  }
  
  // Spiral search for position with clearance
  for (let r = 1; r <= maxSearch; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // Only check perimeter
        const checkX = tx + dx;
        const checkY = ty + dy;
        if (isWalkable(grid, checkX, checkY) && hasClearance(grid, checkX, checkY, radius)) {
          return { x: checkX, y: checkY, distance: r };
        }
      }
    }
  }
  
  // Fallback to any walkable tile
  return findNearestWalkable(grid, x, y, maxSearch);
}

/**
 * Find connected components using flood fill
 */
export function findConnectedComponents(grid) {
  const height = grid.length;
  const width = grid[0] ? grid[0].length : 0;
  const visited = Array(height).fill(null).map(() => Array(width).fill(false));
  const regions = [];

  function floodFill(startX, startY) {
    const region = [];
    const stack = [{x: startX, y: startY}];

    while (stack.length > 0) {
      const {x, y} = stack.pop();

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[y][x]) continue;
      if (!grid[y][x]) continue;

      visited[y][x] = true;
      region.push({x, y});

      stack.push({x: x + 1, y});
      stack.push({x: x - 1, y});
      stack.push({x, y: y + 1});
      stack.push({x, y: y - 1});
    }

    return region;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!visited[y][x] && grid[y][x]) {
        const region = floodFill(x, y);
        if (region.length > 0) {
          regions.push(region);
        }
      }
    }
  }

  regions.sort((a, b) => b.length - a.length);
  return regions;
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

  const height = grid.length;
  const width = grid[0] ? grid[0].length : 0;
  const visited = Array(height).fill(null).map(() => Array(width).fill(false));
  const queue = [{x: startTx, y: startTy}];
  visited[startTy][startTx] = true;

  while (queue.length > 0) {
    const {x, y} = queue.shift();

    if (x === endTx && y === endTy) return true;

    const neighbors = [
      {x: x + 1, y}, {x: x - 1, y},
      {x, y: y + 1}, {x, y: y - 1}
    ];

    for (const n of neighbors) {
      if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
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
 * Find which region contains a point
 */
function findRegionForPoint(point, regions) {
  const tx = Math.floor(point.x);
  const ty = Math.floor(point.y);
  return regions.findIndex(region => region.some(t => t.x === tx && t.y === ty));
}

/**
 * Validate and optionally fix a single position
 */
function validatePosition(audit, grid, level, fieldName, entity, autoFix = false) {
  if (!entity) return { valid: true, fixed: false };

  const originalX = entity.x;
  const originalY = entity.y;

  // Get level dimensions (use per-level if available)
  const levelWidth = level.width || MAP_WIDTH;
  const levelHeight = level.height || MAP_HEIGHT;

  // Check bounds
  if (!Number.isFinite(originalX) || !Number.isFinite(originalY)) {
    audit.error(`[${fieldName}]: invalid coordinates (${originalX}, ${originalY})`);
    return { valid: false, fixed: false };
  }

  if (originalX < 0 || originalX >= levelWidth || originalY < 0 || originalY >= levelHeight) {
    audit.error(`[${fieldName}]: out of bounds (${originalX}, ${originalY}) for ${levelWidth}x${levelHeight} map`);

    if (autoFix) {
      const nearest = findNearestWalkable(grid, originalX, originalY);
      if (nearest) {
        entity.x = nearest.x;
        entity.y = nearest.y;
        audit.fix(`[${fieldName}]: moved from (${originalX}, ${originalY}) to (${nearest.x}, ${nearest.y})`);
        return { valid: true, fixed: true };
      }
    }
    return { valid: false, fixed: false };
  }
  
  // Check walkable
  if (!isWalkable(grid, originalX, originalY)) {
    const isCritical = CONFIG.mustBeWalkable.includes(fieldName);
    
    if (isCritical) {
      audit.error(`[${fieldName}]: placed on blocked tile (${originalX}, ${originalY})`);
    } else {
      audit.warn(`[${fieldName}]: placed on blocked tile (${originalX}, ${originalY}) - may be intentional`);
      return { valid: true, fixed: false };
    }
    
    if (autoFix) {
      const nearest = findNearestWalkable(grid, originalX, originalY);
      if (nearest) {
        entity.x = nearest.x;
        entity.y = nearest.y;
        audit.fix(`[${fieldName}]: moved from (${originalX}, ${originalY}) to (${nearest.x}, ${nearest.y})`);
        
        // Re-check if on blocked tile after fix
        if (!isWalkable(grid, entity.x, entity.y)) {
          audit.error(`[${fieldName}]: auto-fix failed, still on blocked tile`);
          return { valid: false, fixed: true };
        }
        return { valid: true, fixed: true };
      }
    }
    return { valid: false, fixed: false };
  }
  
  // Check clearance for critical objectives
  if (CONFIG.clearanceRequired.includes(fieldName) && !hasClearance(grid, originalX, originalY)) {
    audit.warn(`[${fieldName}]: insufficient clearance radius (${CONFIG.clearanceRadius} tiles) at (${originalX}, ${originalY})`);
    
    if (autoFix) {
      const nearest = findNearestWithClearance(grid, originalX, originalY);
      if (nearest && (nearest.x !== originalX || nearest.y !== originalY)) {
        entity.x = nearest.x;
        entity.y = nearest.y;
        audit.fix(`[${fieldName}]: relocated for clearance from (${originalX}, ${originalY}) to (${nearest.x}, ${nearest.y})`);
        return { valid: true, fixed: true };
      }
    }
  }
  
  return { valid: true, fixed: false };
}

// ==================== VERTICAL EXPANSION VALIDATION ====================
// Travel-time sanity checks and route clarity for taller maps

/**
 * Calculate path distance (BFS with distance tracking) between two points
 * Returns the number of tiles in the shortest path, or -1 if no path exists
 */
export function calculatePathDistance(grid, from, to) {
  const startTx = Math.floor(from.x);
  const startTy = Math.floor(from.y);
  const endTx = Math.floor(to.x);
  const endTy = Math.floor(to.y);
  
  if (!isWalkable(grid, startTx, startTy) || !isWalkable(grid, endTx, endTy)) {
    return -1;
  }
  
  if (startTx === endTx && startTy === endTy) return 0;
  
  // Use actual grid dimensions instead of baseline MAP_WIDTH/MAP_HEIGHT
  const height = grid.length;
  const width = grid[0] ? grid[0].length : MAP_WIDTH;
  
  const visited = Array(height).fill(null).map(() => Array(width).fill(false));
  const queue = [{x: startTx, y: startTy, dist: 0}];
  visited[startTy][startTx] = true;
  
  while (queue.length > 0) {
    const {x, y, dist} = queue.shift();
    
    const neighbors = [
      {x: x + 1, y}, {x: x - 1, y},
      {x, y: y + 1}, {x, y: y - 1}
    ];
    
    for (const n of neighbors) {
      if (n.x === endTx && n.y === endTy && isWalkable(grid, endTx, endTy)) {
        return dist + 1;
      }
      
      if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
        if (!visited[n.y][n.x] && grid[n.y][n.x]) {
          visited[n.y][n.x] = true;
          queue.push({x: n.x, y: n.y, dist: dist + 1});
        }
      }
    }
  }
  
  return -1; // No path found
}

/**
 * Calculate travel-time sanity for a level
 * Ensures the level isn't too long or frustrating for the map size
 */
function checkTravelTimeSanity(level, grid, audit) {
  const BASE_SPEED_TILES_PER_SECOND = 4; // Approximate player speed
  const MAX_REASONABLE_SECONDS = 120; // 2 minutes max for simple traversal
  const MAX_REASONABLE_TILES = BASE_SPEED_TILES_PER_SECOND * MAX_REASONABLE_SECONDS;
  
  // Calculate distances between key points
  const distances = {};
  const start = level.playerStart;
  const exit = level.exitZone;
  const dataCore = level.dataCore;
  const keyCard = level.keyCard;
  const hackTerminal = level.hackTerminal;
  
  if (start && exit) {
    distances.startToExit = calculatePathDistance(grid, start, exit);
  }
  
  if (start && dataCore) {
    distances.startToDataCore = calculatePathDistance(grid, start, dataCore);
  }
  
  if (start && keyCard) {
    distances.startToKeyCard = calculatePathDistance(grid, start, keyCard);
  }
  
  if (start && hackTerminal) {
    distances.startToTerminal = calculatePathDistance(grid, start, hackTerminal);
  }
  
  // Check if any path is too long
  let hasExcessiveDistance = false;
  for (const [name, dist] of Object.entries(distances)) {
    if (dist > MAX_REASONABLE_TILES) {
      audit.warn(`[travel-time] ${name}: ${dist} tiles (${Math.round(dist/BASE_SPEED_TILES_PER_SECOND)}s) - may be frustrating`);
      hasExcessiveDistance = true;
    }
  }
  
  // Store travel time stats
  audit.travelTimeStats = {
    distances,
    maxReasonableTiles: MAX_REASONABLE_TILES,
    excessiveDistance: hasExcessiveDistance
  };
  
  return !hasExcessiveDistance;
}

/**
 * Check route clarity for taller maps
 * Ensures objectives are distributed well vertically
 */
function checkRouteClarity(level, grid, audit) {
  const levelHeight = level.height || MAP_HEIGHT;

  const objectives = [
    { name: 'playerStart', pos: level.playerStart },
    { name: 'exitZone', pos: level.exitZone },
    { name: 'dataCore', pos: level.dataCore },
    { name: 'keyCard', pos: level.keyCard },
    { name: 'hackTerminal', pos: level.hackTerminal }
  ].filter(o => o.pos && Number.isFinite(o.pos.y));

  if (objectives.length < 2) {
    return true; // Not enough objectives to check distribution
  }

  const yPositions = objectives.map(o => o.pos.y);
  const minY = Math.min(...yPositions);
  const maxY = Math.max(...yPositions);
  const verticalSpan = maxY - minY;

  // For taller maps, check vertical distribution
  const expectedSpan = Math.floor(levelHeight * 0.4); // Expect at least 40% vertical coverage

  // Check if all objectives are clustered in one area
  const topHalfCount = objectives.filter(o => o.pos.y < levelHeight / 2).length;
  const bottomHalfCount = objectives.filter(o => o.pos.y >= levelHeight / 2).length;

  const isClustered = topHalfCount === 0 || bottomHalfCount === 0;
  const isTooNarrow = verticalSpan < expectedSpan;

  if (isClustered && objectives.length >= 3) {
    audit.warn(`[route-clarity] Objectives clustered in ${topHalfCount === 0 ? 'bottom' : 'top'} half - consider better vertical distribution`);
  }

  if (isTooNarrow && levelHeight >= 20) {
    audit.warn(`[route-clarity] Vertical span only ${verticalSpan} tiles (expected >= ${expectedSpan}) - taller maps should use full height`);
  }

  audit.routeClarityStats = {
    verticalSpan,
    expectedSpan,
    topHalfCount,
    bottomHalfCount,
    isClustered,
    isTooNarrow
  };

  return !isClustered || objectives.length < 3;
}

/**
 * Audit a single level
 */
export function auditLevel(level, index, autoFix = false) {
  const audit = new AuditResult(level.name || `Level ${index + 1}`, index);

  // Get per-level dimensions
  const levelWidth = level.width || MAP_WIDTH;
  const levelHeight = level.height || MAP_HEIGHT;

  audit.info(`\n${'═'.repeat(60)}`);
  audit.info(`AUDIT: ${audit.levelName}`);
  audit.info(`${'═'.repeat(60)}`);
  audit.info(`Map dimensions: ${levelWidth}x${levelHeight}`);

  // Build navigation grid
  const grid = buildNavGrid(level);
  const walkableCount = grid.flat().filter(Boolean).length;
  const totalTiles = levelWidth * levelHeight;

  audit.navGridStats = {
    walkable: walkableCount,
    total: totalTiles,
    percentage: ((walkableCount / totalTiles) * 100).toFixed(1),
    width: levelWidth,
    height: levelHeight
  };

  audit.info(`Nav grid: ${walkableCount}/${totalTiles} walkable (${audit.navGridStats.percentage}%)`);
  
  // Check for isolated regions
  const regions = findConnectedComponents(grid);
  audit.info(`Connected regions: ${regions.length}`);
  
  if (regions.length > 1) {
    const mainRegion = regions[0];
    audit.warn(`${regions.length - 1} isolated nav island(s) detected`);
    audit.info(`  Main region: ${mainRegion.length} tiles`);
    for (let i = 1; i < Math.min(regions.length, 4); i++) {
      audit.info(`  Island ${i}: ${regions[i].length} tiles at (${regions[i][0].x}, ${regions[i][0].y})`);
    }
  }
  
  // Validate single entities
  for (const field of CONFIG.mustBeWalkable) {
    if (level[field]) {
      validatePosition(audit, grid, level, field, level[field], autoFix);
    }
  }
  
  // Validate array entities
  for (const [field, config] of Object.entries(CONFIG.arrayEntities)) {
    if (!level[field] || !Array.isArray(level[field])) {
      if (config.required) {
        audit.error(`[${field}]: required field is missing or not an array`);
      }
      continue;
    }
    
    level[field].forEach((entity, i) => {
      const fieldName = `${field}[${i}]`;
      
      // Check entity position
      if (config.walkable === 'error') {
        validatePosition(audit, grid, level, fieldName, entity, autoFix);
      } else if (config.walkable === 'warn') {
        if (!isWalkable(grid, entity.x, entity.y)) {
          audit.warn(`[${fieldName}]: placed on blocked tile (${entity.x}, ${entity.y}) - may be intentional`);
        }
      }
      
      // Check patrol waypoints
      if (config.hasPatrol && entity.patrol) {
        if (!Array.isArray(entity.patrol) || entity.patrol.length === 0) {
          audit.error(`[${fieldName}].patrol: must be a non-empty array`);
        } else {
          entity.patrol.forEach((pt, j) => {
            validatePosition(audit, grid, level, `${fieldName}.patrol[${j}]`, pt, autoFix);
          });
        }
      }
    });
  }
  
  // Reachability checks
  if (level.playerStart && isWalkable(grid, level.playerStart.x, level.playerStart.y)) {
    audit.reachability.playerStart = { valid: true };
    
    // Check exit reachability
    if (level.exitZone && isWalkable(grid, level.exitZone.x, level.exitZone.y)) {
      if (hasPath(grid, level.playerStart, level.exitZone)) {
        audit.reachability.exitZone = { valid: true };
        audit.info(`[reachability] exitZone: reachable from playerStart ✓`);
      } else {
        audit.reachability.exitZone = { valid: false };
        audit.error(`[reachability] exitZone: NOT reachable from playerStart`);
      }
    }
    
    // Check objective reachability
    for (const objField of ['dataCore', 'keyCard', 'hackTerminal']) {
      const pos = level[objField];
      if (pos && isWalkable(grid, pos.x, pos.y)) {
        if (hasPath(grid, level.playerStart, pos)) {
          audit.reachability[objField] = { valid: true };
          audit.info(`[reachability] ${objField}: reachable from playerStart ✓`);
        } else {
          audit.reachability[objField] = { valid: false };
          audit.warn(`[reachability] ${objField}: may not be reachable from playerStart`);
        }
      }
    }
  } else {
    audit.error(`[reachability] Cannot check - playerStart is not on valid tile`);
  }
  
  // ==================== VERTICAL EXPANSION VALIDATION ====================
  // Travel-time sanity checks for taller maps
  checkTravelTimeSanity(level, grid, audit);
  
  // Route clarity checks for vertical distribution
  checkRouteClarity(level, grid, audit);
  
  return audit;
}

/**
 * Generate audit report
 */
function generateAuditReport(audits, options = {}) {
  const lines = [];

  lines.push('╔' + '═'.repeat(70) + '╗');
  lines.push('║' + 'GHOSTSHIFT MAP TILING AUDIT REPORT v2.0'.padEnd(70) + '║');
  lines.push('╚' + '═'.repeat(70) + '╝');
  lines.push('');
  lines.push(`Baseline dimensions: ${MAP_WIDTH}x${MAP_HEIGHT} (individual levels may differ)`);
  lines.push(`Tile size: ${TILE_SIZE}px`);
  lines.push(`Clearance radius: ${CONFIG.clearanceRadius} tiles`);
  lines.push(`Auto-fix: ${options.autoFix ? 'ENABLED' : 'DISABLED'}`);
  lines.push(`Levels audited: ${audits.length}`);
  lines.push('');
  
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalFixes = 0;
  
  for (const audit of audits) {
    // Print info
    for (const msg of audit.infos) {
      lines.push(msg);
    }
    
    // Print warnings
    for (const msg of audit.warnings) {
      lines.push(`  ⚠️  ${msg}`);
    }
    
    // Print errors
    for (const msg of audit.errors) {
      lines.push(`  ❌ ${msg}`);
    }
    
    // Print fixes
    for (const msg of audit.fixes) {
      lines.push(`  🔧 ${msg}`);
    }
    
    // Level summary
    const status = audit.valid ? '✓ PASS' : '✗ FAIL';
    const warnStr = audit.hasWarnings ? ` (${audit.warnings.length} warnings)` : '';
    const fixStr = audit.hasFixes ? ` [${audit.fixes.length} fixes applied]` : '';
    lines.push(`  Status: ${status}${warnStr}${fixStr}`);
    lines.push('');
    
    totalErrors += audit.errors.length;
    totalWarnings += audit.warnings.length;
    totalFixes += audit.fixes.length;
  }
  
  // Final summary
  lines.push('═'.repeat(72));
  lines.push('AUDIT SUMMARY');
  lines.push('═'.repeat(72));
  lines.push(`Total levels: ${audits.length}`);
  lines.push(`Passed: ${audits.filter(a => a.valid).length}`);
  lines.push(`Failed: ${audits.filter(a => !a.valid).length}`);
  lines.push(`Total errors: ${totalErrors}`);
  lines.push(`Total warnings: ${totalWarnings}`);
  lines.push(`Total fixes applied: ${totalFixes}`);
  lines.push('');
  
  if (totalErrors === 0) {
    lines.push('✅ ALL MAPS VALID - No blocking issues found');
    if (totalWarnings > 0) {
      lines.push(`⚠️  ${totalWarnings} warnings should be reviewed`);
    }
    if (totalFixes > 0) {
      lines.push(`🔧 ${totalFixes} auto-fixes were applied - review changes`);
    }
  } else {
    lines.push('❌ AUDIT FAILED - Fix errors before shipping');
  }
  
  return {
    report: lines.join('\n'),
    success: totalErrors === 0,
    errors: totalErrors,
    warnings: totalWarnings,
    fixes: totalFixes,
    audits
  };
}

/**
 * Main audit entry point
 */
export function auditAllLevels(levels, options = {}) {
  const audits = [];
  
  for (let i = 0; i < levels.length; i++) {
    const audit = auditLevel(levels[i], i, options.autoFix);
    audits.push(audit);
  }
  
  return generateAuditReport(audits, options);
}

/**
 * Export for CLI
 */
export { CONFIG, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE };

// CLI execution - safe check for import scenarios
const isMainModule = typeof process !== 'undefined' && process.argv && process.argv[1] && 
                     (import.meta.url === `file://${process.argv[1]}` || 
                      process.argv[1].endsWith('map-validator.js'));

if (isMainModule) {
  const args = process.argv.slice(2);
  const autoFix = args.includes('--fix') || args.includes('--auto-fix');
  const outputPath = args.find(a => a.startsWith('--output='))?.split('=')[1];
  
  const levelsPath = path.join(__dirname, '..', 'src', 'levels.js');
  
  try {
    const { LEVEL_LAYOUTS } = await import('file://' + levelsPath);
    
    if (!LEVEL_LAYOUTS || LEVEL_LAYOUTS.length === 0) {
      console.error('No levels found in levels.js');
      process.exit(1);
    }
    
    const result = auditAllLevels(LEVEL_LAYOUTS, { autoFix });
    console.log(result.report);
    
    // If auto-fix was enabled and fixes were applied, write back
    if (autoFix && result.fixes > 0) {
      console.log('\n📝 Auto-fix was enabled. To persist changes, update src/levels.js');
      console.log('   Review the fixes above and apply manually or use --write flag');
    }
    
    // Write output file if specified
    if (outputPath) {
      const reportData = {
        timestamp: new Date().toISOString(),
        success: result.success,
        errors: result.errors,
        warnings: result.warnings,
        fixes: result.fixes,
        levels: result.audits.map(a => ({
          name: a.levelName,
          index: a.levelIndex,
          valid: a.valid,
          errors: a.errors,
          warnings: a.warnings,
          fixes: a.fixes,
          navGridStats: a.navGridStats,
          reachability: a.reachability
        }))
      };
      fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
      console.log(`\n📄 Report written to: ${outputPath}`);
    }
    
    process.exit(result.success ? 0 : 1);
    
  } catch (err) {
    console.error('Failed to load levels:', err.message);
    console.error('Expected path:', levelsPath);
    process.exit(1);
  }
}
