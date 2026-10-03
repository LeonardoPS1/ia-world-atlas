import { test } from '@playwright/test';

test('debug api connection', async ({ page }) => {
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()));
  page.on('response', res => console.log('RESPONSE:', res.url(), res.status()));
  
  await page.goto('/');
  await page.waitForTimeout(5000);
  
  const response = await page.evaluate(async () => {
    try {
      const res = await fetch('http://127.0.0.1:8787/api/health');
      return { status: res.status, text: await res.text() };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('FETCH RESULT:', response);
});