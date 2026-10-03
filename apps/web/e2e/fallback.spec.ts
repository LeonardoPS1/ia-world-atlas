import { expect, test } from '@playwright/test';
import { expectStatus, gotoAtlas, openProject, projectCount } from './helpers.ts';

test.use({ reducedMotion: 'no-preference' });

test('falls back to a data-only map and still works', async ({ page }) => {
  await gotoAtlas(page, { map: 'fallback' });
  await expectStatus(page, 'ok');
  await expect(page.getByTestId('fallback')).toBeVisible();
  await expect(page.getByTestId('fallback-diagnostic')).toContainText('?map=fallback');
  await expect(page.getByTestId('map-host')).toHaveAttribute('data-map-mode', 'fallback');
  await expect.poll(() => projectCount(page)).toBe(5);
});

test('opens a project from the fallback map', async ({ page }) => {
  await gotoAtlas(page, { map: 'fallback' });
  await openProject(page, 'pucv-fondecyt-fuzzy');
  await expect(page.getByTestId('drawer-title')).toContainText('Fuzzy');
});

test('loads no map tiles in fallback mode', async ({ page }) => {
  const tileRequests: string[] = [];
  page.on('request', (request) => {
    if (/tiles\.mapbox|api\.mapbox\.com/.test(request.url())) tileRequests.push(request.url());
  });
  await gotoAtlas(page, { map: 'fallback' });
  await expectStatus(page, 'ok');
  expect(tileRequests).toEqual([]);
});