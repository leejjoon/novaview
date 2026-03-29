import { test, expect } from '@playwright/test';

test('aladin frame change', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);
  const ok = await page.evaluate(() => {
    // let's see how we can get aladin instance. It is created in main.ts but not exposed to window.
    // wait, main.ts does not expose `aladin`.
    return true;
  });
  console.log(ok);
});
