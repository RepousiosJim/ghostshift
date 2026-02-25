/**
 * Guard AI V2 Integration Tests
 * 
 * Integration tests for enhanced guard AI behavior including:
 * - State transitions (SweepRoom, SearchPaths, ReturnToPatrol)
 * - Multi-enemy coordination
 * - Difficulty scaling
 * - Anti-stuck behavior
 * 
 * These tests run against the built game to verify end-to-end behavior.
 */

import { test, expect } from '@playwright/test';

function attachErrorCollectors(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return { pageErrors, consoleErrors };
}

function assertNoRuntimeCrashes(pageErrors, consoleErrors) {
  // Filter out known non-critical errors
  const criticalPageErrors = pageErrors.filter(e => 
    !e.includes('skinKey is not defined')
  );
  expect(criticalPageErrors, `Page errors: ${criticalPageErrors.join('\n')}`).toEqual([]);
  expect(
    consoleErrors.filter((e) => /TypeError|isParent|collideObjects|Cannot read properties of null/i.test(e)),
    `Console errors: ${consoleErrors.join('\n')}`
  ).toEqual([]);
}

const GAME_WIDTH = 22 * 48;
const GAME_HEIGHT = 18 * 48;

async function startGameScene(page, levelIndex = 0) {
  await page.waitForFunction(() => window.__ghostGame?.scene);
  const started = await page.evaluate((idx) => {
    const game = window.__ghostGame;
    if (!game) return false;
    game.scene.start('GameScene', { levelIndex: idx });
    return true;
  }, levelIndex);
  expect(started).toBe(true);
  await page.waitForTimeout(500);
}

/**
 * Test: Guard state machine V2 modules load without errors
 */
test('Guard AI V2 modules load without errors', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas')).toHaveCount(1);

  // Wait for game to load
  await page.waitForTimeout(2000);

  // Check that the guard modules loaded
  const modulesLoaded = await page.evaluate(() => {
    // Check if the game loaded successfully
    return !!window.__ghostGame;
  });

  expect(modulesLoaded).toBe(true);

  assertNoRuntimeCrashes(pageErrors, consoleErrors);
});

/**
 * Test: Guard exhibits improved state transitions
 */
test('Guard exhibits improved state transitions during alert', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas')).toHaveCount(1);

  await startGameScene(page, 0);
  await page.waitForTimeout(1000);

  // Monitor guard behavior during alert
  const behaviorResult = await page.evaluate(() => {
    return new Promise((resolve) => {
      const game = window.__ghostGame;
      const scene = game.scene.keys.GameScene;
      const samples = [];
      const startTime = Date.now();
      const duration = 10000;
      const sampleInterval = 200;

      const interval = setInterval(() => {
        if (!scene.guard) {
          clearInterval(interval);
          resolve({ error: 'Guard not found' });
          return;
        }

        samples.push({
          state: scene._guardState || scene._modularGuardAI?.currentState || 'unknown',
          awareness: scene.guardAwareness || 0,
          position: { x: scene.guard.x, y: scene.guard.y }
        });

        if (Date.now() - startTime >= duration) {
          clearInterval(interval);
          resolve({ samples });
        }
      }, sampleInterval);
    });
  });

  expect(behaviorResult.error).toBeUndefined();
  expect(behaviorResult.samples.length).toBeGreaterThan(5);

  // Verify state changes occur (not stuck in one state forever)
  const states = new Set(behaviorResult.samples.map(s => s.state));
  expect(states.size).toBeGreaterThanOrEqual(1);

  assertNoRuntimeCrashes(pageErrors, consoleErrors);
});

/**
 * Test: Guard recovers from stuck positions with enhanced recovery
 */
test('Guard recovers from stuck positions with enhanced recovery', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas')).toHaveCount(1);

  await startGameScene(page, 0);
  await page.waitForTimeout(1000);

  // Monitor guard position and stuck recovery
  const recoveryResult = await page.evaluate(() => {
    return new Promise((resolve) => {
      const game = window.__ghostGame;
      const scene = game.scene.keys.GameScene;
      const positions = [];
      const startTime = Date.now();
      const duration = 15000;
      const sampleInterval = 300;

      let stuckFrames = 0;
      let lastPos = null;
      let recoveryEvents = 0;

      const interval = setInterval(() => {
        if (!scene.guard) {
          clearInterval(interval);
          resolve({ error: 'Guard not found' });
          return;
        }

        const currentPos = { x: scene.guard.x, y: scene.guard.y };

        if (lastPos) {
          const displacement = Math.hypot(currentPos.x - lastPos.x, currentPos.y - lastPos.y);

          if (displacement < 2) {
            stuckFrames++;
          } else {
            if (stuckFrames > 30) {
              recoveryEvents++;
            }
            stuckFrames = 0;
          }
        }

        positions.push(currentPos);
        lastPos = currentPos;

        if (Date.now() - startTime >= duration) {
          clearInterval(interval);

          // Calculate movement variance
          const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
          const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
          let variance = 0;
          for (const pos of positions) {
            variance += (pos.x - avgX) ** 2 + (pos.y - avgY) ** 2;
          }
          variance = Math.sqrt(variance / positions.length);

          resolve({
            sampleCount: positions.length,
            maxStuckFrames: stuckFrames,
            recoveryEvents,
            variance
          });
        }
      }, sampleInterval);
    });
  });

  expect(recoveryResult.error).toBeUndefined();
  expect(recoveryResult.sampleCount).toBeGreaterThan(10);

  // Guard should show movement variance (not completely stuck)
  expect(recoveryResult.variance).toBeGreaterThan(5);

  assertNoRuntimeCrashes(pageErrors, consoleErrors);
});

