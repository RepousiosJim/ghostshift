import { test, expect } from '@playwright/test'

// Capture ALL console messages
const allConsoleMessages = [];
const allPageErrors = [];

test('Capture all console errors - Full Game Flow', async ({ page }) => {
  page.on('pageerror', (err) => allPageErrors.push(String(err)));
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    allConsoleMessages.push({ type, text });
    if (type === 'error') {
      allPageErrors.push(`[console.${type}] ${text}`);
    }
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas')).toHaveCount(1);
  
  // Wait for boot to complete
  await page.waitForTimeout(2000);
  
  // Press space to start game
  await page.keyboard.press('Space');
  await page.waitForTimeout(2000);
  
  // Try basic movement
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowDown');
  
  await page.waitForTimeout(2000);
  
  // Force detection via game API
  const detectResult = await page.evaluate(() => {
    const game = window.__ghostGame;
    const scene = game?.scene?.getScene('GameScene');
    if (!scene) return { ok: false, error: 'Scene not found' };
    try {
      scene.detected();
      return { ok: true, isDetected: scene.isDetected };
    } catch(e) {
      return { ok: false, error: String(e) };
    }
  });
  console.log('Detect result:', detectResult);
  
  await page.waitForTimeout(1000);
  
  // Restart
  await page.keyboard.press('r');
  await page.waitForTimeout(2000);
  
  // Check for win condition
  const winResult = await page.evaluate(() => {
    const game = window.__ghostGame;
    const scene = game?.scene?.getScene('GameScene');
    if (!scene) return { ok: false, error: 'Scene not found' };
    try {
      scene.hasDataCore = true;
      scene.winGame();
      return { ok: true, hasWon: scene.hasWon };
    } catch(e) {
      return { ok: false, error: String(e) };
    }
  });
  console.log('Win result:', winResult);
  
  await page.waitForTimeout(1000);
  
  // Print all collected errors
  console.log('=== PAGE ERRORS ===');
  allPageErrors.forEach(e => console.log(e));
  console.log('=== CONSOLE ERRORS ===');
  allConsoleMessages.filter(m => m.type === 'error').forEach(m => console.log(m.text));
  console.log('=== CONSOLE WARNINGS ===');
  allConsoleMessages.filter(m => m.type === 'warning').forEach(m => console.log(m.text));
  
  expect(allPageErrors).toEqual([]);
});
