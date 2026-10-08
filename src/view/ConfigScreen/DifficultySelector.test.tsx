import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DifficultySelector } from './DifficultySelector';
import { CAMPAIGN_DIFFICULTY_KEY, loadCampaignDifficulty } from './campaignDifficulty';

describe('DifficultySelector', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts on Normal and remembers the chosen campaign difficulty', () => {
    render(<DifficultySelector />);
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Story' }));

    expect(screen.getByRole('button', { name: 'Story' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem(CAMPAIGN_DIFFICULTY_KEY)).toBe('story');
    expect(loadCampaignDifficulty()).toBe('story');
    expect(screen.getByText(/5 lives/)).toBeInTheDocument();
  });

  it('falls back to Normal for a corrupted stored value', () => {
    localStorage.setItem(CAMPAIGN_DIFFICULTY_KEY, 'nightmare');
    expect(loadCampaignDifficulty()).toBe('normal');
  });
});
