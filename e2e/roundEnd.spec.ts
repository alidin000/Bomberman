import {
  expect, openCpuBattle, perfSampleAfter, roundCountdown, seatCard, test, waitForLiveRound,
} from './fixtures';

declare global {
  interface Window {
    /** performance.now() of every WebGL program link on this page. */
    e2eProgramLinks?: number[];
  }
}

// Every material variant compiles during the 3-2-1 countdown (ShaderWarmup).
// A variant it misses compiles the first time its entity appears, which
// freezes a live round for a moment.
test('a round played out compiles no shader after GO, and Rematch starts over', async ({ page }) => {
  // Each program three.js builds is linked once: count the links.
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

  const atLive = await test.step('open the match with ?perf and wait for GO', async () => {
    // `?perf` is read when the match code loads, and an in-app navigation
    // drops the query, so load the match address itself with it.
    await openCpuBattle(page);
    await page.goto(`${new URL(page.url()).pathname}?perf`);
    await waitForLiveRound(page);
    const at = await page.evaluate(() => performance.now());
    const sample = await perfSampleAfter(page, at);
    expect(sample.calls, 'the arena draws').toBeGreaterThan(0);
    expect(sample.programs, 'programs warmed in the countdown').toBeGreaterThan(0);
    return { at, programs: sample.programs };
  });

  await test.step('play: P1 stands on their own bomb until the result', async () => {
    // A bomb, its fuse ring, the blast, the knockout and the CPU's moves
    // all appear mid-round; the one-round match then ends.
    await page.keyboard.press('2');
    await expect(page.getByRole('button', { name: 'Rematch' })).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('table', { name: 'match breakdown' })).toBeVisible();
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
    // Soft, so a failure reports both counts.
    expect.soft(links.afterLive, 'programs linked after GO').toBe(0);
    expect.soft(programs, 'renderer programs after the round').toBeLessThanOrEqual(atLive.programs);
  });

  await test.step('Rematch starts the match again', async () => {
    const rematch = page.getByRole('button', { name: 'Rematch' });
    // The result ignores clicks for its first moments: retry until one lands.
    await expect(async () => {
      if (await rematch.isVisible()) await rematch.click({ timeout: 2_000 });
      await expect(roundCountdown(page)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    await expect(rematch).toBeHidden();
    await expect(seatCard(page, 1).getByRole('img', { name: /^Bombs ready/ })).toBeVisible();
  });
});
