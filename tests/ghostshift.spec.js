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

test('GhostShift boots and survives basic play input without runtime errors', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)

  await page.keyboard.press('Space')

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

test('Fail flow triggers and restart recovers safely', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.keyboard.press('Space')

  // Force fail flow directly via scene API
  const failStatus = await page.evaluate(() => {
    const game = window.__ghostGame
    const scene = game?.scene?.getScene('MainScene')
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
    const scene = game?.scene?.getScene('MainScene')
    return { isDetected: scene?.isDetected, isRunning: scene?.isRunning }
  })

  expect(recovered.isDetected).toBe(false)
  expect(recovered.isRunning).toBe(true)
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})

test('Win flow + upgrade selection applies perk without crashing', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.keyboard.press('Space')

  const won = await page.evaluate(() => {
    const game = window.__ghostGame
    const scene = game?.scene?.getScene('MainScene')
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
    const scene = game?.scene?.getScene('MainScene')
    return { speed: scene?.applySpeedBoost, running: scene?.isRunning }
  })

  expect(upgradeApplied.speed).toBe(true)
  expect(upgradeApplied.running).toBe(true)
  assertNoRuntimeCrashes(pageErrors, consoleErrors)
})
