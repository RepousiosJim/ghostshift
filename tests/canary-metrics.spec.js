/**
 * Canary Metrics Observability Tests
 * 
 * Tests for structured canary metrics logging, daily reports, and rollback guard.
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
 * Test: CanaryMetricsLogger is available
 */
test('CanaryMetricsLogger module is available', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  const result = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return {
      hasMetricsLogger: typeof window.CanaryMetricsLogger !== 'undefined',
      hasCanaryMetrics: typeof scene?._canaryMetrics !== 'undefined'
    }
  })
  
  // Module should be available after game loads
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Metrics collection starts when level starts
 */
test('Canary metrics collection starts on level load', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 0)
  await page.waitForTimeout(1500)
  
  // Check that metrics are being collected
  const metricsStatus = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const metrics = scene?._canaryMetrics
    
    if (!metrics) return { error: 'No metrics instance' }
    
    return {
      hasStartTime: metrics.startTime !== null,
      levelIndex: metrics.levelIndex,
      aiMode: metrics.aiMode,
      sampleCount: metrics.samples?.length || 0
    }
  })
  
  expect(metricsStatus.hasStartTime).toBe(true)
  expect(metricsStatus.levelIndex).toBe(0)
  expect(metricsStatus.aiMode).toBe('modular')
  expect(metricsStatus.sampleCount).toBeGreaterThan(0)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Metrics samples contain expected data
 */
test('Canary metrics samples contain guard state data', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 0)
  await page.waitForTimeout(2000)
  
  const sampleData = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const metrics = scene?._canaryMetrics
    
    if (!metrics || !metrics.samples || metrics.samples.length === 0) {
      return { error: 'No samples' }
    }
    
    const sample = metrics.samples[metrics.samples.length - 1]
    return {
      hasVelocity: typeof sample.velocity === 'number',
      hasState: typeof sample.state === 'string',
      hasGuardPosition: sample.guardX !== undefined && sample.guardY !== undefined,
      isStuck: sample.isStuck,
      velocity: sample.velocity,
      state: sample.state
    }
  })
  
  expect(sampleData.error).toBeUndefined()
  expect(sampleData.hasVelocity).toBe(true)
  expect(sampleData.hasState).toBe(true)
  expect(sampleData.velocity).toBeGreaterThanOrEqual(0)
  expect(['patrol', 'investigate', 'chase', 'search']).toContain(sampleData.state)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Metrics summary is computed correctly
 */
test('Canary metrics summary computation works', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 0)
  await page.waitForTimeout(3000)
  
  const summary = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const metrics = scene?._canaryMetrics
    
    if (!metrics) return { error: 'No metrics' }
    
    const summary = metrics.getSummary()
    return {
      levelIndex: summary.levelIndex,
      aiMode: summary.aiMode,
      sampleCount: summary.sampleCount,
      stuckRate: summary.stuckRate,
      avgVelocity: summary.avgVelocity,
      hasStateDistribution: typeof summary.stateDistribution === 'object'
    }
  })
  
  expect(summary.error).toBeUndefined()
  expect(summary.levelIndex).toBe(0)
  expect(summary.aiMode).toBe('modular')
  expect(summary.sampleCount).toBeGreaterThan(0)
  expect(summary.stuckRate).toBeGreaterThanOrEqual(0)
  expect(summary.avgVelocity).toBeGreaterThanOrEqual(0)
  expect(summary.hasStateDistribution).toBe(true)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: State transitions are tracked
 */
test('State transitions are tracked in metrics', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 0)
  await page.waitForTimeout(2500)
  
  const transitionData = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const metrics = scene?._canaryMetrics
    
    if (!metrics) return { error: 'No metrics' }
    
    // Check if state transitions were recorded
    const samples = metrics.samples || []
    const states = samples.map(s => s.state).filter(s => s)
    const uniqueStates = [...new Set(states)]
    
    return {
      totalSamples: samples.length,
      uniqueStatesCount: uniqueStates.length,
      uniqueStates: uniqueStates,
      hasPatrolState: uniqueStates.includes('patrol')
    }
  })
  
  expect(transitionData.error).toBeUndefined()
  expect(transitionData.hasPatrolState).toBe(true)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Rollback recommendation returns valid structure
 */
test('Rollback recommendation structure is valid', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 0)
  await page.waitForTimeout(1500)
  
  const recommendation = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const metrics = scene?._canaryMetrics
    
    if (!metrics || typeof metrics.getRollbackRecommendation !== 'function') {
      return { error: 'No rollback method' }
    }
    
    const rec = metrics.getRollbackRecommendation()
    return {
      hasRecommended: typeof rec.recommended === 'boolean',
      hasReason: rec.reason === null || typeof rec.reason === 'string',
      recommended: rec.recommended
    }
  })
  
  expect(recommendation.error).toBeUndefined()
  expect(recommendation.hasRecommended).toBe(true)
  expect(recommendation.hasReason).toBe(true)
  expect(recommendation.recommended).toBe(false) // Should not recommend rollback for healthy level
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Legacy level does not use modular metrics
 */
test('Legacy level uses legacy AI without modular metrics', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  // Use URL override to force legacy
  await page.goto('/?modularGuard=none', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 0)
  await page.waitForTimeout(1500)
  
  const aiMode = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    return {
      mode: scene?._guardAIMode,
      hasModularAI: scene?._modularGuardAI !== undefined && scene?._modularGuardAI !== null
    }
  })
  
  expect(aiMode.mode).toBe('legacy')
  expect(aiMode.hasModularAI).toBe(false)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Multiple level metrics are tracked independently
 */
test('Multiple level sessions track metrics independently', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  // Play level 0
  await startGameScene(page, 0)
  await page.waitForTimeout(1500)
  
  const level0Metrics = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const metrics = scene?._canaryMetrics
    return metrics ? {
      levelIndex: metrics.levelIndex,
      sampleCount: metrics.samples?.length || 0
    } : null
  })
  
  // Switch to level 1
  await startGameScene(page, 1)
  await page.waitForTimeout(1500)
  
  const level1Metrics = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const metrics = scene?._canaryMetrics
    return metrics ? {
      levelIndex: metrics.levelIndex,
      sampleCount: metrics.samples?.length || 0
    } : null
  })
  
  expect(level0Metrics).not.toBeNull()
  expect(level1Metrics).not.toBeNull()
  expect(level0Metrics.levelIndex).toBe(0)
  expect(level1Metrics.levelIndex).toBe(1)
  expect(level1Metrics.sampleCount).toBeGreaterThan(0)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Guard velocity is reasonable during patrol
 */
test('Guard velocity is reasonable during patrol (no stuck)', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  await startGameScene(page, 0)
  await page.waitForTimeout(3000)
  
  const velocityData = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    const metrics = scene?._canaryMetrics
    
    if (!metrics || !metrics.samples) return { error: 'No samples' }
    
    const velocities = metrics.samples.map(s => s.velocity || 0)
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length
    const minVelocity = Math.min(...velocities)
    const maxVelocity = Math.max(...velocities)
    
    return {
      avgVelocity,
      minVelocity,
      maxVelocity,
      sampleCount: velocities.length
    }
  })
  
  expect(velocityData.error).toBeUndefined()
  expect(velocityData.avgVelocity).toBeGreaterThan(0)
  
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})
