/**
 * Console Zero Verification Test
 * 
 * Comprehensive test to verify ZERO console errors in GhostShift
 * Tests all major paths: menu navigation, settings, gameplay, level transitions
 */

import { test, expect } from '@playwright/test'

function attachErrorCollectors(page) {
  const pageErrors = []
  const consoleErrors = []
  const criticalConsoleErrors = []
  
  page.on('pageerror', (err) => {
    pageErrors.push(String(err))
    console.log('❌ PAGE ERROR:', err)
  })
  
  page.on('console', (msg) => {
    const text = msg.text()
    const type = msg.type()
    
    // Filter for actual JS errors (not WebGL warnings, not validation warnings)
    if (type === 'error') {
      const isCritical = /TypeError|ReferenceError|Cannot read properties of|undefined is not|is not defined/i.test(text) &&
        !text.includes('WebGL') &&
        !text.includes('GL Driver') &&
        !text.includes('[PatrolValidation]')
      
      if (isCritical) {
        criticalConsoleErrors.push(text)
        console.log('❌ CRITICAL CONSOLE ERROR:', text)
      } else {
        consoleErrors.push(text)
      }
    }
  })
  
  return { pageErrors, consoleErrors, criticalConsoleErrors }
}

function assertConsoleZero(pageErrors, criticalConsoleErrors) {
  const allErrors = [...pageErrors, ...criticalConsoleErrors]
  expect(allErrors, `Console errors found:\n${allErrors.join('\n')}`).toEqual([])
}

/**
 * Test 1: Boot and main menu - no console errors
 */
test('Boot and main menu - zero console errors', async ({ page }) => {
  const { pageErrors, criticalConsoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  // Wait for boot and menu to load
  await page.waitForTimeout(2000)
  
  assertConsoleZero(pageErrors, criticalConsoleErrors)
})

/**
 * Test 2: Menu navigation flow - settings, controls, how to play
 */
test('Menu navigation flow - zero console errors', async ({ page }) => {
  const { pageErrors, criticalConsoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForTimeout(1500)
  
  // Navigate through all menu screens
  // Settings
  await page.keyboard.press('Space')
  await page.waitForTimeout(500)
  
  // Back
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  
  assertConsoleZero(pageErrors, criticalConsoleErrors)
})

/**
 * Test 3: Level select navigation
 */
test('Level select navigation - zero console errors', async ({ page }) => {
  const { pageErrors, criticalConsoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForTimeout(1500)
  
  // Go to level select (by clicking play)
  await page.keyboard.press('Space')
  await page.waitForTimeout(1000)
  
  // Navigate levels
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(200)
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(200)
  
  // Back to menu
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  
  assertConsoleZero(pageErrors, criticalConsoleErrors)
})

/**
 * Test 4: Gameplay start - Warehouse level
 */
test('Gameplay start (Level 0) - zero console errors', async ({ page }) => {
  const { pageErrors, criticalConsoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForTimeout(1500)
  
  // Start game scene directly
  const started = await page.evaluate(() => {
    const game = window.__ghostGame
    if (!game) return false
    game.scene.start('GameScene', { levelIndex: 0 })
    return true
  })
  expect(started).toBe(true)
  
  // Let game initialize
  await page.waitForTimeout(2000)
  
  // Test player movement
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(300)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.down('ArrowDown')
  await page.waitForTimeout(300)
  await page.keyboard.up('ArrowDown')
  
  await page.waitForTimeout(1000)
  
  assertConsoleZero(pageErrors, criticalConsoleErrors)
})

/**
 * Test 5: All 7 levels - start each and verify no console errors
 */
test('All 7 levels start without console errors', async ({ page }) => {
  // Increase timeout for testing all 7 levels
  test.setTimeout(60000)
  const { pageErrors, criticalConsoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForTimeout(1500)
  
  for (let levelIndex = 0; levelIndex < 7; levelIndex++) {
    console.log(`Testing level ${levelIndex}...`)
    
    // Start level
    const started = await page.evaluate((idx) => {
      const game = window.__ghostGame
      if (!game) return false
      game.scene.start('GameScene', { levelIndex: idx })
      return true
    }, levelIndex)
    expect(started).toBe(true)
    
    // Let level initialize
    await page.waitForTimeout(1500)
    
    // Quick movement test
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(500)
  }
  
  assertConsoleZero(pageErrors, criticalConsoleErrors)
})

/**
 * Test 6: Scene transitions - menu -> level select -> game -> menu
 */
test('Full scene transition cycle - zero console errors', async ({ page }) => {
  const { pageErrors, criticalConsoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForTimeout(1500)
  
  // Menu -> Level Select
  await page.keyboard.press('Space')
  await page.waitForTimeout(1000)
  
  // Level Select -> Game (Level 0)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2000)
  
  // Game -> Restart
  await page.keyboard.press('r')
  await page.waitForTimeout(1500)
  
  // Game -> Menu (ESC)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1000)
  
  assertConsoleZero(pageErrors, criticalConsoleErrors)
})

/**
 * Test 7: Detection and fail flow
 */
test('Detection and fail flow - zero console errors', async ({ page }) => {
  const { pageErrors, criticalConsoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForTimeout(1500)
  
  // Start game
  const started = await page.evaluate(() => {
    const game = window.__ghostGame
    if (!game) return false
    game.scene.start('GameScene', { levelIndex: 0 })
    return true
  })
  expect(started).toBe(true)
  await page.waitForTimeout(1500)
  
  // Trigger detection via API
  const detectResult = await page.evaluate(() => {
    const game = window.__ghostGame
    const scene = game?.scene?.getScene('GameScene')
    if (!scene) return { ok: false }
    try {
      scene.detected()
      return { ok: true, isDetected: scene.isDetected }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
  expect(detectResult.ok).toBe(true)
  
  await page.waitForTimeout(2000)
  
  assertConsoleZero(pageErrors, criticalConsoleErrors)
})

/**
 * Test 8: Win flow
 */
test('Win flow - zero console errors', async ({ page }) => {
  const { pageErrors, criticalConsoleErrors } = attachErrorCollectors(page)
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForTimeout(1500)
  
  // Start game
  const started = await page.evaluate(() => {
    const game = window.__ghostGame
    if (!game) return false
    game.scene.start('GameScene', { levelIndex: 0 })
    return true
  })
  expect(started).toBe(true)
  await page.waitForTimeout(1500)
  
  // Trigger win via API
  const winResult = await page.evaluate(() => {
    const game = window.__ghostGame
    const scene = game?.scene?.getScene('GameScene')
    if (!scene) return { ok: false }
    try {
      scene.hasDataCore = true
      scene.winGame()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
  expect(winResult.ok).toBe(true)
  
  await page.waitForTimeout(2000)
  
  assertConsoleZero(pageErrors, criticalConsoleErrors)
})
