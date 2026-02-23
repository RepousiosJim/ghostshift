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

async function clickGamePoint(page, x, y) {
  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  expect(box).toBeTruthy()
  const scaleX = box.width / GAME_WIDTH
  const scaleY = box.height / GAME_HEIGHT
  await page.mouse.click(box.x + x * scaleX, box.y + y * scaleY)
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
  await page.waitForTimeout(500)
}

test('GhostShift boots and survives basic play input without runtime errors', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)

  await startGameScene(page)

  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(500)
  await page.keyboard.up('ArrowRight')

  await page.keyboard.down('ArrowDown')
  await page.waitForTimeout(500)
  await page.keyboard.up('ArrowDown')

  await page.keyboard.press('r')
  await page.waitForTimeout(800)

  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

test('Main menu settings -> back -> controls navigation works', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('MainMenuScene'))
  await page.waitForTimeout(500) // Wait for menu to be fully ready

  const centerX = GAME_WIDTH / 2
  const startY = 190
  const spacing = 65

  await clickGamePoint(page, centerX, startY + spacing * 4)
  await page.waitForTimeout(500) // Wait for transition
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('SettingsScene'))

  await clickGamePoint(page, 20, 15)
  await page.waitForTimeout(500)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('MainMenuScene'))

  await clickGamePoint(page, centerX, startY + spacing * 3)
  await page.waitForTimeout(500)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('ControlsScene'))

  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

test('Fail flow triggers and restart recovers safely', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await startGameScene(page)

  // Force fail flow directly via scene API
  const failStatus = await page.evaluate(() => {
    const game = window.__ghostGame
    const scene = game?.scene?.getScene('GameScene')
    if (!scene) return { ok: false }
    scene.detected()
    return { ok: true, isDetected: scene.isDetected }
  })

  expect(failStatus.ok).toBe(true)
  expect(failStatus.isDetected).toBe(true)

  await page.keyboard.press('r')
  await page.waitForTimeout(500)

  const recovered = await page.evaluate(() => {
    const game = window.__ghostGame
    const scene = game?.scene?.getScene('GameScene')
    return { isDetected: scene?.isDetected, isRunning: scene?.isRunning }
  })

  expect(recovered.isDetected).toBe(false)
  expect(recovered.isRunning).toBe(true)
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

test('Win flow transitions to results scene without crashing', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await startGameScene(page)

  const won = await page.evaluate(() => {
    const game = window.__ghostGame
    const scene = game?.scene?.getScene('GameScene')
    if (!scene) return false
    scene.hasDataCore = true
    scene.winGame()
    return true
  })
  expect(won).toBe(true)

  // Wait for scene transition to complete
  await page.waitForTimeout(1000)

  // Verify we're now in ResultsScene (or VictoryScene for final level)
  const inResults = await page.evaluate(() => {
    const game = window.__ghostGame
    return {
      inResults: game?.scene?.isActive('ResultsScene'),
      inVictory: game?.scene?.isActive('VictoryScene'),
      inGame: game?.scene?.isActive('GameScene')
    }
  })

  expect(inResults.inResults || inResults.inVictory).toBe(true)
  expect(inResults.inGame).toBe(false)

  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

test('Level transition cycle restart -> next -> menu -> reload without errors', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForTimeout(800)

  const started = await page.evaluate(() => {
    const game = window.__ghostGame
    if (!game) return false
    game.scene.start('GameScene', { levelIndex: 0 })
    return true
  })
  expect(started).toBe(true)

  await page.waitForTimeout(800)
  await page.keyboard.press('r')
  await page.waitForTimeout(800)

  const won = await page.evaluate(() => {
    const game = window.__ghostGame
    const scene = game?.scene?.getScene('GameScene')
    if (!scene) return false
    scene.hasDataCore = true
    scene.winGame()
    return true
  })
  expect(won).toBe(true)

  await page.waitForTimeout(800)

  const nextStarted = await page.evaluate(() => {
    const game = window.__ghostGame
    const results = game?.scene?.getScene('ResultsScene')
    if (!results) return { ok: false }
    const nextIndex = Math.min((results.levelIndex ?? 0) + 1, 1)
    results.transitionTo('GameScene', { levelIndex: nextIndex })
    return { ok: true }
  })
  expect(nextStarted.ok).toBe(true)

  await page.waitForTimeout(800)

  const menuOpened = await page.evaluate(() => {
    const game = window.__ghostGame
    const scene = game?.scene?.getScene('GameScene')
    if (!scene) return false
    scene.scene.start('MainMenuScene')
    return true
  })
  expect(menuOpened).toBe(true)

  await page.waitForTimeout(800)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)

  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

test('Main menu controls -> back -> settings navigation works', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('MainMenuScene'))
  await page.waitForTimeout(500) // Wait for menu to be fully ready

  const centerX = GAME_WIDTH / 2
  const startY = 190
  const spacing = 65

  // MainMenu -> Controls
  await clickGamePoint(page, centerX, startY + spacing * 3)
  await page.waitForTimeout(500)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('ControlsScene'))

  // Controls -> Back (to MainMenu)
  await clickGamePoint(page, 20, 15)
  await page.waitForTimeout(500)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('MainMenuScene'))

  // MainMenu -> Settings
  await clickGamePoint(page, centerX, startY + spacing * 4)
  await page.waitForTimeout(500)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('SettingsScene'))

  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

test('Main menu -> level select -> back -> main menu navigation works', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('MainMenuScene'))
  await page.waitForTimeout(500) // Wait for menu to be fully ready

  const centerX = GAME_WIDTH / 2
  const startY = 190
  const spacing = 65

  // MainMenu -> LevelSelect (via PLAY button)
  await clickGamePoint(page, centerX, startY)
  await page.waitForTimeout(500)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('LevelSelectScene'))

  // LevelSelect -> Back (to MainMenu)
  await clickGamePoint(page, 40, 20)
  await page.waitForTimeout(500)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('MainMenuScene'))

  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

test('Level select -> play level -> restart cycle works', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('MainMenuScene'))
  await page.waitForTimeout(500) // Wait for menu to be fully ready

  const centerX = GAME_WIDTH / 2
  const startY = 190

  // MainMenu -> LevelSelect
  await clickGamePoint(page, centerX, startY)
  await page.waitForTimeout(500)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('LevelSelectScene'))

  // Click on first level card (y position: startY=80, spacingY=88)
  await clickGamePoint(page, centerX, 80)
  await page.waitForTimeout(2000)

  // Verify we're in GameScene
  const inGame = await page.evaluate(() => {
    const game = window.__ghostGame
    return { inGame: game?.scene?.isActive('GameScene') }
  })
  expect(inGame.inGame).toBe(true)

  // Press R to restart
  await page.keyboard.press('r')
  await page.waitForTimeout(800)

  // Verify game is still running after restart
  const stillRunning = await page.evaluate(() => {
    const game = window.__ghostGame
    const scene = game?.scene?.getScene('GameScene')
    return { isRunning: scene?.isRunning, isDetected: scene?.isDetected }
  })
  expect(stillRunning.isRunning).toBe(true)
  expect(stillRunning.isDetected).toBe(false)

  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})
