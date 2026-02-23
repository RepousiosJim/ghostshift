/**
 * Guard Stuck Fix E2E Tests
 * 
 * Tests for guard AI anti-stuck behavior in chokepoints and corners.
 * Verifies guards can navigate through narrow corridors and tight corners
 * without getting stuck or oscillating.
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
  expect(pageErrors, `Page errors: ${pageErrors.join('\n')}`).toEqual([])
  expect(
    consoleErrors.filter((e) => /TypeError|isParent|collideObjects|Cannot read properties of null/i.test(e)),
    `Console errors: ${consoleErrors.join('\n')}`
  ).toEqual([])
}

const GAME_WIDTH = 22 * 48
const GAME_HEIGHT = 18 * 48

async function startGameScene(page, levelIndex = 0) {
  await page.waitForFunction(() => window.__ghostGame?.scene)
  const started = await page.evaluate((idx) => {
    const game = window.__ghostGame
    if (!game) return false
    game.scene.start('GameScene', { levelIndex: idx })
    return true
  }, levelIndex)
  expect(started).toBe(true)
  await page.waitForTimeout(500)
}

/**
 * Test: Guard can navigate through narrow corridors without getting stuck
 * 
 * This test verifies that the guard AI can successfully patrol through
 * tight spaces and chokepoints without oscillating or stalling.
 */
test('Guard navigates narrow corridors without getting stuck', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)

  // Start on Level 1 (Warehouse) which has narrow corridors
  await startGameScene(page, 0)
  
  // Wait for guard to initialize and start patrolling
  await page.waitForTimeout(2000)

  // Track guard position over time to detect stuck behavior
  const guardPositions = await page.evaluate(() => {
    return new Promise((resolve) => {
      const game = window.__ghostGame
      const scene = game.scene.keys.GameScene
      const positions = []
      const startTime = Date.now()
      const duration = 15000 // 15 seconds - longer for better sampling
      const sampleInterval = 300 // Sample every 300ms
      
      const interval = setInterval(() => {
        if (!scene.guard) {
          clearInterval(interval)
          resolve({ error: 'Guard not found' })
          return
        }
        
        positions.push({
          x: scene.guard.x,
          y: scene.guard.y,
          time: Date.now() - startTime
        })
        
        if (Date.now() - startTime >= duration) {
          clearInterval(interval)
          resolve({ positions })
        }
      }, sampleInterval)
    })
  })

  expect(guardPositions.error).toBeUndefined()
  expect(guardPositions.positions.length).toBeGreaterThan(5) // Should have multiple samples

  // Calculate total displacement
  let totalDisplacement = 0
  for (let i = 1; i < guardPositions.positions.length; i++) {
    const prev = guardPositions.positions[i - 1]
    const curr = guardPositions.positions[i]
    const displacement = Math.hypot(curr.x - prev.x, curr.y - prev.y)
    totalDisplacement += displacement
  }

  // Guard should have moved over time
  // Conservative threshold - just verify some movement occurred
  expect(totalDisplacement).toBeGreaterThan(10)

  // Check for oscillation: calculate position variance
  const avgX = guardPositions.positions.reduce((sum, p) => sum + p.x, 0) / guardPositions.positions.length
  const avgY = guardPositions.positions.reduce((sum, p) => sum + p.y, 0) / guardPositions.positions.length
  
  let variance = 0
  for (const pos of guardPositions.positions) {
    variance += (pos.x - avgX) ** 2 + (pos.y - avgY) ** 2
  }
  variance = Math.sqrt(variance / guardPositions.positions.length)

  // High variance indicates guard is moving around (not stuck)
  // Low variance (< 2) would indicate severe oscillation/stuck behavior
  // Threshold of 2 catches truly stuck guards while allowing for patrol patterns
  expect(variance).toBeGreaterThan(2)

  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Guard recovers from stuck position within reasonable time
 * 
 * This test verifies that if a guard gets stuck, the anti-stuck system
 * detects it and recovers within the configured timeout.
 */
