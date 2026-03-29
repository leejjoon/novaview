import { test, expect } from '@playwright/test';

test('aladin frame', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000); // wait for aladin to load
  const frames = await page.evaluate(() => {
    // try to access global aladin instance if we can, or just inspect A
    const keys = Object.keys((window as any).A);
    return keys;
  });
  console.log('A keys:', frames);
});
