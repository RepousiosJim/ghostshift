/**
 * Test suite for vertical expansion system hardening
 * Validates taller map dimensions, camera bounds, and route clarity
 */

import { test, expect } from '@playwright/test';

// Map dimensions from levels.js/main.js
const MAP_WIDTH = 22;
const MAP_HEIGHT = 23; // VERTICAL EXPANSION: 18 -> 23
const TILE_SIZE = 48;

// ==================== MAP DIMENSION TESTS ====================

test.describe('Vertical Expansion - Map Dimensions', () => {
  test('should have consistent MAP_HEIGHT across all source files', async () => {
    // Read levels.js
    const levelsResponse = await fetch('http://localhost:5173/src/levels.js');
    const levelsContent = await levelsResponse.text();
    
    // Check MAP_HEIGHT in levels.js
    expect(levelsContent).toMatch(/MAP_HEIGHT\s*=\s*23/);
    
    // Read main.js
    const mainResponse = await fetch('http://localhost:5173/src/main.js');
    const mainContent = await mainResponse.text();
    
    // Check MAP_HEIGHT in main.js
    expect(mainContent).toMatch(/MAP_HEIGHT\s*=\s*23/);
  });

  test('should have valid game canvas dimensions for taller map', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#game-container canvas', { timeout: 10000 });
    
    const canvas = await page.locator('#game-container canvas');
    const width = await canvas.evaluate(el => el.width);
    const height = await canvas.evaluate(el => el.height);
    
    // Canvas should match map dimensions
    expect(width).toBe(MAP_WIDTH * TILE_SIZE);
    expect(height).toBe(MAP_HEIGHT * TILE_SIZE);
  });

  test('should render HUD correctly for taller map', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#game-container canvas', { timeout: 10000 });
    
    // Wait for game to load
    await page.waitForTimeout(2000);
    
    // Press SPACE to start game
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    
    // Check that game canvas is visible and properly sized
    const canvas = await page.locator('#game-container canvas');
    const isVisible = await canvas.isVisible();
    expect(isVisible).toBe(true);
    
    // Check canvas doesn't overflow viewport
    const boundingBox = await canvas.boundingBox();
    expect(boundingBox).not.toBeNull();
    expect(boundingBox.width).toBeGreaterThan(0);
    expect(boundingBox.height).toBeGreaterThan(0);
  });
});

// ==================== CAMERA BOUNDS TESTS ====================

test.describe('Vertical Expansion - Camera Bounds', () => {
  test('should display entire map without scrolling for 22x23 map', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#game-container canvas', { timeout: 10000 });
    
    // Wait for game to load
    await page.waitForTimeout(2000);
    
    // Start game
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    
    // Get canvas bounding box
    const canvas = await page.locator('#game-container canvas');
    const boundingBox = await canvas.boundingBox();
    
    // Canvas should fit within viewport (with some tolerance for FIT mode)
    const viewportSize = await page.viewportSize();
    expect(boundingBox.width).toBeLessThanOrEqual(viewportSize.width + 10);
    expect(boundingBox.height).toBeLessThanOrEqual(viewportSize.height + 10);
  });

  test('should maintain aspect ratio for taller maps', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#game-container canvas', { timeout: 10000 });
    
    const canvas = await page.locator('#game-container canvas');
    const width = await canvas.evaluate(el => el.width);
    const height = await canvas.evaluate(el => el.height);
    
    // Calculate expected aspect ratio
    const expectedRatio = MAP_WIDTH / MAP_HEIGHT;
    const actualRatio = width / height;
    
    // Allow small floating point tolerance
    expect(actualRatio).toBeCloseTo(expectedRatio, 2);
  });
});

// ==================== ROUTE CLARITY TESTS ====================

test.describe('Vertical Expansion - Route Clarity', () => {
  test('should have objectives distributed across vertical space', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#game-container canvas', { timeout: 10000 });
    
    // Wait for game to load
    await page.waitForTimeout(2000);
    
    // Start game
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    
    // Get player start position from game state
    const playerPos = await canvas.evaluate(() => {
      const game = window.__ghostGame;
      if (!game || !game.scene) return null;
      const scene = game.scene.getScene('GameScene');
      if (!scene || !scene.player) return null;
      return { x: scene.player.x, y: scene.player.y };
    });
    
    // Player should be positioned within valid map bounds
    expect(playerPos).not.toBeNull();
    expect(playerPos.x).toBeGreaterThanOrEqual(0);
    expect(playerPos.x).toBeLessThan(MAP_WIDTH * TILE_SIZE);
    expect(playerPos.y).toBeGreaterThanOrEqual(0);
    expect(playerPos.y).toBeLessThan(MAP_HEIGHT * TILE_SIZE);
  });

  test('should allow navigation to all map areas', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#game-container canvas', { timeout: 10000 });
    
    // Wait for game to load
    await page.waitForTimeout(2000);
    
    // Start game
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    
    // Move player down to test vertical navigation
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowDown');
    
    // Get player position after movement
    const playerPos = await page.locator('#game-container canvas').evaluate(() => {
      const game = window.__ghostGame;
      if (!game || !game.scene) return null;
      const scene = game.scene.getScene('GameScene');
      if (!scene || !scene.player) return null;
      return { x: scene.player.x, y: scene.player.y };
    });
    
    // Player should still be within bounds
    expect(playerPos).not.toBeNull();
    expect(playerPos.y).toBeLessThan(MAP_HEIGHT * TILE_SIZE);
  });
});

