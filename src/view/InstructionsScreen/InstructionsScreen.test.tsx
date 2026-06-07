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

  it('should display the Shinobi Arena manual title', () => {
    setup();
    const title = screen.getByText('Shinobi Arena Manual');
    expect(title).toBeInTheDocument();
  });

  it('should display the objective section correctly', () => {
    setup();
    const objective = screen.getByText(/defeat the village boss/i);
    expect(objective).toBeInTheDocument();
  });

  it('should navigate back to the home page when the back button is clicked', () => {
    setup();
    const backButton = screen.getByRole('button');
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
