import { test, expect } from '@playwright/test';

test('change frame', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);
  const ok = await page.evaluate(() => {
    // get aladin instance from window if exposed, else we'll inject it in main.ts
    // Let's modify main.ts slightly in a real test, but here we can't easily.
    // However, A.aladin returns an array of aladin instances if we don't pass an ID, wait.
    return 'ok';
  });
  console.log(ok);
});
