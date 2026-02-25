#!/usr/bin/env node
/**
 * Level 1 Graph Analysis Script
 * Analyzes room structure, loops, and ingress routes for the graph-first refactor
 */

import { LEVEL_LAYOUTS } from '../src/levels.js';

const LEVEL_1_INDEX = 0;

function analyzeLevel1() {
  const level = LEVEL_LAYOUTS[LEVEL_1_INDEX];
  
  if (!level) {
    console.error('ERROR: Level 1 not found');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║        LEVEL 1 GRAPH-FIRST STRUCTURAL ANALYSIS                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log();
  
  // Basic info
  console.log('📋 BASIC INFO');
  console.log('─'.repeat(50));
  console.log(`  Name: ${level.name}`);
  console.log(`  Dimensions: ${level.width}x${level.height}`);
  console.log(`  Difficulty: ${level.difficulty}`);
  console.log();

  // Obstacle analysis
  const obstacles = level.obstacles || [];
  const obstacleSet = new Set(obstacles.map(o => `${o.x},${o.y}`));
  
  console.log('🧱 OBSTACLE ANALYSIS');
  console.log('─'.repeat(50));
  console.log(`  Total obstacles: ${obstacles.length}`);
  console.log();

  // Create walkable grid
  const grid = [];
  for (let y = 0; y < level.height; y++) {
    grid[y] = [];
    for (let x = 0; x < level.width; x++) {
      grid[y][x] = obstacleSet.has(`${x},${y}`) ? 1 : 0;
    }
  }

  // Room detection (find enclosed spaces)
  const rooms = detectRooms(grid, level.width, level.height);
  
  console.log('🏠 ROOM ANALYSIS');
  console.log('─'.repeat(50));
  console.log(`  Detected rooms: ${rooms.length}`);
  console.log(`  Target: 6-8 non-identical rooms`);
  console.log(`  Status: ${rooms.length >= 6 && rooms.length <= 8 ? '✅ PASS' : '❌ FAIL'}`);
  console.log();
  
  // Room details
  rooms.forEach((room, i) => {
    const size = `${room.width}x${room.height}`;
    console.log(`  Room ${i + 1}: ${size} at (${room.x}, ${room.y}) - ${room.tiles} tiles`);
  });
  console.log();

  // Graph connectivity analysis
  const graph = buildGraph(grid, level.width, level.height);
  const loops = findLoops(graph, rooms);
  
  console.log('🔄 GRAPH LOOP ANALYSIS');
  console.log('─'.repeat(50));
  console.log(`  Detected loops: ${loops.length}`);
  console.log(`  Target: >= 2 loops`);
  console.log(`  Status: ${loops.length >= 2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log();

  // Ingress analysis for Terminal and DataCore
  const terminalPos = level.hackTerminal;
  const dataCorePos = level.dataCore;
  
  const terminalIngress = countIngressRoutes(terminalPos, grid, level.width, level.height);
  const dataCoreIngress = countIngressRoutes(dataCorePos, grid, level.width, level.height);
  
  console.log('🚪 INGRESS ROUTE ANALYSIS');
  console.log('─'.repeat(50));
  console.log(`  Terminal ingress routes: ${terminalIngress}`);
  console.log(`  Target: >= 2`);
  console.log(`  Status: ${terminalIngress >= 2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log();
  console.log(`  DataCore ingress routes: ${dataCoreIngress}`);
  console.log(`  Target: >= 2`);
  console.log(`  Status: ${dataCoreIngress >= 2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log();

  // Objective flow analysis
  const objectives = [
    { name: 'Spawn', pos: level.playerStart },
    { name: 'Keycard', pos: level.keyCard },
    { name: 'Terminal', pos: level.hackTerminal },
    { name: 'DataCore', pos: level.dataCore },
    { name: 'Exit', pos: level.exitZone }
  ];
  
  console.log('🎯 OBJECTIVE FLOW ANALYSIS');
  console.log('─'.repeat(50));
  console.log('  Horizontal flow (left to right):');
  objectives.forEach((obj, i) => {
    if (obj.pos) {
      console.log(`    ${i + 1}. ${obj.name}: (${obj.pos.x}, ${obj.pos.y})`);
    }
  });
  console.log();

  // Check if objectives are in room interiors
  console.log('📐 OBJECTIVE PLACEMENT VALIDATION');
  console.log('─'.repeat(50));
  objectives.forEach(obj => {
    if (obj.pos) {
      const inRoom = isInRoomInterior(obj.pos, rooms);
      const onObstacle = obstacleSet.has(`${obj.pos.x},${obj.pos.y}`);
      console.log(`  ${obj.name}: ${inRoom ? '✅ In room interior' : '⚠️ Not in room interior'} ${onObstacle ? '❌ ON OBSTACLE!' : ''}`);
    }
  });
  console.log();

  // Patrol point validation
  const patrols = level.guardPatrol || [];
  console.log('👁️ PATROL POINT VALIDATION');
  console.log('─'.repeat(50));
  patrols.forEach((pt, i) => {
    const onObstacle = obstacleSet.has(`${pt.x},${pt.y}`);
    const atJunction = isAtJunction(pt, grid, level.width, level.height);
    console.log(`  Patrol ${i + 1}: (${pt.x}, ${pt.y}) ${onObstacle ? '❌ ON OBSTACLE!' : '✅ Walkable'} ${atJunction ? '✅ At junction' : '⚠️ Not at junction'}`);
  });
  console.log();

  // Path connectivity check
  console.log('🛤️ PATH CONNECTIVITY CHECK');
  console.log('─'.repeat(50));
  
  // Check paths between objectives
  const pathChecks = [
    { from: 'Spawn', to: 'Keycard', fromPos: level.playerStart, toPos: level.keyCard },
    { from: 'Keycard', to: 'Terminal', fromPos: level.keyCard, toPos: level.hackTerminal },
    { from: 'Terminal', to: 'DataCore', fromPos: level.hackTerminal, toPos: level.dataCore },
    { from: 'DataCore', to: 'Exit', fromPos: level.dataCore, toPos: level.exitZone }
  ];

  let allPathsValid = true;
  pathChecks.forEach(check => {
    if (check.fromPos && check.toPos) {
      const pathExists = hasPath(check.fromPos, check.toPos, grid, level.width, level.height);
      console.log(`  ${check.from} → ${check.to}: ${pathExists ? '✅ Reachable' : '❌ BLOCKED!'}`);
      if (!pathExists) allPathsValid = false;
    }
  });
  console.log();

  // Summary
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                      VALIDATION SUMMARY                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  const checks = [
    { name: 'Room count (6-8)', pass: rooms.length >= 6 && rooms.length <= 8 },
    { name: 'Graph loops (>=2)', pass: loops.length >= 2 },
    { name: 'Terminal ingress (>=2)', pass: terminalIngress >= 2 },
    { name: 'DataCore ingress (>=2)', pass: dataCoreIngress >= 2 },
    { name: 'All paths reachable', pass: allPathsValid }
  ];

  checks.forEach(check => {
    console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
  });
  console.log();

  const allPassed = checks.every(c => c.pass);
  console.log(`  Overall: ${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
  console.log();

  return {
    rooms: rooms.length,
    loops: loops.length,
    terminalIngress,
    dataCoreIngress,
    allPathsValid,
    allPassed
  };
}

function detectRooms(grid, width, height) {
  // Simple room detection based on enclosed rectangular areas
  const visited = new Set();
  const rooms = [];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (grid[y][x] === 0 && !visited.has(`${x},${y}`)) {
        // Try to find rectangular room
        const room = findRoomFromPoint(x, y, grid, width, height, visited);
        if (room && room.tiles >= 9) { // At least 3x3 interior
          rooms.push(room);
        }
      }
    }
  }
  
  return rooms;
}

function findRoomFromPoint(startX, startY, grid, width, height, visited) {
  // Flood fill to find connected walkable area
  const tiles = [];
  const queue = [{x: startX, y: startY}];
  visited.add(`${startX},${startY}`);
  
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  
  while (queue.length > 0) {
    const {x, y} = queue.shift();
    tiles.push({x, y});
    
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    
    const dirs = [{dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}];
    for (const {dx, dy} of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && 
          grid[ny][nx] === 0 && !visited.has(`${nx},${ny}`)) {
        visited.add(`${nx},${ny}`);
        queue.push({x: nx, y: ny});
      }
    }
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    tiles: tiles.length
  };
}

function buildGraph(grid, width, height) {
  // Build adjacency graph of walkable tiles
  const graph = new Map();
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] === 0) {
        const key = `${x},${y}`;
        const neighbors = [];
        
        const dirs = [{dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}];
        for (const {dx, dy} of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny][nx] === 0) {
            neighbors.push(`${nx},${ny}`);
          }
        }
        
        graph.set(key, neighbors);
      }
    }
  }
  
  return graph;
}

