import styled from '@emotion/styled';
import { Box } from '@mui/material';
import { space, textStyles } from '../../theme/tokens';
// The Hidden Leaf tile of the stage atlas, cut to 512x512 (72 KB instead of the
// 552 KB atlas). index.html preloads the same file and paints it before React.
import HeroLeaf from '../../assets/ninja-bomber-hero-leaf.webp';

// Manga speed lines bursting from behind the village (static, no motion).
const HERO_SPEED_LINES = 'repeating-conic-gradient(from 0deg at 74% 42%, '
  + 'rgba(255,248,231,0) 0deg 2.4deg, rgba(255,248,231,0.12) 2.4deg 3.1deg, '
  + 'rgba(255,248,231,0) 3.1deg 5.3deg, rgba(255,214,150,0.08) 5.3deg 5.8deg)';

const PHONE = '@media (max-width: 560px)';
const NARROW = '@media (max-width: 720px)';
const SHORT = '@media (max-height: 600px)';

/** A spacing step on every side, kept clear of notches and the home indicator. */
const safePadding = (px: number) => `max(${px}px, env(safe-area-inset-top)) `
  + `max(${px}px, env(safe-area-inset-right)) max(${px}px, env(safe-area-inset-bottom)) `
  + `max(${px}px, env(safe-area-inset-left))`;

// The house backdrop (also behind the Mission Deck and the village hubs):
// flat ink night, speed lines from the middle and a title-card frame.
export const WelcomeContainer = styled(Box)({
  position: 'relative',
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  // Clear of notches and the home indicator (viewport-fit=cover).
  padding: safePadding(space[200]),
  color: 'var(--anime-paper-light)',
  backgroundColor: 'var(--anime-night)',
  '&::before': {
    content: "''",
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    backgroundImage: 'var(--speed-lines)',
    WebkitMaskImage: 'var(--speed-lines-mask)',
    maskImage: 'var(--speed-lines-mask)',
  },
  // A thin ink-and-orange frame, like a title card.
  '&::after': {
    content: "''",
    position: 'absolute',
    inset: space[75],
    pointerEvents: 'none',
    border: '1px solid rgba(245,130,31,0.45)',
    boxShadow: 'inset 0 0 0 3px rgba(18,13,11,0.9), inset 0 0 0 4px rgba(255,248,231,0.12)',
  },
  '& .MuiButton-root': {
    ...textStyles.buttonMd,
    minHeight: 46,
    borderRadius: 'var(--radius)',
  },
  // The one primary call-to-action look: ninja orange with ink text, an
  // ink keyline and a hard ink offset. A paper rim holds its edge on the
  // dark scene.
  '& .MuiButton-contained, & .MuiButton-contained.Mui-focusVisible': {
    color: 'var(--on-action)',
    background: 'var(--action)',
    border: '2px solid var(--anime-ink)',
    boxShadow: '0 0 0 2px var(--anime-paper-light), 5px 5px 0 2px var(--anime-ink)',
  },
  '& .MuiButton-contained:hover': {
    background: 'var(--action-deep)',
  },
  // Disabled while a match launches: flat, with no offset to press.
  '& .MuiButton-contained.Mui-disabled': {
    color: 'rgba(23,18,15,0.7)',
    background: '#c9a27a',
    boxShadow: 'none',
  },
  // Ink plates with paper type; the keyline turns orange on hover.
  '& .MuiButton-outlined': {
    color: 'var(--anime-paper-light)',
    borderColor: 'rgba(255,248,231,0.72)',
    background: 'rgba(18,13,11,0.74)',
    boxShadow: '3px 3px 0 rgba(0,0,0,0.6)',
  },
  '& .MuiButton-outlined:hover': {
    borderColor: 'var(--anime-orange)',
    background: 'rgba(60,28,8,0.86)',
  },
  '& .MuiButton-outlined.Mui-disabled': {
    color: 'rgba(255,248,231,0.5)',
    borderColor: 'rgba(255,248,231,0.3)',
    boxShadow: 'none',
  },
  // The deep chakra ring would sit under 3:1 on this dark scene, so the ring
  // here is the bright chakra blue (7:1 on night), with the aura.
  '& .MuiButtonBase-root.Mui-focusVisible': {
    outline: '3px solid var(--chakra)',
    outlineOffset: 4,
  },
  '@media (max-width: 640px)': {
    justifyContent: 'flex-start',
  },
});

