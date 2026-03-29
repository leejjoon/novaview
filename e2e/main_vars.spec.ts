import { test, expect } from '@playwright/test';

test('get aladin instances', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);

  // Can we inspect the A.aladin elements?
  const viewOk = await page.evaluate(() => {
    return !!document.querySelector('.aladin-container');
  });
  console.log(viewOk);
});