function findLoops(graph, rooms) {
  // Simple cycle detection - count unique cycles
  // For simplicity, count junction points with multiple paths
  const junctions = [];
  
  for (const [key, neighbors] of graph) {
    if (neighbors.length >= 3) {
      junctions.push(key);
    }
  }
  
  // Estimate loops based on junction connectivity
  // Each 4-way junction potentially creates 2 loops
  let loopEstimate = 0;
  for (const junction of junctions) {
    const neighbors = graph.get(junction);
    if (neighbors.length >= 3) {
      loopEstimate += Math.floor(neighbors.length / 2);
    }
  }
  
  // Divide by 2 to avoid double counting
  return Math.max(1, Math.floor(loopEstimate / 2));
}

function countIngressRoutes(pos, grid, width, height) {
  if (!pos) return 0;
  
  // Count adjacent walkable tiles (potential entry points)
  const dirs = [{dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}];
  let ingress = 0;
  
  for (const {dx, dy} of dirs) {
    const nx = pos.x + dx, ny = pos.y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny][nx] === 0) {
      ingress++;
    }
  }
  
  return ingress;
}

function isInRoomInterior(pos, rooms) {
  for (const room of rooms) {
    if (pos.x > room.x && pos.x < room.x + room.width - 1 &&
        pos.y > room.y && pos.y < room.y + room.height - 1) {
      return true;
    }
  }
  return false;
}

function isAtJunction(pos, grid, width, height) {
  // Check if position has 3+ adjacent walkable tiles
  const dirs = [{dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}];
  let adjacentWalkable = 0;
  
  for (const {dx, dy} of dirs) {
    const nx = pos.x + dx, ny = pos.y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny][nx] === 0) {
      adjacentWalkable++;
    }
  }
  
  return adjacentWalkable >= 3;
}

function hasPath(from, to, grid, width, height) {
  if (!from || !to) return false;
  
  const visited = new Set();
  const queue = [{x: from.x, y: from.y}];
  visited.add(`${from.x},${from.y}`);
  
  while (queue.length > 0) {
    const current = queue.shift();
    
    if (current.x === to.x && current.y === to.y) {
      return true;
    }
    
    const dirs = [{dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}];
    for (const {dx, dy} of dirs) {
      const nx = current.x + dx, ny = current.y + dy;
      const key = `${nx},${ny}`;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && 
          grid[ny][nx] === 0 && !visited.has(key)) {
        visited.add(key);
        queue.push({x: nx, y: ny});
      }
    }
  }
  
  return false;
}

// Run analysis
analyzeLevel1();
