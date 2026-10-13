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
  color: 'var(--anime-orange)',
  background: 'var(--anime-ink)',
  border: '3px solid var(--anime-orange)',
  boxShadow: '6px 6px 0 var(--anime-ink)',
  // Comic digits: orange with an ink keyline, offset like a print.
  textShadow: '3px 3px 0 var(--accent)',
  fontFamily: 'var(--font-display)',
  fontSize: '3.6rem',
  fontWeight: 400,
  lineHeight: 1,
  '@media (max-height: 560px) and (min-width: 641px)': {
    minWidth: 56,
    minHeight: 56,
    fontSize: '2.4rem',
  },
});

export const GoPlate = styled(CountdownPlate)({
  color: 'var(--anime-ink)',
  background: 'var(--anime-orange)',
  borderColor: 'var(--anime-ink)',
  boxShadow: '6px 6px 0 var(--anime-ink)',
  textShadow: '2px 2px 0 var(--anime-paper-light)',
  letterSpacing: '0.06em',
});

// One line, set once per round: "Round 2 · P1 Gaara leads 1–0".
export const BeatLine = styled.span({
  maxWidth: '100%',
  padding: '5px 12px',
  borderRadius: 2,
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-ink)',
  border: '2px solid var(--anime-orange)',
  fontFamily: 'var(--font-display)',
  fontSize: '1.05rem',
  fontWeight: 400,
  letterSpacing: '0.06em',
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
  fontFamily: 'var(--font-display)',
  fontSize: '1.6rem',
  fontWeight: 400,
  letterSpacing: '0.05em',
  lineHeight: 1.15,
  textAlign: 'center',
}));

// A sealed boss's reward, under its name on the round-over plate.
export const RoundOverDetail = styled.span({
  display: 'block',
  marginTop: 4,
  fontSize: '0.95rem',
  fontWeight: 800,
  color: 'var(--anime-vermilion)',
});
