import React, { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { Button } from '@mui/material';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import { DOJO_NAME } from '../../content/dojo';
import { markDojoSuggested, shouldSuggestDojo } from '../../story/dojoProgress';

const SuggestionCard = styled('aside')({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '8px 12px',
  maxWidth: 560,
  marginTop: 16,
  padding: '10px 12px',
  color: 'var(--anime-ink)',
  background: 'rgba(255, 248, 231, 0.94)',
  border: '2px solid var(--anime-ink)',
  borderLeft: '8px solid var(--anime-mustard)',
  boxShadow: 'var(--shadow-1)',
  '& p': {
    flex: '1 1 260px',
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 700,
  },
  '& > div': {
    display: 'flex',
    gap: 8,
  },
  '& .MuiButton-root': {
    padding: '6px 12px',
    whiteSpace: 'nowrap',
  },
  // On paper the quiet choice is ink, not the vermilion kept for danger.
  '& .MuiButton-text': {
    color: 'var(--anime-ink)',
    borderColor: 'transparent',
  },
  '@media (max-width: 560px)': {
    alignSelf: 'stretch',
  },
});

/**
 * The title screen's one-time nudge toward the Training Dojo. It shows on a
 * first visit only (it counts as seen once shown) and sits below the doors:
 * it takes no focus and covers nothing, so Quick Play stays one press away.
 */
export function DojoSuggestion({ onOpen }: { onOpen: () => void }) {
  const [visible, setVisible] = useState(shouldSuggestDojo);
  // Shown once: the next visit to the title screen starts without it.
  const [shown] = useState(visible);
  useEffect(() => {
    if (shown) markDojoSuggested();
  }, [shown]);

  if (!visible) return null;
  return (
    <SuggestionCard aria-label="Training Dojo suggestion">
      <p>
        <strong>New here? </strong>
        {`The ${DOJO_NAME} teaches the basics in four half-minute rooms.`}
      </p>
      <div>
        <Button
          variant="contained"
          size="small"
          startIcon={<SchoolOutlinedIcon />}
          onClick={onOpen}
        >
          Train in the Dojo
        </Button>
        <Button variant="text" size="small" onClick={() => setVisible(false)}>
          Not now
        </Button>
      </div>
    </SuggestionCard>
  );
}
