import { expect, type Page } from '@playwright/test';

export async function gotoAtlas(page: Page, options: { map?: 'globe' | 'fallback' } = {}): Promise<void> {
  const query = options.map === 'fallback' ? '?map=fallback' : '';
  await page.goto(`/${query}`);
  await expect(page.getByTestId('app-root')).toBeVisible();
  await expect(page.getByTestId('api-status')).toBeVisible();
  // Wait for project list to load (fallback mode loads projects after API responses)
  await expect.poll(() => page.locator('[data-project-id]').count(), { timeout: 15000 }).toBeGreaterThan(0);
}

export async function expectStatus(page: Page, state: 'ok' | 'error'): Promise<void> {
  await expect(page.getByTestId('api-status')).toHaveAttribute('data-state', state, { timeout: 15_000 });
}

export async function projectCount(page: Page): Promise<number> {
  return page.locator('[data-project-id]').count();
}

export async function openProject(page: Page, id: string): Promise<void> {
  await page.locator(`[data-project-id="${id}"]`).first().click();
  await expect(page.getByTestId('drawer')).toBeVisible();
}

export async function matchingCountText(page: Page): Promise<string> {
  return (await page.getByTestId('matching-count').textContent()) ?? '';
}