/**
 * Tile System Test - Verification tests for tile navigation system
 * 
 * Run with: node --experimental-vm-modules tests/tile-system-test.mjs
 * 
 * @module tests/tile-system-test
 */

// Mock minimal level layout for testing
const mockLevelLayout = {
  name: 'Test Level',
  obstacles: [
    { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
    { x: 2, y: 3 }, { x: 4, y: 3 },
    { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }
  ],
  guardPatrol: [
    { x: 5, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 10 }, { x: 5, y: 10 }
  ],
  dataCore: { x: 15, y: 15 },
  keyCard: { x: 8, y: 8 },
  hackTerminal: { x: 10, y: 8 },
  playerStart: { x: 1, y: 1 },
  exitZone: { x: 20, y: 16 },
  cameras: [],
  motionSensors: [],
  laserGrids: [],
  patrolDrones: [],
  difficulty: 1
};

// Test functions
async function runTests() {
  console.log('='.repeat(60));
  console.log('GhostShift Tile Navigation System Tests');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  // Import modules
  console.log('\n[1/6] Loading modules...');
  try {
    const tileModule = await import('../src/tile/index.js');
    const { 
      TileGrid, 
      TileMetadata, 
      Pathfinder,
      TileAgent,
      TileMovementManager,
      createTileSystem,
      worldToTile,
      tileToWorld,
      isInBounds,
      USE_TILE_AI
    } = tileModule;
    
    console.log('   ✓ All modules loaded successfully');
    passed++;
    
    // Test 2: TileGrid creation
    console.log('\n[2/6] Testing TileGrid...');
    const grid = new TileGrid(mockLevelLayout);
    
    // Check dimensions
    if (grid.width === 22 && grid.height === 18) {
      console.log('   ✓ Grid dimensions correct (22x18)');
      passed++;
    } else {
      console.log('   ✗ Grid dimensions incorrect');
      failed++;
    }
    
    // Check obstacle detection
    if (!grid.isWalkable(2, 2)) {
      console.log('   ✓ Obstacle detected correctly');
      passed++;
    } else {
      console.log('   ✗ Obstacle not detected');
      failed++;
    }
    
    // Check walkable floor
    if (grid.isWalkable(5, 5)) {
      console.log('   ✓ Floor is walkable');
      passed++;
    } else {
      console.log('   ✗ Floor should be walkable');
      failed++;
    }
    
    // Test 3: Coordinate conversion
    console.log('\n[3/6] Testing coordinate conversion...');
    
    // World to tile
    const tile = worldToTile(48, 48); // Should be (1, 1)
    if (tile.tx === 1 && tile.ty === 1) {
      console.log('   ✓ worldToTile works correctly');
      passed++;
    } else {
      console.log('   ✗ worldToTile failed');
      failed++;
    }
    
    // Tile to world
    const world = tileToWorld(5, 5);
    if (world.x === 5 * 48 + 24 && world.y === 5 * 48 + 24) {
      console.log('   ✓ tileToWorld works correctly');
      passed++;
    } else {
      console.log('   ✗ tileToWorld failed');
      failed++;
    }
    
    // Bounds check
    if (isInBounds(10, 10) && !isInBounds(-1, 0) && !isInBounds(22, 17)) {
      console.log('   ✓ isInBounds works correctly');
      passed++;
    } else {
      console.log('   ✗ isInBounds failed');
      failed++;
    }
    
    // Test 4: Metadata
    console.log('\n[4/6] Testing TileMetadata...');
    const metadata = new TileMetadata(grid);
    
    // Check walkable metadata
    if (metadata.canEnemyWalk(5, 5) && !metadata.canEnemyWalk(2, 2)) {
      console.log('   ✓ Enemy walkability works');
      passed++;
    } else {
      console.log('   ✗ Enemy walkability failed');
      failed++;
    }
    
    // Check LOS blocking
    if (metadata.blocksLineOfSight(2, 2) && !metadata.blocksLineOfSight(5, 5)) {
      console.log('   ✓ Line of sight blocking works');
      passed++;
    } else {
      console.log('   ✗ Line of sight blocking failed');
      failed++;
    }
    
    // Test 5: Pathfinder
    console.log('\n[5/6] Testing Pathfinder...');
    const pathfinder = new Pathfinder(grid, metadata, { debug: false });
    
    // Find simple path
    const path = pathfinder.findPath(5, 5, 8, 8);
    if (path && path.length > 0) {
      console.log(`   ✓ Path found (${path.length} tiles)`);
      passed++;
    } else {
      console.log('   ✗ Path not found');
      failed++;
    }
    
    // Check path validity
    if (path && path[0].tx === 5 && path[0].ty === 5) {
      console.log('   ✓ Path starts at correct position');
      passed++;
    } else if (path) {
      console.log('   ✗ Path start incorrect');
      failed++;
    }
    
    // Check path ends at goal
    if (path && path[path.length - 1].tx === 8 && path[path.length - 1].ty === 8) {
      console.log('   ✓ Path ends at goal');
      passed++;
    } else if (path) {
      console.log('   ✗ Path end incorrect');
      failed++;
    }
    
    // Test cache
    pathfinder.clearCache();
    const stats = pathfinder.getStats();
    if (stats.cacheSize === 0) {
      console.log('   ✓ Cache cleared successfully');
      passed++;
    } else {
      console.log('   ✗ Cache not cleared');
      failed++;
    }
    
    // Test 6: TileAgent
    console.log('\n[6/6] Testing TileAgent...');
    const agentManager = new TileMovementManager(grid, metadata, pathfinder);
    const agent = agentManager.createAgent('test_guard', 5, 5);
    
    // Set patrol
    agent.setPatrolPoints([
      { tx: 5, ty: 5 },
      { tx: 10, ty: 5 },
      { tx: 10, ty: 10 },
      { tx: 5, ty: 10 }
    ]);
    
    if (agent.patrolPoints.length === 4) {
      console.log('   ✓ Patrol points set correctly');
      passed++;
    } else {
      console.log('   ✗ Patrol points not set');
      failed++;
    }
    
    // Test movement
    agent.followPatrol();
    let frameCount = 0;
    while (frameCount < 100 && !agent.hasArrived()) {
      agent.update(16); // 60 FPS
      frameCount++;
    }
    
    if (frameCount < 100) {
      console.log(`   ✓ Agent moved to first waypoint in ${frameCount} frames`);
      passed++;
    } else {
      console.log('   ✗ Agent did not reach waypoint');
      failed++;
    }
    
    // Clean up
    agentManager.clear();
    pathfinder.clearCache();
    
  } catch (error) {
    console.error('   ✗ Error loading modules:', error.message);
    console.error(error.stack);
    failed += 6;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  
  if (failed === 0) {
    console.log('\n✅ All tests passed! Tile system is ready for integration.');
  } else {
    console.log('\n❌ Some tests failed. Review errors above.');
  }
  
  return failed === 0;
}

// Run tests
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
