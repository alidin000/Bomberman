import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect'; // for the "toBeInTheDocument" matcher
import { PlayerStatus } from './PlayerStatusScreen';
import { Player } from '../../../model/player';

const playerImages = {
  original: 'path_to_original_image',
  ghost: 'path_to_ghost_image',
  invincible: 'path_to_invincible_image',
};

describe('PlayerStatus', () => {
  const mockPlayer = new Player(
    '1',
    'Player 1',
    1,
    1,
    true,
    3,
    2,
    ['Detonator', 'Ghost'],
    1,
    playerImages.original,
    playerImages.ghost,
    playerImages.invincible
  );

  it('renders player name', () => {
    render(<PlayerStatus player={mockPlayer} index={0} />);
    expect(screen.getByText('Player 1')).toBeInTheDocument();
  });

  it('displays the number of clay charges', () => {
    render(<PlayerStatus player={mockPlayer} index={0} />);
    expect(screen.getByText('Clay Charges:3')).toBeInTheDocument();
  });

  it('displays the number of earth seals', () => {
    render(<PlayerStatus player={mockPlayer} index={0} />);
    expect(screen.getByText('Earth Seals:1')).toBeInTheDocument();
  });

  it('renders the correct power-up icons', () => {
    render(<PlayerStatus player={mockPlayer} index={0} />);
    expect(screen.getByText('🧨')).toBeInTheDocument();
    expect(screen.getByText('👻')).toBeInTheDocument();
  });
});

export {};
