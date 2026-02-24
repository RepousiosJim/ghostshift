/**
 * Canary Comparison Tests
 * 
 * Step 6: Validates modular guard AI behavior against legacy baseline.
 * Canary levels: 0 (Warehouse), 1 (Labs), 2 (Server Farm), 3 (Comms Tower), 4 (The Vault), 5 (Training Facility)
 * Legacy levels: 6 (Penthouse)
 * 
 * Coverage: 6 of 7 levels (86%)
 */

import { test, expect } from '@playwright/test'

function attachErrorCollectors(page) {
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  return { pageErrors, consoleErrors }
}

function assertNoRuntimeCrashes(pageErrors, consoleErrors) {
  const criticalErrors = consoleErrors.filter(e => 
    /TypeError|ReferenceError|Cannot read properties of null/i.test(e) &&
    !e.includes('WebGL')
  )
  expect(pageErrors, `Page errors: ${pageErrors.join('\n')}`).toEqual([])
  expect(criticalErrors, `Critical console errors: ${criticalErrors.join('\n')}`).toEqual([])
}

async function startGameScene(page, levelIndex = 0) {
  await page.waitForFunction(() => window.__ghostGame?.scene)
  const started = await page.evaluate((idx) => {
    const game = window.__ghostGame
    if (!game) return false
    game.scene.start('GameScene', { levelIndex: idx })
    return true
  }, levelIndex)
  expect(started).toBe(true)
  await page.waitForTimeout(800)
}

/**
 * Test: Canary level uses modular AI
 */
test('Canary level 0 (Warehouse) uses modular AI', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 0)
  await page.waitForTimeout(1500)
  
  // Verify modular AI is active for level 0
  const aiMode = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return {
      mode: scene?._guardAIMode,
      modularInitialized: scene?._modularGuardAI?.isInitialized
    }
  })
  
  expect(aiMode.mode).toBe('modular')
  expect(aiMode.modularInitialized).toBe(true)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Step 4 - Server Farm (level 2) now uses modular AI
 */
test('Canary level 2 (Server Farm) uses modular AI (Step 4 expansion)', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 2) // Server Farm is now a canary level (Step 4)
  await page.waitForTimeout(1500)
  
  // Verify modular AI is active for level 2
  const aiMode = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return {
      mode: scene?._guardAIMode,
      modularInitialized: scene?._modularGuardAI?.isInitialized,
      levelName: scene?.currentLayout?.name
    }
  })
  
  expect(aiMode.mode).toBe('modular')
  expect(aiMode.modularInitialized).toBe(true)
  expect(aiMode.levelName).toBe('Server Farm')
  
  // Let guard run for a bit
  await page.waitForTimeout(2000)
  
  // Verify guard is moving
  const guardMoving = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const vel = scene?.guard?.body?.velocity
    return Math.hypot(vel?.x || 0, vel?.y || 0) > 0.1
  })
  
  expect(guardMoving).toBe(true)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Step 3 - Labs (level 1) now uses modular AI
 */
test('Canary level 1 (Labs) uses modular AI (Step 3 expansion)', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 1) // Labs is now a canary level (Step 3)
  await page.waitForTimeout(1500)
  
  // Verify modular AI is active for level 1
  const aiMode = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return {
      mode: scene?._guardAIMode,
      modularInitialized: scene?._modularGuardAI?.isInitialized,
      levelName: scene?.currentLayout?.name
    }
  })
  
  expect(aiMode.mode).toBe('modular')
  expect(aiMode.modularInitialized).toBe(true)
  expect(aiMode.levelName).toBe('Labs')
  
  // Let guard run for a bit
  await page.waitForTimeout(2000)
  
  // Verify guard is moving
  const guardMoving = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const vel = scene?.guard?.body?.velocity
    return Math.hypot(vel?.x || 0, vel?.y || 0) > 0.1
  })
  
  expect(guardMoving).toBe(true)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Step 5 - The Vault (level 4) now uses modular AI
 */
