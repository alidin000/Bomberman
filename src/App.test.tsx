import { vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { App } from './App';
import theme from './theme/InstructionsTheme';
import { GameSettingsProvider } from './contexts/GameSettingsContext';

vi.mock('./view/GameScreen/GameScreen', () => ({
  GameScreen: () => <div>GameScreen</div>,
}));
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
  const renderApp = (route: string) => {
    window.history.pushState({}, 'Test page', route);
    render(
      <GameSettingsProvider>
        <ThemeProvider theme={theme}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </GameSettingsProvider>
    );
  };

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

  it('should render GameScreen for the game route', () => {
    renderApp('/game/2/3/map1');
    expect(screen.getByText('GameScreen')).toBeInTheDocument();
  });
});
