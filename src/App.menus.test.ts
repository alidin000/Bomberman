import { vi } from 'vitest';

// App loads the menus up front and splits the match code out so they stay
// light. The stage looks (every village's and city's sky, lights and
// skyline) are match data: the Mission Deck's city cards and the loading
// view draw from content/cityColors instead. A menu that imports the looks
// again puts all ten into the first-load chunk.
vi.mock('./content/stageLooks', () => {
  throw new Error('the menus loaded content/stageLooks');
});

describe('the menus App loads up front', () => {
  it('load without the stage looks', async () => {
    await expect(import('./App')).resolves.toHaveProperty('App');
  });
});
