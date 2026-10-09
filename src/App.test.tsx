import { vi } from 'vitest';
import React from 'react';
import {
  act, render, screen, waitFor,
} from '@testing-library/react';
import { MemoryRouter, NavigateFunction, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme/InstructionsTheme';
import { GameSettingsProvider } from './contexts/GameSettingsContext';

// Counts how often the match module is evaluated, i.e. downloaded.
const gameModule = { loads: 0 };

vi.mock('./view/WelcomeScreen/WelcomeScreen', () => ({
  WelcomeScreen: () => <div>WelcomeScreen</div>,
}));
vi.mock('./view/ConfigScreen/ConfigScreen', () => ({
  ConfigScreen: () => <div>ConfigScreen</div>,
}));
vi.mock('./view/InstructionsScreen/InstructionsScreen', () => ({
  InstructionsScreen: () => <div>InstructionsScreen</div>,
}));

describe('App', () => {
  let App: typeof import('./App').App;
  const navigation: { navigate?: NavigateFunction } = {};

  const NavigationProbe = () => {
    navigation.navigate = useNavigate();
    return null;
  };

  // A fresh module registry per test, so each one starts with nothing loaded.
  beforeEach(async () => {
    vi.resetModules();
    gameModule.loads = 0;
    vi.doMock('./view/GameScreen/GameScreen', () => {
      gameModule.loads += 1;
      return { GameScreen: () => <div>GameScreen</div> };
    });
    ({ App } = await import('./App'));
  });

  const renderApp = (route: string) => render(
    <GameSettingsProvider>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[route]}>
          <App />
          <NavigationProbe />
        </MemoryRouter>
      </ThemeProvider>
    </GameSettingsProvider>
  );

  it('should render WelcomeScreen for the root route', () => {
    renderApp('/');
    expect(screen.getByText('WelcomeScreen')).toBeInTheDocument();
  });

  it('should render ConfigScreen for the config route', () => {
    renderApp('/config');
    expect(screen.getByText('ConfigScreen')).toBeInTheDocument();
  });

  it('should render InstructionsScreen for the instructions route', () => {
    renderApp('/instructions');
    expect(screen.getByText('InstructionsScreen')).toBeInTheDocument();
  });

  it('should render GameScreen for the game route', async () => {
    renderApp('/game/2/3/map1');
    expect(await screen.findByText('GameScreen')).toBeInTheDocument();
  });

  it('keeps the match code out of the title screen until the page is idle', async () => {
    expect(gameModule.loads).toBe(0);
    renderApp('/');
    expect(gameModule.loads).toBe(0);

    await waitFor(() => expect(gameModule.loads).toBe(1));
  });

  it('fetches the match code once when the Mission Deck opens and reuses it for the match', async () => {
    expect(gameModule.loads).toBe(0);
    renderApp('/config');
    await waitFor(() => expect(gameModule.loads).toBe(1));

    act(() => navigation.navigate?.('/'));
    act(() => navigation.navigate?.('/config'));
    act(() => navigation.navigate?.('/game/2/1/hiddenLeaf'));

    expect(await screen.findByText('GameScreen')).toBeInTheDocument();
    expect(gameModule.loads).toBe(1);
  });
});
