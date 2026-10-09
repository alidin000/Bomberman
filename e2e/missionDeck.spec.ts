import type { Page } from '@playwright/test';
import {
  GAME_URL, expect, expectCountdownRunning, seatCard, test,
} from './fixtures';

async function openMissionDeck(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the Arena' }).click();
  await expect(page).toHaveURL(/\/config$/);
  await expect(page.getByRole('dialog', { name: 'Mission Deck' })).toBeVisible();
}

async function pickMode(page: Page, mode: 'Solo Campaign' | 'Local Arena') {
  const toggle = page.getByRole('group', { name: 'game mode' })
    .getByRole('button', { name: new RegExp(`^${mode}`) });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
}

test('Mission Deck: Local Arena → Start Battle opens a two-player match', async ({ page }) => {
  await openMissionDeck(page);
  await pickMode(page, 'Local Arena');
  await page.getByRole('button', { name: 'Start Battle' }).click();

  await expect(page).toHaveURL(/\/game\/2\/1\/\w+$/);
  await expect(page.locator('canvas')).toBeVisible();
  // Both seats are people on the keyboard by default.
  await expect(seatCard(page, 1)).toBeVisible();
  await expect(seatCard(page, 2)).toBeVisible();
  await expect(seatCard(page, 2)).not.toHaveAccessibleName(/CPU/);
  await expect(page.getByRole('timer', { name: 'round clock' })).toBeVisible();
  await expectCountdownRunning(page);
});

test('Mission Deck: Solo Campaign → Deploy Mission opens the mission', async ({ page }) => {
  await openMissionDeck(page);
  await pickMode(page, 'Solo Campaign');
  await page.getByRole('button', { name: 'Deploy Mission' }).click();

  await expect(page).toHaveURL(GAME_URL);
  await expect(page).toHaveURL(/\/game\/1\/1\//);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(seatCard(page, 1)).toBeVisible();
  await expect(page.getByLabel('mission objectives')).toBeVisible();
  await expectCountdownRunning(page);
});
