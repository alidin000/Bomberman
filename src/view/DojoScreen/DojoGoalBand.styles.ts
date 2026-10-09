import styled from '@emotion/styled';

// The goal line sits where the HUD already keeps players out (hudInsets in
// scene/cameraFraming), so it needs no band of its own:
// - row: the match strip's place, top centre, inside the top band;
// - phone: the one-line strip on the bottom edge;
// - short: one line at the bottom right beside the player card, like the
//   campaign line, inside the bottom band the cards hold.
// Positions are in HUD units: the root is zoomed like HudRoot.
const CONTROLS_CLEARANCE = '290px / var(--hud-zoom, 1)';
const PHONE = '@media (max-width: 640px)';
const SHORT = '@media (max-height: 560px) and (min-width: 641px)';
// Both small layouts show the goal as one line.
const ONE_LINE = '@media (max-width: 640px), (max-height: 560px)';

export const DojoBandRoot = styled('div', {
  shouldForwardProp: (prop) => prop !== 'hudZoom',
})<{ hudZoom: number }>(({ hudZoom }) => ({
  position: 'absolute',
  inset: 0,
  zIndex: 10,
  pointerEvents: 'none',
  zoom: hudZoom,
  '--hud-zoom': String(hudZoom),
  '& .visually-hidden': {
    position: 'absolute',
    width: 1,
    height: 1,
    margin: 0,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
  },
}));

export const DojoBand = styled('section')({
  position: 'absolute',
  top: 12,
  left: `max(12px, min(50% - 230px, 100% - 460px - ${CONTROLS_CLEARANCE}))`,
  width: `min(460px, 100% - 24px - ${CONTROLS_CLEARANCE})`,
  boxSizing: 'border-box',
  display: 'grid',
  gap: 5,
  padding: '6px 10px 8px',
  color: 'var(--anime-ink)',
  background: 'rgba(255, 248, 231, 0.96)',
  border: '2px solid var(--anime-ink)',
  borderLeft: '8px solid var(--anime-mustard)',
  boxShadow: '3px 3px 0 var(--anime-ink)',
  [PHONE]: {
    top: 'auto',
    bottom: 12,
    left: 12,
    right: 12,
    width: 'auto',
    minHeight: 40,
    padding: '5px 8px',
    gap: 0,
    alignContent: 'center',
  },
  [SHORT]: {
    top: 'auto',
    bottom: 12,
    left: 'auto',
    right: 12,
    width: 'min(380px, 100% - 260px)',
    minHeight: 40,
    padding: '5px 8px',
    gap: 0,
    alignContent: 'center',
  },
});

export const DojoBandHeader = styled('div')({
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  minWidth: 0,
  '& strong': {
    padding: '1px 6px',
    color: 'var(--anime-mustard)',
    background: 'var(--anime-ink)',
    fontSize: '0.75rem',
    fontWeight: 900,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  '& span': {
    overflow: 'hidden',
    color: 'var(--ink-3)',
    fontSize: '0.75rem',
    fontWeight: 900,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  [ONE_LINE]: { display: 'none' },
});

export const DojoGoalText = styled('p')({
  margin: 0,
  fontSize: '1rem',
  fontWeight: 900,
  lineHeight: 1.2,
  [ONE_LINE]: { display: 'none' },
});

// Phones: the short goal and its first control in one line.
export const DojoGoalLine = styled('p')({
  display: 'none',
  margin: 0,
  overflow: 'hidden',
  fontSize: '0.86rem',
  fontWeight: 900,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '& kbd': {
    marginLeft: 4,
  },
  [ONE_LINE]: { display: 'block' },
});

export const DojoControlRow = styled('ul')({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 12px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontSize: '0.75rem',
  fontWeight: 900,
  '& li': {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  [ONE_LINE]: { display: 'none' },
});

export const DojoKey = styled('kbd')({
  display: 'inline-block',
  minWidth: 18,
  padding: '1px 5px',
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-ink)',
  borderRadius: 2,
  fontFamily: 'inherit',
  fontSize: '0.75rem',
  fontWeight: 900,
  textAlign: 'center',
  whiteSpace: 'nowrap',
});
