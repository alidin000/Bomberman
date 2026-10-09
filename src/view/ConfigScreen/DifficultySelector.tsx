import React, { useState } from 'react';
import { ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { DIFFICULTIES, DIFFICULTY_IDS, DifficultyId } from '../../engine/difficulty';
import { loadCampaignDifficulty, saveCampaignDifficulty } from './campaignDifficulty';
import { SectionTitle } from './ConfigScreen.styles';

// Self-contained campaign difficulty picker: it owns its stored value, so
// the config flow only has to render it.
export const DifficultySelector = () => {
  const [difficulty, setDifficulty] = useState<DifficultyId>(loadCampaignDifficulty);
  const handleChange = (_event: React.MouseEvent<HTMLElement>, next: DifficultyId | null) => {
    if (!next) return;
    setDifficulty(next);
    saveCampaignDifficulty(next);
  };

  return (
    <div>
      <SectionTitle variant="subtitle2" component="h3" id="campaign-difficulty-label">Difficulty</SectionTitle>
      <ToggleButtonGroup
        value={difficulty}
        exclusive
        fullWidth
        size="small"
        onChange={handleChange}
        aria-labelledby="campaign-difficulty-label"
        data-roving-group
      >
        {DIFFICULTY_IDS.map((id) => (
          <ToggleButton key={id} value={id} aria-describedby="campaign-difficulty-detail">
            {DIFFICULTIES[id].label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography
        id="campaign-difficulty-detail"
        variant="caption"
        display="block"
        color="text.secondary"
        sx={{ mt: 0.5 }}
      >
        {DIFFICULTIES[difficulty].description}
      </Typography>
    </div>
  );
};
