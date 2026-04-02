import { test, expect } from '@playwright/test';

test('Changing min/max cuts in multiple viewports independently', async ({ page }) => {
  // Use two distinct public surveys
  const survey1 = 'https://alasky.cds.unistra.fr/DSS/DSSColor';
  const survey2 = 'https://alasky.u-strasbg.fr/AllWISE/RGB';
  
  // Go to the browser version with both surveys via URL parameters
  await page.goto(`/?survey=${survey1}&survey=${survey2}`);

  // Wait for Aladin instances to initialize
  await page.waitForFunction(() => (window as any).aladinInstances && (window as any).aladinInstances.length === 2, { timeout: 10000 });

  // Open Analysis Toolkit to access cuts inputs
  await page.click('#btn-toggle-analysis');
  
  const inputVmin = page.locator('#input-vmin');
  const inputVmax = page.locator('#input-vmax');
  const btnApplyCuts = page.locator('#btn-apply-cuts');

  // --- Step 1: Set cuts for the FIRST viewport (should be active by default) ---
  await inputVmin.fill('1.0');
  await inputVmax.fill('10.0');
  await btnApplyCuts.click();
  
  // Verify first Aladin instance has the correct cuts
  let cuts1 = await page.evaluate(() => {
    const layer = (window as any).aladinInstances[0].getBaseImageLayer();
    const cfg = layer.getColorCfg();
    return [cfg.getMinCut(), cfg.getMaxCut()];
  });
  console.log('Instance 0 cuts:', cuts1);
  expect(cuts1).toEqual([1.0, 10.0]);

  // --- Step 2: Switch to the SECOND viewport ---
  // Viewports have IDs aladin-container-0, aladin-container-1, etc.
  await page.click('#aladin-container-1');
  
  // The UI should now reflect the defaults/current values for the second instance.
  // Let's set different cuts for it.
  await inputVmin.fill('2.5');
  await inputVmax.fill('25.0');
  await btnApplyCuts.click();
  
  // Verify second Aladin instance has its own cuts
  let cuts2 = await page.evaluate(() => {
    const layer = (window as any).aladinInstances[1].getBaseImageLayer();
    const cfg = layer.getColorCfg();
    return [cfg.getMinCut(), cfg.getMaxCut()];
  });
  console.log('Instance 1 cuts:', cuts2);
  expect(cuts2).toEqual([2.5, 25.0]);

  // --- Step 3: Switch back to the FIRST viewport and verify its cuts remained unchanged ---
  await page.click('#aladin-container-0');
  
  // The UI inputs should update to reflect instance 0's values
  // However, the current implementation doesn't seem to update UI inputs when switching viewports.
  // Let's check the underlying Aladin instance directly first.
  cuts1 = await page.evaluate(() => {
    const layer = (window as any).aladinInstances[0].getBaseImageLayer();
    const cfg = layer.getColorCfg();
    return [cfg.getMinCut(), cfg.getMaxCut()];
  });
  console.log('Instance 0 cuts after switching back:', cuts1);
  expect(cuts1).toEqual([1.0, 10.0]);
  
  // Also check if the UI inputs updated themselves (if the app supports that)
  const vminVal = await inputVmin.inputValue();
  const vmaxVal = await inputVmax.inputValue();
  console.log(`UI Inputs for Instance 0: vmin=${vminVal}, vmax=${vmaxVal}`);
  // If the app doesn't sync UI -> Viewport on click, this might fail, but let's see.
});
