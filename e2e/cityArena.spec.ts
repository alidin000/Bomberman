import type { Page } from '@playwright/test';
import {
  expect, perfSampleAfter, roundCountdown, test, waitForLiveRound,
} from './fixtures';
import { OVERVIEW_PLATE } from '../src/view/CityArena/overviewPlate';

declare global {
  interface Window {
    /** performance.now() of every WebGL program link on this page. */
    e2eProgramLinks?: number[];
  }
}

const OSM_CREDIT = '© OpenStreetMap contributors';

// A city arena picked in the Mission Deck plays like any arena: its first
// countdown opens on the whole board, and nothing it draws (the mask's
// floor colours, its water, its skyline) compiles a shader once play starts.
test('a city arena from the Mission Deck: the overview, then a live round with no late shader', async ({ page }) => {
  await page.addInitScript(() => {
    const links: number[] = [];
    window.e2eProgramLinks = links;
    [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype].forEach((proto) => {
      const target = proto;
      const link = target.linkProgram;
      target.linkProgram = function linkProgram(program) {
        links.push(performance.now());
        return link.call(this, program);
      };
    });
  });

  await test.step('pick Rome in the Mission Deck and start against a CPU', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Enter the Arena' }).click();
    await expect(page.getByRole('dialog', { name: 'Mission Deck' })).toBeVisible();
    const local = page.getByRole('group', { name: 'game mode' })
      .getByRole('button', { name: /^Local Arena/ });
    await local.click();
    const rome = page.getByRole('group', { name: 'Arena' }).getByRole('button', { name: 'Rome', exact: true });
    await rome.click();
    await expect(rome).toHaveAttribute('aria-pressed', 'true');
    // The card's map and the linked credit under the choice.
    await expect(rome.locator('svg[data-city-preview="rome"]')).toBeVisible();
    await expect(page.getByRole('link', { name: OSM_CREDIT })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright'
    );
    await page.getByRole('button', { name: 'P2 controller: Human' }).click();
    await page.getByRole('button', { name: 'Start Battle' }).click();
    await expect(page).toHaveURL(/\/game\/2\/1\/rome$/);
  });

  const atLive = await test.step('the first countdown shows the whole board, then GO', async () => {
    // `?perf` is read when the match code loads: load the match address itself with it.
    await page.goto(`${new URL(page.url()).pathname}?perf`);
    await expect(roundCountdown(page)).toBeVisible({ timeout: 60_000 });
    const overview = page.getByRole('group', { name: 'map overview' });
    await expect(overview).toBeVisible();
    await expect(overview).toContainText('Rome');
    await expect(overview).toContainText(OSM_CREDIT);
    await expect(overview.getByRole('button', { name: 'Skip overview' })).toBeVisible();
    // The countdown sits in the plate, off the board's top centre, and the
    // plate fits the band the overview frames the board above.
    await expect(overview.getByLabel('round countdown')).toBeVisible();
    const plate = await overview.boundingBox();
    expect(plate?.height, 'the overview plate\'s height').toBeLessThanOrEqual(OVERVIEW_PLATE.heightPx);
    await waitForLiveRound(page);
    await expect(overview).toBeHidden();
    const at = await page.evaluate(() => performance.now());
    const sample = await perfSampleAfter(page, at);
    expect(sample.calls, 'the city arena draws').toBeGreaterThan(0);
    expect(sample.programs, 'programs warmed in the countdown').toBeGreaterThan(0);
    return { at, programs: sample.programs };
  });

  await test.step('play: P1 stands on their own bomb until the result', async () => {
    await page.keyboard.press('2');
    await expect(page.getByRole('button', { name: 'Rematch' })).toBeVisible({ timeout: 40_000 });
  });

  await test.step('no shader program compiled after GO', async () => {
    const links = await page.evaluate((since) => {
      const all = window.e2eProgramLinks ?? [];
      return {
        beforeLive: all.filter((at) => at <= since).length,
        afterLive: all.filter((at) => at > since).length,
      };
    }, atLive.at);
    // eslint-disable-next-line no-underscore-dangle
    const programs = await page.evaluate(() => window.__bombermanPerf?.programs);
    expect(links.beforeLive, 'programs linked before GO').toBeGreaterThan(0);
    expect.soft(links.afterLive, 'programs linked after GO').toBe(0);
    expect.soft(programs, 'renderer programs after the round').toBeLessThanOrEqual(atLive.programs);
  });
});

type DrawSample = { calls: number; triangles: number; programs: number };

/**
 * A local match on `id` with two idle seats, opened with `?perf`: the most
 * the first three renderer samples after GO drew.
 */
async function drawsAfterGo(page: Page, id: string): Promise<DrawSample> {
  await page.goto(`/game/2/1/${id}?perf`);
  await waitForLiveRound(page);
  const samples = [await perfSampleAfter(page, await page.evaluate(() => performance.now()))];
  while (samples.length < 3) {
    // eslint-disable-next-line no-await-in-loop
    samples.push(await perfSampleAfter(page, samples[samples.length - 1].sampledAt));
  }
  return {
    calls: Math.max(...samples.map((sample) => sample.calls)),
    triangles: Math.max(...samples.map((sample) => sample.triangles)),
    programs: Math.max(...samples.map((sample) => sample.programs)),
  };
}

// The plan's performance budget, against hiddenLeaf in the same run on the
// production build at 1366x768 with scenery on: at most 5 draw calls more
// than the village, no more shader programs, and at most 50,000 triangles of
// city scenery over the village's whole scene.
test('a city arena draws within the village arena\'s budget', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    localStorage.setItem('shinobiGamePreferences', JSON.stringify({ scenery: true }));
    localStorage.setItem('gameSetup', JSON.stringify({
      mode: 'local',
      selectedCharacters: ['naruto', 'sasuke'],
      selectedUpgrade: 'none',
      rounds: '1',
    }));
  });
  // The measurements go in the report, budget or not.
  const note = (id: string, draws: DrawSample) => test.info().annotations.push({
    type: id,
    description: `${draws.calls} calls, ${draws.triangles} triangles, ${draws.programs} programs`,
  });
  const village = await test.step('hiddenLeaf', () => drawsAfterGo(page, 'hiddenLeaf'));
  note('hiddenLeaf', village);
  expect(village.calls, 'the village arena draws').toBeGreaterThan(0);
  const cities = ['rome', 'barcelona', 'budapest', 'romeControl'];
  for (let index = 0; index < cities.length; index += 1) {
    const id = cities[index];
    // eslint-disable-next-line no-await-in-loop
    const city = await test.step(id, () => drawsAfterGo(page, id));
    note(id, city);
    expect.soft(city.calls, `${id}: draw calls (hiddenLeaf ${village.calls})`)
      .toBeLessThanOrEqual(village.calls + 5);
    expect.soft(city.programs, `${id}: shader programs (hiddenLeaf ${village.programs})`)
      .toBeLessThanOrEqual(village.programs);
    expect.soft(city.triangles - village.triangles, `${id}: triangles over hiddenLeaf's ${village.triangles}`)
      .toBeLessThanOrEqual(50_000);
  }
});
