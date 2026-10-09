import styled from '@emotion/styled';

// The touch controls draw no full-screen layer: the overlay box itself takes
// no input, only the pad zone and the buttons do. Nothing animates; a press
// changes one attribute (scale and fill), and dragging moves the ring and
// knob by transform only, so neither restyles or lays out the page.

// Above the HUD (10), captions (15) and the controls guide (16); below the
// top controls (20), so Pause is never covered, and the pause menu (21).
export const TouchLayer = styled.div({
  position: 'absolute',
  top: 'env(safe-area-inset-top, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
  zIndex: 18,
  pointerEvents: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  WebkitTapHighlightColor: 'transparent',
  // Under a menu the controls stay drawn (so Settings previews them) but
  // take no presses.
  '&[data-disabled] *': {
    pointerEvents: 'none !important' as 'none',
  },
});

export const PadZone = styled.div({
  position: 'absolute',
  pointerEvents: 'auto',
  touchAction: 'none',
});

export const PadRing = styled.div({
  position: 'absolute',
  left: 0,
  top: 0,
  boxSizing: 'border-box',
  borderRadius: '50%',
  border: '3px solid var(--anime-ink)',
  background: 'rgba(255, 248, 231, 0.24)',
  boxShadow: '0 0 0 2px rgba(255, 248, 231, 0.6)',
  opacity: 'var(--touch-rest, 0.6)',
  pointerEvents: 'none',
  willChange: 'transform',
  '&[data-active]': {
    opacity: 1,
    background: 'rgba(255, 248, 231, 0.36)',
  },
  // One chevron per direction; the held one fills in (shape, not just colour).
  '& > i': {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    opacity: 0.45,
  },
  '& > i[data-dir="up"]': {
    left: 'calc(50% - 9px)', top: 6, borderWidth: '0 9px 12px', borderBottomColor: 'var(--anime-ink)',
  },
  '& > i[data-dir="down"]': {
    left: 'calc(50% - 9px)', bottom: 6, borderWidth: '12px 9px 0', borderTopColor: 'var(--anime-ink)',
  },
  '& > i[data-dir="left"]': {
    top: 'calc(50% - 9px)', left: 6, borderWidth: '9px 12px 9px 0', borderRightColor: 'var(--anime-ink)',
  },
  '& > i[data-dir="right"]': {
    top: 'calc(50% - 9px)', right: 6, borderWidth: '9px 0 9px 12px', borderLeftColor: 'var(--anime-ink)',
  },
  '&[data-held="up"] > i[data-dir="up"], &[data-held="down"] > i[data-dir="down"], &[data-held="left"] > i[data-dir="left"], &[data-held="right"] > i[data-dir="right"]': {
    opacity: 1,
    transform: 'scale(1.35)',
  },
});

export const PadKnob = styled.div({
  position: 'absolute',
  left: '50%',
  top: '50%',
  boxSizing: 'border-box',
  borderRadius: '50%',
  border: '3px solid var(--anime-ink)',
  background: 'var(--anime-paper-light)',
  boxShadow: '2px 2px 0 var(--anime-ink)',
  willChange: 'transform',
});

export const ActionButton = styled.div({
  position: 'absolute',
  boxSizing: 'border-box',
  display: 'grid',
  placeItems: 'center',
  alignContent: 'center',
  gap: 1,
  borderRadius: '50%',
  border: '3px solid var(--anime-ink)',
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper-light)',
  boxShadow: '3px 3px 0 var(--anime-ink)',
  opacity: 'var(--touch-rest, 0.6)',
  pointerEvents: 'auto',
  touchAction: 'none',
  '& svg': {
    width: '44%',
    height: '44%',
    fill: 'currentColor',
  },
  '& span': {
    fontSize: '0.75rem',
    fontWeight: 900,
    lineHeight: 1,
    textTransform: 'uppercase',
  },
  // Seen around the thumb: the button sinks, its offset shadow goes and the
  // fill turns mustard.
  '&[data-pressed]': {
    opacity: 1,
    transform: 'scale(0.92)',
    color: 'var(--anime-ink)',
    background: 'var(--anime-mustard)',
    boxShadow: '0 0 0 3px var(--anime-paper-light)',
  },
  '&[data-out]': {
    opacity: 'calc(var(--touch-rest, 0.6) * 0.5)',
  },
});

export const BombButton = styled(ActionButton)({
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-ink)',
  '& span': { fontSize: '0.8rem' },
});

// The ring fills clockwise with the charge (HUD ultimate meter); full, it
// turns solid and the star fills.
export const UltimateButton = styled(ActionButton)({
  background: 'conic-gradient(var(--anime-teal) calc(var(--charge, 0) * 1%), var(--anime-paper-light) 0)',
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 6,
    zIndex: 0,
    borderRadius: '50%',
    background: 'var(--anime-paper-light)',
    border: '2px solid var(--anime-ink)',
  },
  '& > *': { position: 'relative', zIndex: 1 },
  '&[data-ready]::before': {
    background: 'var(--anime-teal)',
  },
  '&[data-ready]': {
    color: 'var(--anime-paper-light)',
  },
});

export const TouchGuideList = styled.ul({
  display: 'grid',
  gap: 6,
  margin: 0,
  padding: 0,
  listStyle: 'none',
  color: 'var(--anime-ink)',
  fontSize: '0.86rem',
  lineHeight: 1.35,
  '& strong': {
    fontWeight: 900,
  },
});
