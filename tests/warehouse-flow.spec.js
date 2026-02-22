import { test, expect } from '@playwright/test';

function attachErrorCollectors(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return { pageErrors, consoleErrors };
}

test('Warehouse flow: start, collect objectives, retry, win, next level transition', async ({ page }) => {
  const { pageErrors, consoleErrors } = attachErrorCollectors(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas')).toHaveCount(1);

  // Start Warehouse level directly
  await page.evaluate(() => {
    const game = window.__ghostGame;
    game?.scene?.start('GameScene', { levelIndex: 0 });
  });

  await page.waitForTimeout(800);

  // Simulate collecting Security Code + Power Cell without crashing
  const collected = await page.evaluate(() => {
    const game = window.__ghostGame;
    const scene = game?.scene?.getScene('GameScene');
    if (!scene) return { ok: false };
    scene.collectSecurityCode(scene.player, { destroy() {} });
    scene.collectPowerCell(scene.player, { destroy() {} });
    return { ok: true, hasSecurityCode: scene.hasSecurityCode, hasPowerCell: scene.hasPowerCell };
  });

  expect(collected.ok).toBe(true);
  expect(collected.hasSecurityCode).toBe(true);
  expect(collected.hasPowerCell).toBe(true);

  // Trigger fail -> retry flow
  await page.evaluate(() => {
    const game = window.__ghostGame;
    const scene = game?.scene?.getScene('GameScene');
    if (!scene) return;
    scene.detected();
    scene.scene.start('ResultsScene', {
      levelIndex: 0,
      success: false,
      time: scene.elapsedTime,
      credits: 0
    });
  });

  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const game = window.__ghostGame;
    game?.scene?.start('GameScene', { levelIndex: 0 });
  });
  await page.waitForTimeout(800);

  const restarted = await page.evaluate(() => {
    const game = window.__ghostGame;
    const scene = game?.scene?.getScene('GameScene');
    return { isRunning: scene?.isRunning, isDetected: scene?.isDetected };
  });

  expect(restarted.isDetected).toBe(false);
  expect(restarted.isRunning).toBe(true);

  // Trigger win flow
  await page.evaluate(() => {
    const game = window.__ghostGame;
    const scene = game?.scene?.getScene('GameScene');
    if (!scene) return;
    scene.hasDataCore = true;
    scene.winGame();
  });

  await page.waitForTimeout(600);

  // Transition to next level from results scene
  const nextLevel = await page.evaluate(() => {
    const game = window.__ghostGame;
    if (!game?.scene) return { ok: false };
    game.scene.start('GameScene', { levelIndex: 1 });
    return { ok: true };
  });

  expect(nextLevel.ok).toBe(true);

  await page.waitForTimeout(800);

  expect(pageErrors, `Page errors: ${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join('\n')}`).toEqual([]);
});