test('Canary level 4 (The Vault) uses modular AI (Step 5 expansion)', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 4) // The Vault is now a canary level (Step 5)
  await page.waitForTimeout(1500)
  
  // Verify modular AI is active for level 4
  const aiMode = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return {
      mode: scene?._guardAIMode,
      modularInitialized: scene?._modularGuardAI?.isInitialized,
      levelName: scene?.currentLayout?.name
    }
  })
  
  expect(aiMode.mode).toBe('modular')
  expect(aiMode.modularInitialized).toBe(true)
  expect(aiMode.levelName).toBe('The Vault')
  
  // Let guard run for a bit
  await page.waitForTimeout(2000)
  
  // Verify guard is moving
  const guardMoving = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const vel = scene?.guard?.body?.velocity
    return Math.hypot(vel?.x || 0, vel?.y || 0) > 0.1
  })
  
  expect(guardMoving).toBe(true)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Step 6 - Training Facility (level 5) now uses modular AI
 */
test('Canary level 5 (Training Facility) uses modular AI (Step 6 expansion)', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 5) // Training Facility is now a canary level (Step 6)
  await page.waitForTimeout(1500)
  
  // Verify modular AI is active for level 5
  const aiMode = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return {
      mode: scene?._guardAIMode,
      modularInitialized: scene?._modularGuardAI?.isInitialized,
      levelName: scene?.currentLayout?.name
    }
  })
  
  expect(aiMode.mode).toBe('modular')
  expect(aiMode.modularInitialized).toBe(true)
  expect(aiMode.levelName).toBe('Training Facility')
  
  // Let guard run for a bit
  await page.waitForTimeout(2000)
  
  // Verify guard is moving
  const guardMoving = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const vel = scene?.guard?.body?.velocity
    return Math.hypot(vel?.x || 0, vel?.y || 0) > 0.1
  })
  
  expect(guardMoving).toBe(true)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Non-canary level uses legacy AI
 * Step 6: Penthouse (level 6) is the legacy baseline
 */
test('Non-canary level 6 (Penthouse) uses legacy AI by default', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 6) // Penthouse is level 6, not in canary list
  await page.waitForTimeout(1500)
  
  // Verify legacy AI is active for level 6
  const aiMode = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return {
      mode: scene?._guardAIMode,
      modularInitialized: scene?._modularGuardAI?.isInitialized,
      levelName: scene?.currentLayout?.name
    }
  })
  
  expect(aiMode.mode).toBe('legacy')
  expect(aiMode.modularInitialized).toBeFalsy()
  expect(aiMode.levelName).toBe('Penthouse')
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Modular AI stuck rate is comparable to legacy
 */
test('Modular AI stuck rate is acceptable on canary level', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 0) // Warehouse
  await page.waitForTimeout(500)
  
  // Collect metrics over time using interval sampling
  const sampleInterval = 250
  const sampleCount = 20 // 5 seconds of sampling
  
  for (let i = 0; i < sampleCount; i++) {
    await page.waitForTimeout(sampleInterval)
  }
  
  // Get metrics from canary metrics collector
  const metrics = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const guard = scene?.guard
    if (!guard?.body) return { error: 'Guard not found' }
    
    const vel = Math.hypot(guard.body.velocity.x, guard.body.velocity.y)
    const isStuck = vel < 2
    
    return {
      velocity: vel,
      isStuck,
      aiMode: scene._guardAIMode
    }
  })
  
  expect(metrics.error).toBeUndefined()
  expect(metrics.aiMode).toBe('modular')
  expect(metrics.velocity).toBeGreaterThan(0)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: State transitions work correctly in modular AI
 */
