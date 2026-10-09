import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function canvasColorCount(page: Page): Promise<number> {
  const png = await page.locator('canvas').screenshot();
  const source = `data:image/png;base64,${png.toString('base64')}`;
  return page.evaluate((imageSource) => new Promise<number>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const sample = document.createElement('canvas');
      sample.width = image.width;
      sample.height = image.height;
      const context = sample.getContext('2d');
      if (!context) {
        resolve(0);
        return;
      }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
      const colors = new Set<string>();
      const stride = Math.max(4, Math.floor(pixels.length / 4000 / 4) * 4);
      for (let index = 0; index < pixels.length; index += stride) {
        colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      }
      resolve(colors.size);
    };
    image.onerror = () => reject(new Error('Could not decode the canvas screenshot'));
    image.src = imageSource;
  }), source);
}

test(
  'two browsers create, join, and start one online match',
  { tag: '@phone' },
  async ({ browser, page }, testInfo) => {
    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    const guestProblems: string[] = [];
    guest.on('console', (message) => {
      if (message.type() === 'error') guestProblems.push(message.text());
    });
    guest.on('pageerror', (error) => guestProblems.push(error.message));

    try {
      await page.goto('/online');
      await page.getByLabel('display name').fill('Host');
      await page.getByRole('button', { name: 'Create room' }).click();
      const codeElement = page.locator('strong').filter({ hasText: /^[A-HJ-NP-Z2-9]{6}$/ });
      await expect(codeElement).toBeVisible();
      const roomCode = (await codeElement.textContent()) ?? '';

      await guest.goto(new URL(`/online/${roomCode}`, page.url()).toString());
      await guest.getByLabel('display name').fill('Guest');
      await guest.getByRole('button', { name: 'Join room' }).click();
      await expect(page.getByText('P2 · Guest')).toBeVisible();
      await expect(guest.getByText('P1 · Host')).toBeVisible();

      await page.getByRole('button', { name: 'Ready' }).click();
      await guest.getByRole('button', { name: 'Ready' }).click();
      await expect(page).toHaveURL(new RegExp(`/online/${roomCode}/play$`));
      await expect(guest).toHaveURL(new RegExp(`/online/${roomCode}/play$`));
      await expect(page.locator('canvas')).toBeVisible();
      await expect(guest.locator('canvas')).toBeVisible();
      await expect(page.getByLabel('online match status')).toContainText('Connected');
      await expect(guest.getByLabel('online match status')).toContainText('Connected');
      await expect.poll(() => canvasColorCount(page)).toBeGreaterThan(20);
      await page.screenshot({ path: testInfo.outputPath('online-host.png') });
      expect(guestProblems).toEqual([]);
    } finally {
      await guestContext.close();
    }
  }
);
