import styled from '@emotion/styled';
import { space, textStyles } from '../../theme/tokens';
import { HeroMeta, TITLE_CARD_LETTERS, TITLE_CARD_STROKE } from '../WelcomeScreen/WelcomeScreen.styles';

const PHONE = '@media (max-width: 560px)';

// A title card on the house backdrop: an ink plate with the hero's orange
// ring and hard drop, lettered like the title screen.
export const NotFoundCard = styled('section')({
  position: 'relative',
  zIndex: 1,
  isolation: 'isolate',
  overflow: 'hidden',
  width: 'min(560px, 100%)',
  // Centred on every screen size (the backdrop tops its content on phones).
  margin: 'auto 0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  padding: space[600],
  color: 'var(--anime-paper-light)',
  background: 'rgba(18,13,11,0.92)',
  border: '3px solid var(--anime-ink)',
  borderRadius: 'var(--radius-base)',
  boxShadow: '0 0 0 2px rgba(245,130,31,0.85), 10px 10px 0 2px rgba(0,0,0,0.55)',
  '& h1': {
    ...textStyles.heading2,
    ...TITLE_CARD_LETTERS,
    margin: 0,
  },
  '& h1::after': TITLE_CARD_STROKE,
  '& .MuiButton-root': {
    ...textStyles.buttonLg,
    minWidth: 220,
    minHeight: 56,
    marginTop: space[300],
  },
  [PHONE]: {
    padding: space[300],
    '& h1': {
      fontSize: 'var(--text-4xl)',
      lineHeight: 'var(--leading-4xl)',
    },
    '& .MuiButton-root': {
      width: '100%',
    },
  },
});

// The title screen's ribbon, here as the eyebrow over the heading.
export const NotFoundEyebrow = styled(HeroMeta)({
  margin: `0 0 ${space[200]}px`,
  // A lighter plate than the card's own ink.
  background: 'rgba(255,248,231,0.08)',
});

export const NotFoundLine = styled('p')({
  ...textStyles.body2,
  maxWidth: 440,
  margin: `${space[200]}px 0 0`,
  color: 'var(--anime-paper-muted)',
});

// The missing path, as typed: monospace, and free to wrap anywhere.
export const NotFoundPath = styled('code')({
  padding: `0 ${space[50]}px`,
  color: 'var(--anime-paper-light)',
  background: 'rgba(255,248,231,0.1)',
  borderRadius: 'var(--radius-sm)',
  overflowWrap: 'anywhere',
});

// 道, "the path": a faint brush watermark in the corner. Decoration only.
export const NotFoundKanji = styled('span')({
  position: 'absolute',
  zIndex: -1,
  right: space[300],
  bottom: space[75],
  color: 'rgba(245,130,31,0.18)',
  fontFamily: 'var(--font-brush)',
  fontWeight: 400,
  fontSize: 'var(--text-9xl)',
  lineHeight: 1,
  pointerEvents: 'none',
  userSelect: 'none',
  [PHONE]: {
    bottom: 'auto',
    top: space[75],
    right: space[75],
  },
});
