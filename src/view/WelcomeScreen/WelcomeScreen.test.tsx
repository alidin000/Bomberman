import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter, useNavigate, NavigateFunction } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../theme/InstructionsTheme';
import { WelcomeScreen } from './WelcomeScreen';

jest.mock('react-router-dom', () => {
  const originalModule = jest.requireActual('react-router-dom');
  return {
    ...originalModule,
    useNavigate: jest.fn(),
  };
});

describe('WelcomeScreen', () => {
  let mockNavigate: jest.Mock<NavigateFunction>;

  beforeEach(() => {
    mockNavigate = jest.fn();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  });

  const setup = () => {
    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <WelcomeScreen />
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  it('should display the game title', () => {
    setup();
    expect(screen.getByText('Explosive Shinobi Arena')).toBeInTheDocument();
  });

  it('should navigate to /config when Enter the Arena is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /enter the arena/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/config');
  });

  it('should navigate to /instructions when Shinobi Manual is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /shinobi manual/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/instructions');
  });
});