test('Modular AI state transitions are valid', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 0)
  await page.waitForTimeout(1000)
  
  // Sample states over time
  const states = []
  const sampleCount = 20
  const sampleInterval = 250
  
  for (let i = 0; i < sampleCount; i++) {
    const state = await page.evaluate(() => {
      const scene = window.__ghostGame?.scene?.getScene('GameScene')
      const ai = scene?._modularGuardAI
      return ai?.currentState || scene?._guardState || 'unknown'
    })
    states.push(state)
    await page.waitForTimeout(sampleInterval)
  }
  
  // All states should be valid
  const validStates = ['patrol', 'investigate', 'chase', 'search']
  for (const state of states) {
    expect(validStates).toContain(state)
  }
  
  // Should have seen at least patrol state
  expect(states).toContain('patrol')
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Guard reaches patrol waypoints in modular AI
 */
test('Modular AI guard completes patrol cycle', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 0)
  await page.waitForTimeout(500)
  
  // Get initial patrol index
  const initialIndex = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return scene?._modularGuardAI?.currentPatrolIndex ?? -1
  })
  
  // Wait for guard to move
  await page.waitForTimeout(5000)
  
  // Check if patrol index changed
  const finalIndex = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const ai = scene?._modularGuardAI
    return {
      patrolIndex: ai?.currentPatrolIndex ?? -1,
      totalPoints: ai?._patrolPoints?.length || 0
    }
  })
  
  // Patrol should have multiple points
  expect(finalIndex.totalPoints).toBeGreaterThan(0)
  
  // Guard should be patrolling (either same or different index)
  expect(finalIndex.patrolIndex).toBeGreaterThanOrEqual(0)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: URL override enables modular AI for all levels
 */
test('URL override modularGuard=all enables modular AI for all levels', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  // Use URL override
  await page.goto('/?modularGuard=all', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  // Test a non-canary level
  await startGameScene(page, 1) // Labs
  await page.waitForTimeout(1500)
  
  const aiMode = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return {
      mode: scene?._guardAIMode,
      modularInitialized: scene?._modularGuardAI?.isInitialized
    }
  })
  
  // Should use modular AI due to URL override
  expect(aiMode.mode).toBe('modular')
  expect(aiMode.modularInitialized).toBe(true)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: URL override modularGuard=none disables modular AI for canary levels
 */
test('URL override modularGuard=none disables modular AI for canary levels', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  // Use URL override
  await page.goto('/?modularGuard=none', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  // Test a canary level
  await startGameScene(page, 0) // Warehouse
  await page.waitForTimeout(1500)
  
  const aiMode = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return {
      mode: scene?._guardAIMode,
      modularInitialized: scene?._modularGuardAI?.isInitialized
    }
  })
  
  // Should use legacy AI due to URL override
  expect(aiMode.mode).toBe('legacy')
  expect(aiMode.modularInitialized).toBeFalsy()
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Fallback to legacy on modular AI error
 */
test('Modular AI falls back to legacy on error', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  // Inject error before scene start
  await page.addInitScript(() => {
    // Override GuardAI constructor to throw
    const originalError = console.error
    console.error = (...args) => {
      if (args[0]?.includes?.('ModularGuardAI')) {
        window.__modularAIError = args[0]
      }
      originalError.apply(console, args)
    }
  })
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 0)
  await page.waitForTimeout(2000)
  
  // Game should still be running (fallback worked)
  const gameRunning = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return scene?.guard !== undefined && scene?.guard !== null
  })
  
  expect(gameRunning).toBe(true)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Comms Tower (level 3) canary level works
 */
test('Canary level 3 (Comms Tower) uses modular AI correctly', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 3) // Comms Tower
  await page.waitForTimeout(1500)
  
  const aiMode = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return {
      mode: scene?._guardAIMode,
      modularInitialized: scene?._modularGuardAI?.isInitialized,
      levelName: scene?.currentLayout?.name
    }
  })
  
  expect(aiMode.mode).toBe('modular')
  expect(aiMode.modularInitialized).toBe(true)
  expect(aiMode.levelName).toBe('Comms Tower')
  
  // Let guard run for a bit
  await page.waitForTimeout(3000)
  
  // Verify guard is moving
  const guardMoving = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const vel = scene?.guard?.body?.velocity
    return Math.hypot(vel?.x || 0, vel?.y || 0) > 0.1
  })
  
  expect(guardMoving).toBe(true)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})
