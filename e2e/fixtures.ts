import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { BombermanPerfSnapshot } from '../src/view/GameScreen/scene/PerfProbe';

export { expect };

/** Any match route: /game/:numOfPlayers/:numOfRounds/:selectedMap. */
export const GAME_URL = /\/game\/\d+\/\d+\/\w+$/;

// Software WebGL runs the 3-2-1 countdown at a fraction of real speed.
const LIVE_TIMEOUT_MS = 40_000;

/**
 * Every test fails on a console error, an uncaught exception, or a request
 * that fails or answers 4xx/5xx, even when the screen looks right.
 */
export const test = base.extend<{ pageProblems: string[] }>({
  page: async ({ page }, use) => {
    // The first-match controls guide pauses the game until dismissed.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('shinobiControlsGuideSeen', 'true');
      } catch {
        // Storage off: the tests that need a live round will say so.
      }
    });
    await use(page);
  },
  pageProblems: [async ({ page }, use) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText ?? 'failed';
      // A page load cancels the previous page's downloads; nothing failed.
      if (reason === 'net::ERR_ABORTED') return;
      problems.push(`request failed: ${request.url()} (${reason})`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    await use(problems);
    expect(problems, 'console errors and failed requests').toEqual([]);
  }, { auto: true }],
});

export function roundCountdown(page: Page) {
  return page.getByLabel('round countdown');
}

/** The seat card in the HUD, such as "P1 Deidara" or "P2 Naruto · CPU Normal". */
export function seatCard(page: Page, slot: number) {
  return page.getByRole('group', { name: new RegExp(`^P${slot} `) });
}

/** Waits out the round-start countdown: the arena is frozen until it ends. */
export async function waitForLiveRound(page: Page) {
  const countdown = roundCountdown(page);
  await expect(countdown).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  await expect(countdown).toBeHidden({ timeout: LIVE_TIMEOUT_MS });
  // A pause or a menu hides the countdown too.
  await expect(page.getByRole('button', { name: 'pause game' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export function roundClock(page: Page) {
  return page.getByRole('timer', { name: 'round clock' });
}

/** The round clock in seconds ("Time 1:29" is 89). */
export async function clockSeconds(page: Page): Promise<number> {
  const match = /(\d+):(\d\d)/.exec(await roundClock(page).textContent() ?? '');
  expect(match, 'the round clock shows m:ss').not.toBeNull();
  return Number(match?.[1]) * 60 + Number(match?.[2]);
}

/** The round clock moves on from what it shows now: the round is in play. */
export async function expectClockRunning(page: Page) {
  const clock = roundClock(page);
  const now = await clock.textContent();
  await expect(clock).not.toHaveText(now ?? '', { timeout: LIVE_TIMEOUT_MS });
}

/** The countdown counts down: the frame loop, and with it WebGL, is running. */
export async function expectCountdownRunning(page: Page) {
  const countdown = roundCountdown(page);
  await expect(countdown).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  const first = await countdown.textContent();
  await expect(countdown).not.toHaveText(first ?? '', { timeout: LIVE_TIMEOUT_MS });
}

/** Title screen → "Battle a CPU": P1 against one CPU, one round. */
export async function openCpuBattle(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Battle a CPU' }).click();
  await expect(page).toHaveURL(GAME_URL);
}

/** "Battle a CPU", up to the arena on screen. */
export async function startCpuBattle(page: Page) {
  await openCpuBattle(page);
  await expect(page.locator('canvas')).toBeVisible();
}

/**
 * The newest `?perf` renderer sample taken after `after` (performance.now()
 * time). The probe publishes once per second of rendered frames.
 */
export async function perfSampleAfter(page: Page, after: number): Promise<BombermanPerfSnapshot> {
  const sample = await page.waitForFunction((since) => {
    // eslint-disable-next-line no-underscore-dangle
    const perf = window.__bombermanPerf;
    return perf && perf.sampledAt > since ? perf : null;
  }, after, { timeout: LIVE_TIMEOUT_MS });
  return sample.jsonValue() as Promise<BombermanPerfSnapshot>;
}