test('Guard recovers from stuck position within timeout', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)

  await startGameScene(page, 0)
  await page.waitForTimeout(1000)

  // Simulate guard stuck detection by monitoring position changes
  const stuckRecoveryResult = await page.evaluate(() => {
    return new Promise((resolve) => {
      const game = window.__ghostGame
      const scene = game.scene.keys.GameScene
      const samples = []
      const startTime = Date.now()
      const duration = 8000 // 8 seconds
      const sampleInterval = 250 // Sample every 250ms
      
      let stuckFrames = 0
      let lastPos = null
      let recoveryDetected = false
      
      const interval = setInterval(() => {
        if (!scene.guard) {
          clearInterval(interval)
          resolve({ error: 'Guard not found' })
          return
        }
        
        const currentPos = { x: scene.guard.x, y: scene.guard.y }
        
        if (lastPos) {
          const displacement = Math.hypot(currentPos.x - lastPos.x, currentPos.y - lastPos.y)
          
          // If displacement is very small, increment stuck counter
          if (displacement < 2) {
            stuckFrames++
          } else {
            // Movement detected - if we were stuck, this is recovery
            if (stuckFrames > 20) { // ~5 seconds of being stuck
              recoveryDetected = true
            }
            stuckFrames = 0
          }
          
          samples.push({
            displacement,
            stuckFrames,
            recoveryDetected
          })
        }
        
        lastPos = currentPos
        
        if (Date.now() - startTime >= duration) {
          clearInterval(interval)
          resolve({ 
            samples,
            maxStuckFrames: Math.max(...samples.map(s => s.stuckFrames)),
            recoveryDetected
          })
        }
      }, sampleInterval)
    })
  })

  expect(stuckRecoveryResult.error).toBeUndefined()
  
  // Guard should not remain stuck for more than 30 consecutive frames (~7.5 seconds)
  // The anti-stuck system should kick in before this
  expect(stuckRecoveryResult.maxStuckFrames).toBeLessThan(30)

  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Guard does not oscillate between opposite directions
 * 
 * This test verifies that the guard AI's flip-flop detection prevents
 * rapid direction reversals that can cause oscillation in tight corners.
 */
test('Guard does not oscillate between opposite directions', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)

  await startGameScene(page, 0)
  await page.waitForTimeout(1000)

  // Track guard velocity direction to detect oscillation
  const oscillationResult = await page.evaluate(() => {
    return new Promise((resolve) => {
      const game = window.__ghostGame
      const scene = game.scene.keys.GameScene
      const directions = []
      const startTime = Date.now()
      const duration = 8000 // 8 seconds
      const sampleInterval = 200 // Sample every 200ms
      
      const interval = setInterval(() => {
        if (!scene.guard || !scene.guard.body) {
          clearInterval(interval)
          resolve({ error: 'Guard not found' })
          return
        }
        
        const vel = scene.guard.body.velocity
        if (vel.x !== 0 || vel.y !== 0) {
          directions.push(Math.atan2(vel.y, vel.x))
        }
        
        if (Date.now() - startTime >= duration) {
          clearInterval(interval)
          
          // Detect flip-flop pattern
          let flipFlopCount = 0
          for (let i = 1; i < directions.length; i++) {
            const prevAngle = directions[i - 1]
            const currAngle = directions[i]
            
            // Normalize angle difference
            let angleDiff = currAngle - prevAngle
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI
            
            // Count reversals (angle change close to ±PI)
            if (Math.abs(Math.abs(angleDiff) - Math.PI) < 0.7) {
              flipFlopCount++
            }
          }
          
          resolve({
            totalSamples: directions.length,
            flipFlopCount,
            flipFlopRate: flipFlopCount / directions.length
          })
        }
      }, sampleInterval)
    })
  })

  expect(oscillationResult.error).toBeUndefined()
  expect(oscillationResult.totalSamples).toBeGreaterThan(1) // Should have some samples
  
  // Flip-flop rate should be low (< 20% of direction changes should be reversals)
  // High flip-flop rate would indicate oscillation
  expect(oscillationResult.flipFlopRate).toBeLessThan(0.2)

  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

/**
 * Test: Guard maintains movement in wall-adjacent corners (vertical and horizontal)
 * 
 * This test verifies the guard can navigate both vertical and horizontal
 * wall configurations without getting trapped.
 */
test('Guard maintains movement in wall-adjacent corners', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)

  // Test single level with corner configuration (to avoid timeout)
  const levels = [0] // Warehouse only
  
  for (const levelIndex of levels) {
    await startGameScene(page, levelIndex)
    await page.waitForTimeout(1500)

    const movementResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        const game = window.__ghostGame
        const scene = game.scene.keys.GameScene
        const positions = []
        const startTime = Date.now()
        const duration = 8000 // 8 seconds per level - longer sampling
        const sampleInterval = 400
        
        const interval = setInterval(() => {
          if (!scene.guard) {
            clearInterval(interval)
            resolve({ error: 'Guard not found' })
            return
          }
          
          positions.push({
            x: scene.guard.x,
            y: scene.guard.y
          })
          
          if (Date.now() - startTime >= duration) {
            clearInterval(interval)
            
            // Calculate min/max positions to determine movement range
            const xRange = Math.max(...positions.map(p => p.x)) - Math.min(...positions.map(p => p.x))
            const yRange = Math.max(...positions.map(p => p.y)) - Math.min(...positions.map(p => p.y))
            
            resolve({
              positionCount: positions.length,
              xRange,
              yRange,
              totalRange: Math.sqrt(xRange ** 2 + yRange ** 2)
            })
          }
        }, sampleInterval)
      })
    })

    expect(movementResult.error).toBeUndefined()
    expect(movementResult.positionCount).toBeGreaterThan(1) // Should have some samples
    
    // Guard should show some movement range (> 5 pixels in at least one direction)
    // This indicates it's successfully navigating corners
    expect(
      movementResult.xRange > 5 || movementResult.yRange > 5
    ).toBe(true)
    
    // Total range should show movement
    expect(movementResult.totalRange).toBeGreaterThan(5)
  }

  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})
