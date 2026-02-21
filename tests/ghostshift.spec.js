import { test, expect } from '@playwright/test'

test('GhostShift boots and survives basic play input without runtime errors', async ({ page }) => {
  const pageErrors = []
  const consoleErrors = []

  page.on('pageerror', (err) => pageErrors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Canvas should render
  await expect(page.locator('canvas')).toHaveCount(1)

  // Start game from boot scene
  await page.keyboard.press('Space')

  // Simulate short play session
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(500)
  await page.keyboard.up('ArrowRight')

  await page.keyboard.down('ArrowDown')
  await page.waitForTimeout(500)
  await page.keyboard.up('ArrowDown')

  await page.keyboard.press('r')
  await page.waitForTimeout(800)

  // No uncaught runtime errors like collider null / isParent
  expect(pageErrors, `Page errors: ${pageErrors.join('\n')}`).toEqual([])
  expect(
    consoleErrors.filter((e) => /TypeError|isParent|collideObjects|Cannot read properties of null/i.test(e)),
    `Console errors: ${consoleErrors.join('\n')}`
  ).toEqual([])
})
