/**
 * Modular Guard AI Smoke Test
 * Verifies the modular guard AI path works correctly when enabled
 */
import { test, expect } from '@playwright/test'

test('Modular guard AI smoke: enables and runs without errors', async ({ page }) => {
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  // Enable modular guard AI via window property BEFORE loading
  await page.addInitScript(() => {
    window.GHOSTSHIFT_MODULAR_GUARD_AI = true
  })
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  // Wait for game to load
  await page.waitForFunction(() => window.__ghostGame?.scene)
  
  // Start GameScene directly (more reliable than menu navigation)
  const started = await page.evaluate(() => {
    const game = window.__ghostGame
    if (!game) return false
    game.scene.start('GameScene', { levelIndex: 0 })
    return true
  })
  expect(started).toBe(true)
  await page.waitForTimeout(1000)
  
  // Verify modular guard AI is initialized
  const modularAIEnabled = await page.evaluate(() => {
    const game = window.__ghostGame
    if (!game || !game.scene) return false
    const scene = game.scene.getScene('GameScene')
    return scene?._modularGuardAI?.isInitialized === true
  })
  expect(modularAIEnabled).toBe(true)
  
  // Let guard patrol for a few seconds
  await page.waitForTimeout(3000)
  
  // Check for errors
  const criticalErrors = consoleErrors.filter(e => 
    /TypeError|ReferenceError|Cannot read properties|null|undefined/i.test(e) &&
    !e.includes('WebGL')
  )
  expect(pageErrors, `Page errors: ${pageErrors.join('\n')}`).toEqual([])
  expect(criticalErrors, `Console errors: ${criticalErrors.join('\n')}`).toEqual([])
})

test('Modular guard AI smoke: guard patrol works correctly', async ({ page }) => {
  // Enable modular guard AI
  await page.addInitScript(() => {
    window.GHOSTSHIFT_MODULAR_GUARD_AI = true
  })
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForFunction(() => window.__ghostGame?.scene)
  
  // Start GameScene
  await page.evaluate(() => {
    window.__ghostGame.scene.start('GameScene', { levelIndex: 0 })
  })
  await page.waitForTimeout(1000)
  
  // Get initial guard position
  const initialPos = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    if (!scene?.guard) return null
    return { x: scene.guard.x, y: scene.guard.y }
  })
  expect(initialPos).not.toBeNull()
  
  // Wait for guard to move
  await page.waitForTimeout(2000)
  
  // Verify guard has moved
  const finalPos = await page.evaluate(() => {
    const scene = window.__ghostGame?.scene?.getScene('GameScene')
    if (!scene?.guard) return null
    return { x: scene.guard.x, y: scene.guard.y }
  })
  
  const displacement = Math.hypot(finalPos.x - initialPos.x, finalPos.y - initialPos.y)
  expect(displacement).toBeGreaterThan(1) // Guard should have moved at least 1 pixel (any movement is valid)
})
