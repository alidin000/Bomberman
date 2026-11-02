import React, { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { Button } from '@mui/material';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import { DOJO_NAME } from '../../content/dojo';
import { markDojoSuggested, shouldSuggestDojo } from '../../story/dojoProgress';
import { textStyles } from '../../theme/tokens';

// Framed all round in ink; the line is led by a brush 道 seal (decoration:
// its alt text is empty).
const SuggestionCard = styled('aside')({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '8px 12px',
  maxWidth: 560,
  marginTop: 16,
  padding: 12,
  color: 'var(--anime-ink)',
  background: 'rgba(255, 248, 231, 0.94)',
  border: '2px solid var(--anime-ink)',
  boxShadow: 'var(--shadow-1)',
  '& p': {
    ...textStyles.body5,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: '1 1 260px',
    margin: 0,
  },
  '& p::before': {
    content: '"道" / ""',
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 auto',
    width: 32,
    height: 32,
    color: 'var(--anime-mustard)',
    background: 'var(--anime-ink)',
    fontFamily: 'var(--font-brush)',
    fontSize: 'var(--text-xl)',
    lineHeight: 'var(--leading-xl)',
    fontWeight: 400,
  },
  '& p strong': {
    fontWeight: 600,
  },
  '& > div': {
    display: 'flex',
    gap: 8,
  },
  // Default size: the theme's 8 by 12 padding gives a 44 px touch target.
  '& .MuiButton-root': {
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
        <span>
          <strong>New here? </strong>
          {/* A no-break space keeps "30 second" on one line. */}
          {`The ${DOJO_NAME} teaches the basics in four 30\u00a0second rooms.`}
        </span>
      </p>
      <div>
        <Button
          variant="contained"
          startIcon={<SchoolOutlinedIcon />}
          onClick={onOpen}
        >
          Train in the Dojo
        </Button>
        <Button variant="text" onClick={() => setVisible(false)}>
          Not now
        </Button>
      </div>
    </SuggestionCard>
  );
}
