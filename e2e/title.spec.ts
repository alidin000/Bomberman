import { expect, test } from './fixtures';

test('the title screen loads with its hero image', { tag: '@phone' }, async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Explosive Shinobi Arena');
  await expect(page.getByRole('heading', { level: 1, name: 'Explosive Shinobi Arena' })).toBeVisible();
  // The main door has focus on arrival, so Enter starts a match.
  await expect(page.getByRole('button', { name: 'Quick Play' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Battle a CPU' })).toBeEnabled();

  const hero = page.getByRole('img', { name: 'Hidden Leaf arena' });
  await expect(hero).toBeVisible();
  // The art is a CSS background, and a missing file would fall back to the
  // SPA page with a 200, so decode the very image the hero names.
  const decoded = await hero.evaluate(async (element) => {
    const match = /url\("?([^")]+)"?\)/.exec(getComputedStyle(element).backgroundImage);
    if (!match) return null;
    const [, src] = match;
    const image = new Image();
    image.src = src;
    await image.decode();
    return { src: image.src, width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(decoded?.src).toMatch(/ninja-bomber-hero-leaf.*\.webp$/);
  expect(decoded?.width).toBeGreaterThanOrEqual(256);
  expect(decoded?.height).toBeGreaterThanOrEqual(256);
});
