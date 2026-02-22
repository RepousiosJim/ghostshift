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

const GAME_WIDTH = 16 * 48
const GAME_HEIGHT = 12 * 48

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

  const centerX = GAME_WIDTH / 2
  const startY = 190
  const spacing = 65

  await clickGamePoint(page, centerX, startY + spacing * 4)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('SettingsScene'))

  await clickGamePoint(page, 40, 20)
  await page.waitForFunction(() => window.__ghostGame?.scene?.isActive('MainMenuScene'))

  await clickGamePoint(page, centerX, startY + spacing * 3)
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

test('Win flow + upgrade selection applies perk without crashing', async ({ page }) => {
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

  await page.keyboard.press('1')
  await page.waitForTimeout(800)

  const upgradeApplied = await page.evaluate(() => {
    const game = window.__ghostGame
    const scene = game?.scene?.getScene('GameScene')
    return { speed: scene?.applySpeedBoost, running: scene?.isRunning }
  })

  expect(upgradeApplied.speed).toBe(true)
  expect(upgradeApplied.running).toBe(true)
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
