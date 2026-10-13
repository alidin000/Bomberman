import React from 'react';
import { vi } from 'vitest';
import {
  fireEvent, render, screen, within,
} from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { getStoryScene } from '../../content/storyScenes';
import { StoryScene, sceneSides } from './StoryScene';

function renderScene(onDone = vi.fn()) {
  render(
    <ThemeProvider theme={theme}>
      <StoryScene
        scene={getStoryScene('hiddenLeaf', 'after')}
        villageName="Hidden Leaf"
        accent="#ff8a00"
        finishLabel="Done"
        onDone={onDone}
      />
    </ThemeProvider>
  );
  return { onDone, dialog: screen.getByRole('dialog', { name: 'Sand on the Kunai' }) };
}

describe('StoryScene', () => {
  it('plays one line at a time under both portraits, with Back and a finish button', () => {
    const { onDone, dialog } = renderScene();
    expect(dialog).toHaveTextContent('Hidden Leaf · After the victory');
    expect(dialog.querySelector('svg[data-cast="sakura"]')).not.toBeNull();
    expect(dialog.querySelector('svg[data-cast="kakashi"]')).not.toBeNull();
    expect(dialog).toHaveTextContent('Sakura Haruno');
    expect(dialog).toHaveTextContent('1 / 3');
    const next = within(dialog).getByRole('button', { name: 'Next' });
    expect(next).toHaveFocus();
    expect(within(dialog).queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();

    fireEvent.click(next);
    expect(dialog).toHaveTextContent('Kakashi Hatake');
    expect(dialog).toHaveTextContent('Someone wants the villages at each other');
    // Focus stays on Next, so Enter or pad A keeps reading.
    expect(next).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(dialog).toHaveTextContent('1 / 3');

    fireEvent.click(next);
    fireEvent.click(next);
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledWith('finished');
  });

  it('skips with the Skip button or Escape (pad B)', () => {
    const first = renderScene();
    fireEvent.click(within(first.dialog).getByRole('button', { name: 'Skip scene' }));
    expect(first.onDone).toHaveBeenCalledWith('skipped');
    first.onDone.mockClear();
    fireEvent.keyDown(first.dialog, { key: 'Escape' });
    expect(first.onDone).toHaveBeenCalledWith('skipped');
  });

  it('keeps the first speaker on the left and brings each new one in on the right', () => {
    const war = getStoryScene('greatShinobiWar', 'before');
    expect(sceneSides(war, 0)).toEqual({ left: 'tsunade', right: 'shikamaru' });
    expect(sceneSides(war, 3)).toEqual({ left: 'tsunade', right: 'shikamaru' });
    expect(sceneSides(war, 4)).toEqual({ left: 'tsunade', right: 'jiraiya' });
  });
});