export const HeroSection = styled(Box)({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  width: 'min(1120px, 100%)',
  minHeight: `min(760px, calc(100dvh - ${space[400]}px))`,
  overflow: 'hidden',
  borderRadius: 'var(--radius-base)',
  border: '3px solid var(--anime-ink)',
  boxShadow: '0 0 0 2px rgba(245,130,31,0.85), 10px 10px 0 2px rgba(0,0,0,0.55)',
  // Phones: the title card fills the screen.
  [PHONE]: {
    minHeight: `calc(100dvh - ${space[400]}px)`,
  },
});

export const HeroScene = styled(Box)({
  position: 'absolute',
  inset: 0,
  backgroundColor: '#bd6a70',
  backgroundImage: `url(${HeroLeaf})`,
  // Same framing as the old 300%-wide atlas crop: the tile fills the width on
  // landscape screens and the height on portrait ones.
  backgroundSize: 'cover',
  backgroundPosition: '0% 0%',
  backgroundRepeat: 'no-repeat',
  filter: 'saturate(0.9) contrast(1.02) brightness(0.86)',
  transform: 'scale(1.015)',
  // Speed lines over the village, then one flat ink scrim so small text
  // holds 4.5:1 on the brightest tiles. Phones stack the copy over the
  // whole scene, so their scrim is darker.
  '&::after': {
    content: "''",
    position: 'absolute',
    inset: 0,
    background: `${HERO_SPEED_LINES}, rgba(14,9,7,0.62)`,
  },
  [NARROW]: {
    '&::after': {
      background: `${HERO_SPEED_LINES}, rgba(14,9,7,0.72)`,
    },
  },
  ':root[data-contrast="more"] &::after': {
    background: 'rgba(0,0,0,0.84)',
  },
});

// The big brush kanji behind the title: 忍, "shinobi". Decoration only: the
// glyph is set at the top step of the type scale and drawn larger by a
// transform from its bottom-right corner.
export const HeroKanji = styled('span')({
  position: 'absolute',
  zIndex: -1,
  right: space[600],
  bottom: space[300],
  color: 'rgba(245,130,31,0.3)',
  fontFamily: 'var(--font-brush)',
  fontWeight: 400,
  fontSize: 'var(--text-9xl)',
  lineHeight: 1,
  transform: 'scale(2)',
  transformOrigin: '100% 100%',
  textShadow: '3px 3px 0 rgba(0,0,0,0.35)',
  pointerEvents: 'none',
  userSelect: 'none',
  [NARROW]: {
    right: space[300],
  },
  [SHORT]: {
    transform: 'scale(1.5)',
  },
  [PHONE]: {
    bottom: 'auto',
    top: space[75],
    right: space[50],
    transform: 'none',
    color: 'rgba(245,130,31,0.26)',
  },
});

// The Hidden Leaf mark, large and faint at the right of the scene.
export const HeroMark = styled('span')({
  position: 'absolute',
  right: space[700],
  top: space[600],
  width: 'clamp(110px, 22vw, 230px)',
  height: 'clamp(110px, 22vw, 230px)',
  opacity: 0.5,
  pointerEvents: 'none',
  filter: 'drop-shadow(4px 4px 0 rgba(0,0,0,0.55))',
  '& svg': { width: '100%', height: '100%' },
  '@media (max-width: 900px)': {
    right: space[400],
    top: space[400],
  },
  // Phones: the kanji behind the title is enough.
  [PHONE]: {
    display: 'none',
  },
});

/**
 * The title card's lettering: comic display type in ninja orange, a thin ink
 * line in the letters, a thick ink outline around them and a hard ink drop.
 * Spread it with a Heading style; the 404 screen shares it.
 */
export const TITLE_CARD_LETTERS = {
  color: 'var(--anime-orange)',
  letterSpacing: '0.035em',
  textTransform: 'uppercase',
  WebkitTextStroke: '1.5px var(--anime-ink)',
  textShadow: '3px 0 0 #17120f, -3px 0 0 #17120f, 0 3px 0 #17120f, 0 -3px 0 #17120f, '
    + '2px 2px 0 #17120f, -2px -2px 0 #17120f, 2px -2px 0 #17120f, -2px 2px 0 #17120f, '
    + '6px 6px 0 #17120f',
  overflowWrap: 'anywhere',
} as const;

