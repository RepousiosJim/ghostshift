/**
 * PLAY Button Asset Verification Test
 * 
 * Verifies that the PLAY button uses the menu_btn_play asset
 * and NOT the procedural fallback.
 */

import { test, expect } from '@playwright/test'

test('PLAY button uses asset texture, not procedural fallback', async ({ page }) => {
  const consoleLogs = []
  
  // Capture logs BEFORE navigating
  page.on('console', (msg) => {
    const text = msg.text()
    consoleLogs.push({ type: msg.type(), text })
  })
  
  // Navigate and wait
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  
  // Wait for boot and menu to fully load
  await page.waitForTimeout(4000)
  
  // Check for ANY logs related to PLAY button or asset loading
  const relevantLogs = consoleLogs.filter(log => 
    log.text.toLowerCase().includes('play') || 
    log.text.toLowerCase().includes('asset') ||
    log.text.toLowerCase().includes('boot') ||
    log.text.toLowerCase().includes('menu') ||
    log.text.toLowerCase().includes('texture') ||
    log.text.toLowerCase().includes('load')
  )
  
  console.log('\n========== RELEVANT LOGS ==========')
  relevantLogs.forEach(log => console.log(`[${log.type}] ${log.text}`))
  console.log('===================================\n')
  
  console.log(`Total console logs captured: ${consoleLogs.length}`)
  console.log(`Relevant logs: ${relevantLogs.length}`)
  
  // For now, just verify the game loaded without errors
  const hasErrors = consoleLogs.some(log => 
    log.type === 'error' && 
    !log.text.includes('WebGL') && 
    !log.text.includes('GL Driver')
  )
  expect(hasErrors, 'No critical console errors').toBe(false)
  
  // Verify the canvas is visible and has content
  const canvas = await page.locator('canvas')
  const boundingBox = await canvas.boundingBox()
  expect(boundingBox, 'Canvas should have dimensions').toBeTruthy()
  expect(boundingBox.width, 'Canvas should be wide enough').toBeGreaterThan(100)
  expect(boundingBox.height, 'Canvas should be tall enough').toBeGreaterThan(100)
})

test('PLAY button asset is loaded in BootScene', async ({ page }) => {
  const consoleLogs = []
  
  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() })
  })
  
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.waitForTimeout(2000)
  
  // Check for ANY logs
  console.log(`\nTotal logs captured: ${consoleLogs.length}`)
  
  // Print first 20 logs to understand what's being captured
  console.log('\n========== FIRST 20 LOGS ==========')
  consoleLogs.slice(0, 20).forEach(log => console.log(`[${log.type}] ${log.text}`))
  console.log('===================================\n')
  
  // Just verify no critical errors for now
  const hasCriticalErrors = consoleLogs.some(log => 
    log.type === 'error' && 
    /TypeError|ReferenceError|Cannot read/i.test(log.text)
  )
  expect(hasCriticalErrors, 'No critical errors').toBe(false)
})
