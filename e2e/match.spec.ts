import {
  clockSeconds,
  expect,
  expectClockRunning,
  expectCountdownRunning,
  openCpuBattle,
  roundCountdown,
  seatCard,
  startCpuBattle,
  test,
  waitForLiveRound,
} from './fixtures';

test('Battle a CPU starts a live match, and Restart asks first', { tag: '@phone' }, async ({ page }) => {
  await test.step('Battle a CPU starts a live match', async () => {
    await startCpuBattle(page);
    await expect(seatCard(page, 1)).toBeVisible();
    await expect(seatCard(page, 2)).toHaveAccessibleName(/CPU/);
    await waitForLiveRound(page);
    await expectClockRunning(page);
  });

  const pauseButton = page.getByRole('button', { name: 'pause game' });
  const pauseMenu = page.getByRole('dialog', { name: /Paused/ });
  const confirm = page.getByRole('dialog', { name: 'Restart The Match?' });

  await test.step('pause → Restart → Stay keeps the round', async () => {
    await pauseButton.click();
    await expect(pauseMenu).toBeVisible();
    const pausedAt = await clockSeconds(page);

    await pauseMenu.getByRole('button', { name: 'Restart', exact: true }).click();
    await expect(confirm).toBeVisible();
    // The safe answer takes focus, so a stray Enter keeps the match.
    await expect(confirm.getByRole('button', { name: 'Stay' })).toBeFocused();
    await confirm.getByRole('button', { name: 'Stay' }).click();
    await expect(confirm).toBeHidden();
    await expect(pauseMenu).toBeVisible();

    await pauseMenu.getByRole('button', { name: 'Resume' }).click();
    await expect(pauseMenu).toBeHidden();
    // Every reading until the clock moves: a restart would show a new
    // countdown and put the clock back to the full round.
    const seen = { highest: 0, countdown: false };
    await expect.poll(async () => {
      const seconds = await clockSeconds(page);
      seen.highest = Math.max(seen.highest, seconds);
      if (await roundCountdown(page).isVisible()) seen.countdown = true;
      return seconds;
    }, { timeout: 40_000 }).toBeLessThan(pausedAt);
    expect(seen.highest, 'clock never went back').toBeLessThanOrEqual(pausedAt);
    expect(seen.countdown, 'no new countdown').toBe(false);
  });

  await test.step('pause → Restart → Restart Match starts over', async () => {
    await pauseButton.click();
    await pauseMenu.getByRole('button', { name: 'Restart', exact: true }).click();
    await confirm.getByRole('button', { name: 'Restart Match' }).click();
    await expect(confirm).toBeHidden();
    await expect(pauseMenu).toBeHidden();
    await expectCountdownRunning(page);
  });
});

test('a match deep link renders after a client navigation', async ({ page }) => {
  await openCpuBattle(page);
  const matchUrl = page.url();

  // A full load of the same address: the host serves the app for the deep
  // link, every asset resolves from it, and the setup comes back from storage.
  await page.reload();
  await expect(page).toHaveURL(matchUrl);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(seatCard(page, 2)).toHaveAccessibleName(/CPU/);
  await expectCountdownRunning(page);
});
