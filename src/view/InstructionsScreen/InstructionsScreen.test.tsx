import { vi, type Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter, useNavigate, NavigateFunction } from 'react-router-dom';
import { InstructionsScreen } from './InstructionsScreen';

vi.mock('react-router-dom', async () => {
  const originalModule = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...originalModule,
    useNavigate: vi.fn(),
  };
});

describe('InstructionsScreen', () => {
  let mockNavigate: Mock<NavigateFunction>;

  const setup = () => {
    mockNavigate = vi.fn();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    render(
      <BrowserRouter>
        <InstructionsScreen />
      </BrowserRouter>
    );
  };

  it('should display the Shinobi field manual title', () => {
    setup();
    const title = screen.getByText('Shinobi Field Manual');
    expect(title).toBeInTheDocument();
  });

  it('should display the core rules sections', () => {
    setup();
    expect(screen.getByText('Read this before the next run')).toBeInTheDocument();
    expect(screen.getByText('Bomb Rules')).toBeInTheDocument();
    expect(screen.getByText('Campaign Rules')).toBeInTheDocument();
    expect(screen.getByText('Enemy Rules')).toBeInTheDocument();
    expect(screen.getByText(/After planting a bomb/i)).toBeInTheDocument();
    expect(screen.getByText(/Normal enemies and Zetsu only chase/i)).toBeInTheDocument();
  });

  it('should navigate back to the home page when the back button is clicked', () => {
    setup();
    const backButton = screen.getByRole('button');
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
