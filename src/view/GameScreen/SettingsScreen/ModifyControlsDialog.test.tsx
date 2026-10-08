import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { vi } from 'vitest';
import theme from '../../../theme/InstructionsTheme';
import { DEFAULT_KEY_BINDINGS } from '../../../constants/props';
import ModifyControlsDialog from './ModifyControlsDialog';

describe('ModifyControlsDialog', () => {
  it('keeps navigation keys free and renders Space bindings clearly', () => {
    render(
      <ThemeProvider theme={theme}>
        <ModifyControlsDialog
          isOpen
          onClose={vi.fn()}
          onSave={vi.fn()}
          keyBindings={DEFAULT_KEY_BINDINGS}
          numOfPlayers="1"
        />
      </ThemeProvider>
    );

    const upKey = screen.getByLabelText('player 1 up key');
    expect(fireEvent.keyDown(upKey, { key: 'Tab' })).toBe(true);
    fireEvent.keyDown(upKey, { key: 'c', ctrlKey: true });
    expect(upKey).toHaveValue('W');

    fireEvent.keyDown(upKey, { key: ' ' });
    expect(upKey).toHaveValue('Space');
  });
});
