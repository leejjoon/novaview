import { test, expect } from '@playwright/test';

test('UI updates and interactions', async ({ page }) => {
  await page.goto('/');

  // wait for aladin to initialize
  await page.waitForTimeout(3000);

  // Open Data Sources Panel
  await page.click('#btn-toggle-data-sources');

  // Check if unneccesary nav items are gone
  await expect(page.locator('text=File')).toHaveCount(0);
  await expect(page.locator('text=Windows')).toHaveCount(0);

  // Test Survey List UI
  const surveyList = page.locator('#survey-list');
  await expect(surveyList).toBeVisible();

  const inputNewSurvey = page.locator('#input-new-survey');
  const btnAddSurvey = page.locator('#btn-add-survey');

  await inputNewSurvey.fill('https://alasky.cds.unistra.fr/DSS/DSSColor');
  await btnAddSurvey.click();

  await expect(surveyList.locator('p[title="https://alasky.cds.unistra.fr/DSS/DSSColor"]')).toBeVisible();

  // Remove the survey
  await surveyList.locator('button[title="Remove survey"]').last().click();
  await expect(surveyList.locator('p[title="https://alasky.cds.unistra.fr/DSS/DSSColor"]')).toHaveCount(0);

  // Open Analysis Toolkit
  await page.click('#btn-toggle-analysis');

  // Test Coord Frame UI
  const coordSelect = page.locator('#coord-frame-select');
  await expect(coordSelect).toBeVisible();
  await coordSelect.selectOption('icrs');

  const frameValue = await page.evaluate(() => {
    return (window as any).aladin.getFrame();
  });
  expect(frameValue).toBe('ICRS');

  // Test Image Cuts UI +/- buttons
  const inputVmin = page.locator('#input-vmin');
  const btnVminInc = page.locator('#btn-vmin-inc');

  const initialVmin = await inputVmin.inputValue();
  await btnVminInc.click();
  const nextVmin = await inputVmin.inputValue();

  expect(parseFloat(nextVmin)).toBeCloseTo(parseFloat(initialVmin) + 0.5);
});