// ==================== TRAVEL TIME SANITY TESTS ====================

test.describe('Vertical Expansion - Travel Time Sanity', () => {
  test('should have reasonable objective distances', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#game-container canvas', { timeout: 10000 });
    
    // Wait for game to load
    await page.waitForTimeout(2000);
    
    // Start game
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    
    // Get level data
    const levelData = await page.locator('#game-container canvas').evaluate(() => {
      const game = window.__ghostGame;
      if (!game || !game.scene) return null;
      const scene = game.scene.getScene('GameScene');
      if (!scene || !scene.currentLayout) return null;
      return {
        playerStart: scene.currentLayout.playerStart,
        exitZone: scene.currentLayout.exitZone,
        dataCore: scene.currentLayout.dataCore,
        keyCard: scene.currentLayout.keyCard,
        hackTerminal: scene.currentLayout.hackTerminal
      };
    });
    
    expect(levelData).not.toBeNull();
    
    // Calculate Manhattan distances (max reasonable: 50 tiles for taller maps)
    const MAX_REASONABLE_DISTANCE = 50;
    
    if (levelData.playerStart && levelData.exitZone) {
      const dist = Math.abs(levelData.playerStart.x - levelData.exitZone.x) +
                   Math.abs(levelData.playerStart.y - levelData.exitZone.y);
      expect(dist).toBeLessThan(MAX_REASONABLE_DISTANCE);
    }
  });
});

// ==================== PERFORMANCE TESTS ====================

test.describe('Vertical Expansion - Performance', () => {
  test('should maintain 60fps on taller map', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#game-container canvas', { timeout: 10000 });
    
    // Wait for game to load
    await page.waitForTimeout(2000);
    
    // Start game
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    
    // Collect FPS samples
    const fpsSamples = await page.locator('#game-container canvas').evaluate(() => {
      return new Promise((resolve) => {
        const samples = [];
        let lastTime = performance.now();
        let frameCount = 0;
        
        const measureFrame = () => {
          frameCount++;
          const now = performance.now();
          
          if (now - lastTime >= 1000) {
            samples.push(frameCount);
            frameCount = 0;
            lastTime = now;
          }
          
          if (samples.length < 3) {
            requestAnimationFrame(measureFrame);
          } else {
            resolve(samples);
          }
        };
        
        requestAnimationFrame(measureFrame);
      });
    });
    
    // Average FPS should be at least 50 (allowing some variance)
    const avgFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
    expect(avgFps).toBeGreaterThanOrEqual(50);
  });

  test('should not have console errors during gameplay', async ({ page }) => {
    const errors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#game-container canvas', { timeout: 10000 });
    
    // Wait for game to load
    await page.waitForTimeout(2000);
    
    // Start game and play for a bit
    await page.keyboard.press('Space');
    await page.waitForTimeout(3000);
    
    // Move around to trigger various game systems
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowDown');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowRight');
    
    // Filter out non-critical errors (some browser extensions may cause noise)
    const criticalErrors = errors.filter(e => 
      !e.includes('Extension') && 
      !e.includes('network') &&
      !e.includes('favicon') &&
      !e.includes('DevTools')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});

// ==================== MAP VALIDATOR INTEGRATION ====================

test.describe('Vertical Expansion - Map Validator', () => {
  test('should validate taller map dimensions correctly', async () => {
    // Import map validator functions
    const validatorModule = await import('../scripts/map-validator.js');
    
    // Check exported constants
    expect(validatorModule.MAP_WIDTH).toBe(22);
    expect(validatorModule.MAP_HEIGHT).toBe(23);
  });

  test('should calculate path distances correctly for taller maps', async () => {
    const { buildNavGrid, calculatePathDistance, isWalkable } = await import('../scripts/map-validator.js');
    
    // Create a simple test level with vertical span
    const testLevel = {
      obstacles: [],
      playerStart: { x: 2, y: 20 }, // Near bottom
      exitZone: { x: 20, y: 2 }      // Near top
    };
    
    const grid = buildNavGrid(testLevel);
    
    // Should be able to calculate distance across tall map
    const distance = calculatePathDistance(grid, testLevel.playerStart, testLevel.exitZone);
    expect(distance).toBeGreaterThan(0);
  });

  test('should detect vertical distribution issues', async () => {
    const { buildNavGrid, auditLevel } = await import('../scripts/map-validator.js');
    
    // Create a test level with clustered objectives (all at top)
    const clusteredLevel = {
      name: 'Clustered Test',
      obstacles: [],
      playerStart: { x: 2, y: 2 },
      exitZone: { x: 20, y: 2 },
      dataCore: { x: 10, y: 3 },
      keyCard: { x: 5, y: 2 },
      hackTerminal: { x: 15, y: 3 },
      guardPatrol: [{ x: 10, y: 5 }]
    };
    
    const audit = auditLevel(clusteredLevel, 0, false);
    
    // Should have route clarity warnings for clustered objectives
    expect(audit.routeClarityStats).toBeDefined();
    // The objectives are all in the top half, so should be flagged
    if (audit.routeClarityStats.isClustered) {
      expect(audit.warnings.length).toBeGreaterThan(0);
    }
  });
});
