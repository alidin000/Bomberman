import styled from '@emotion/styled';
import { Paper, Typography } from '@mui/material';
import { Theme } from '@mui/material/styles';
import { space } from '../../../theme/tokens';

// One panel per player, stacked down the left edge (each about 250 px tall).
export const PlayerStatusContainer = styled(Paper)(
  ({ theme, index }: { theme: Theme, index: number }) => ({
    top: `calc(${theme.spacing(2)} + ${index * 250}px)`,
    left: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    border: '2px solid var(--anime-ink)',
    // A hard ink offset, like the HUD's plates, not a soft elevation.
    boxShadow: 'var(--shadow-2)',
  })
);

export const PlayerName = styled(Typography)({
  marginBottom: space[75],
});

export const PowerUpsList = styled('ul')({
  listStyleType: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexWrap: 'wrap',
});

export const PowerUpItem = styled('li')({
  marginRight: space[75],
  marginBottom: space[75],
});

export const ObstaclesCount = styled(Typography)({
  marginTop: space[200],
});