/** A brush stroke under a title card heading (its ::after). */
export const TITLE_CARD_STROKE = {
  content: "''",
  display: 'block',
  width: 'min(420px, 82%)',
  height: 14,
  marginTop: space[200],
  background: 'var(--anime-orange)',
  WebkitMaskImage: 'var(--brush-swash)',
  maskImage: 'var(--brush-swash)',
  WebkitMaskSize: '100% 100%',
  maskSize: '100% 100%',
} as const;

export const HeroCopy = styled(Box)({
  position: 'relative',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  alignItems: 'flex-start',
  padding: space[700],
  color: 'var(--anime-paper-light)',
  isolation: 'isolate',
  // Heading 1 here, Heading 2 on phones and Heading 3 on short screens.
  '& h1': {
    ...textStyles.heading1,
    ...TITLE_CARD_LETTERS,
    margin: 0,
    // Narrow enough to break after "Explosive", where the name breaks.
    maxWidth: 480,
  },
  '& h1::after': TITLE_CARD_STROKE,
  '@media (max-height: 760px)': {
    padding: space[600],
  },
  [PHONE]: {
    padding: space[300],
    '& h1': {
      fontSize: 'var(--text-5xl)',
      lineHeight: 1,
    },
  },
  [SHORT]: {
    padding: space[200],
    '& h1': {
      fontSize: 'var(--text-4xl)',
      lineHeight: 'var(--leading-4xl)',
    },
  },
});

// The line under the title: set in Heading 6, but a paragraph, so the
// screen's headings skip no level.
export const HeroSubtitle = styled('p')({
  ...textStyles.heading6,
  maxWidth: 520,
  margin: `${space[200]}px 0 0`,
  textWrap: 'balance',
  color: 'rgba(255,248,231,0.92)',
  textShadow: '2px 2px 0 rgba(0,0,0,0.6)',
});

// An ink ribbon led by a small orange diamond.
export const HeroMeta = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: space[75],
  marginTop: space[100],
  padding: `${space[50]}px ${space[100]}px`,
  color: 'var(--anime-paper-light)',
  background: 'rgba(18,13,11,0.86)',
  fontFamily: 'var(--font-display)',
  fontWeight: 400,
  fontSize: 'var(--text-sm)',
  lineHeight: 'var(--leading-sm)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  '&::before': {
    content: "''",
    flex: '0 0 auto',
    width: 8,
    height: 8,
    background: 'var(--anime-orange)',
    transform: 'rotate(45deg)',
  },
  // One line on a phone: the display face's own tracking.
  [PHONE]: {
    letterSpacing: '0.04em',
  },
});

export const CharacterGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: space[75],
  '@media (max-width: 1180px)': {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  },
  '@media (max-width: 520px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
});

export const ActionButtons = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[100],
  marginTop: space[200],
});

export const QuickPlayPanel = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  marginTop: space[300],
  [PHONE]: {
    alignSelf: 'stretch',
  },
});

/** Quick Play and Battle a CPU: the two big doors, side by side. */
export const QuickPlayDoors = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[100],
  '& .MuiButton-root': {
    ...textStyles.buttonLg,
    minWidth: 220,
    minHeight: 56,
  },
  '& .MuiButton-outlined': {
    borderWidth: 2,
    borderColor: 'var(--anime-paper-light)',
  },
  [PHONE]: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    gap: space[75],
    '& .MuiButton-root': {
      width: '100%',
    },
  },
});

export const QuickPlaySummary = styled(Box)({
  ...textStyles.caption1,
  marginTop: space[75],
  color: 'var(--anime-paper-light)',
  textShadow: '1px 1px 0 rgba(0,0,0,0.7)',
});

/** Shared export used by the game screen background wrapper. */
export const StyledBackground = styled(Box)({
  minHeight: '100dvh',
  position: 'relative',
  backgroundColor: 'var(--anime-paper)',
  backgroundImage: 'radial-gradient(rgba(23,18,15,0.12) 0.7px, transparent 0.7px)',
  backgroundSize: '5px 5px',
});
