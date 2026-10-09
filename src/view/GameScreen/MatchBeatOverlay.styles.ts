import styled from '@emotion/styled';

// Static plates only: a CSS pop animation on "GO!" re-ran style recalc on
// every frame of the beat in the production A/B (about 30 extra recalcs per
// round start), so every plate here just appears and goes.
export const BeatLayer = styled.div({
  position: 'absolute',
  left: 16,
  right: 16,
  zIndex: 14,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  pointerEvents: 'none',
});

export const CountdownPlate = styled.strong({
  minWidth: 76,
  minHeight: 76,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 14px',
  borderRadius: 2,
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-vermilion)',
  border: '3px solid var(--anime-ink)',
  boxShadow: '6px 6px 0 var(--anime-mustard)',
  textShadow: '3px 3px 0 var(--anime-ink)',
  fontSize: '3.2rem',
  fontWeight: 900,
  lineHeight: 1,
  '@media (max-height: 560px) and (min-width: 641px)': {
    minWidth: 56,
    minHeight: 56,
    fontSize: '2.4rem',
  },
});

export const GoPlate = styled(CountdownPlate)({
  color: 'var(--anime-ink)',
  background: 'var(--anime-mustard)',
  boxShadow: '6px 6px 0 var(--anime-teal)',
  textShadow: 'none',
});

// One line, set once per round: "Round 2 · P1 Gaara leads 1–0".
export const BeatLine = styled.span({
  maxWidth: '100%',
  padding: '5px 12px',
  borderRadius: 2,
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-ink)',
  border: '2px solid var(--anime-mustard)',
  fontSize: '0.95rem',
  fontWeight: 900,
  lineHeight: 1.25,
  textAlign: 'center',
});

// Held over the deciding moment for RESULT_HOLD_MS before the result opens.
export const RoundOverPlate = styled('strong', {
  shouldForwardProp: (prop) => prop !== 'accent',
})<{ accent: string }>(({ accent }) => ({
  maxWidth: '100%',
  padding: '10px 22px 11px',
  borderRadius: 2,
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper-light)',
  border: '3px solid var(--anime-ink)',
  borderTop: `8px solid ${accent}`,
  boxShadow: '6px 6px 0 var(--anime-ink)',
  fontSize: '1.35rem',
  fontWeight: 900,
  lineHeight: 1.2,
  textAlign: 'center',
}));