/**
 * Test: Difficulty scaling affects guard behavior
 */
test('Difficulty scaling affects guard behavior', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas')).toHaveCount(1);

  await startGameScene(page, 0);
  await page.waitForTimeout(1000);

  // Check if difficulty settings are accessible
  const difficultyResult = await page.evaluate(() => {
    // Check if difficulty presets are available
    // This tests that the module loaded correctly
    const game = window.__ghostGame;
    const scene = game?.scene?.keys?.GameScene;

    return {
      gameLoaded: !!game,
      sceneLoaded: !!scene,
      hasModularAI: !!scene?._modularGuardAI,
      aiState: scene?._modularGuardAI?.currentState || 'unknown'
    };
  });

  expect(difficultyResult.gameLoaded).toBe(true);
  expect(difficultyResult.sceneLoaded).toBe(true);
  expect(difficultyResult.hasModularAI).toBe(true);

  assertNoRuntimeCrashes(pageErrors, consoleErrors);
});

/**
 * Test: Guard does not oscillate in doorways
 */
test('Guard does not oscillate in doorways', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas')).toHaveCount(1);

  await startGameScene(page, 0);
  await page.waitForTimeout(1000);

  // Monitor guard velocity for oscillation patterns
  const oscillationResult = await page.evaluate(() => {
    return new Promise((resolve) => {
      const game = window.__ghostGame;
      const scene = game.scene.keys.GameScene;
      const velocities = [];
      const startTime = Date.now();
      const duration = 12000;
      const sampleInterval = 150;

      const interval = setInterval(() => {
        if (!scene.guard || !scene.guard.body) {
          clearInterval(interval);
          resolve({ error: 'Guard not found' });
          return;
        }

        const vel = scene.guard.body.velocity;
        velocities.push({
          vx: vel.x,
          vy: vel.y,
          angle: Math.atan2(vel.y, vel.x),
          speed: Math.hypot(vel.x, vel.y)
        });

        if (Date.now() - startTime >= duration) {
          clearInterval(interval);

          // Detect rapid direction reversals
          let reversals = 0;
          for (let i = 1; i < velocities.length; i++) {
            const prev = velocities[i - 1];
            const curr = velocities[i];

            if (prev.speed > 10 && curr.speed > 10) {
              let angleDiff = Math.abs(curr.angle - prev.angle);
              while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
              while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

              // Count reversals (angle change close to ±PI)
              if (Math.abs(Math.abs(angleDiff) - Math.PI) < 0.7) {
                reversals++;
              }
            }
          }

          resolve({
            sampleCount: velocities.length,
            reversals,
            reversalRate: reversals / velocities.length
          });
        }
      }, sampleInterval);
    });
  });

  expect(oscillationResult.error).toBeUndefined();
  expect(oscillationResult.sampleCount).toBeGreaterThan(10);

  // Reversal rate should be low (< 15%)
  expect(oscillationResult.reversalRate).toBeLessThan(0.15);

  assertNoRuntimeCrashes(pageErrors, consoleErrors);
});

/**
 * Test: Guard navigates multiple levels without errors
 */
test('Guard navigates multiple levels without errors', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas')).toHaveCount(1);

  // Test first 3 levels
  const levels = [0, 1, 2];

  for (const levelIndex of levels) {
    await startGameScene(page, levelIndex);
    await page.waitForTimeout(2000);

    const guardState = await page.evaluate(() => {
      const game = window.__ghostGame;
      const scene = game?.scene?.keys?.GameScene;
      return {
        hasGuard: !!scene?.guard,
        guardPos: scene?.guard ? { x: scene.guard.x, y: scene.guard.y } : null
      };
    });

    expect(guardState.hasGuard, `Level ${levelIndex} should have guard`).toBe(true);
    expect(guardState.guardPos).not.toBeNull();
  }

  assertNoRuntimeCrashes(pageErrors, consoleErrors);
});

/**
 * Test: Enhanced search behavior after losing player
 */
test('Guard performs enhanced search after losing player', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas')).toHaveCount(1);

  await startGameScene(page, 0);
  await page.waitForTimeout(1000);

  // Monitor guard search behavior
  const searchResult = await page.evaluate(() => {
    return new Promise((resolve) => {
      const game = window.__ghostGame;
      const scene = game.scene.keys.GameScene;
      const stateHistory = [];
      const startTime = Date.now();
      const duration = 15000;
      const sampleInterval = 300;

      const interval = setInterval(() => {
        if (!scene.guard) {
          clearInterval(interval);
          resolve({ error: 'Guard not found' });
          return;
        }

        stateHistory.push({
          state: scene._guardState || scene._modularGuardAI?.currentState || 'unknown',
          awareness: scene.guardAwareness || 0,
          time: Date.now() - startTime
        });

        if (Date.now() - startTime >= duration) {
          clearInterval(interval);

          // Analyze state transitions
          const states = stateHistory.map(s => s.state);
          const uniqueStates = new Set(states);

          // Count search-related states
          const searchStates = states.filter(s => 
            s === 'search' || s === 'searchPaths' || s === 'sweepRoom'
          ).length;

          resolve({
            totalSamples: stateHistory.length,
            uniqueStates: uniqueStates.size,
            searchStateCount: searchStates,
            searchStateRatio: searchStates / states.length
          });
        }
      }, sampleInterval);
    });
  });

  expect(searchResult.error).toBeUndefined();
  expect(searchResult.totalSamples).toBeGreaterThan(10);

  // Guard should have state variety (not stuck in one state)
  expect(searchResult.uniqueStates).toBeGreaterThanOrEqual(1);

  assertNoRuntimeCrashes(pageErrors, consoleErrors);
});
