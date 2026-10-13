import styled from '@emotion/styled';
import { Box, Typography } from '@mui/material';
// The Hidden Leaf tile of the stage atlas, cut to 512x512 (72 KB instead of the
// 552 KB atlas). index.html preloads the same file and paints it before React.
import HeroLeaf from '../../assets/ninja-bomber-hero-leaf.webp';

const chipCut = 'none';

// Manga speed lines bursting from behind the village (static, no motion).
const HERO_SPEED_LINES = 'repeating-conic-gradient(from 0deg at 74% 42%, '
  + 'rgba(255,248,231,0) 0deg 2.4deg, rgba(255,248,231,0.12) 2.4deg 3.1deg, '
  + 'rgba(255,248,231,0) 3.1deg 5.3deg, rgba(255,214,150,0.08) 5.3deg 5.8deg)';

// The house backdrop (also behind the Mission Deck and the village hubs):
// ink night, a slow orange dusk at the bottom and speed lines from the middle.
export const WelcomeContainer = styled(Box)({
  position: 'relative',
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  // Clear of notches and the home indicator (viewport-fit=cover).
  padding: 'max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) '
    + 'max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left))',
  color: '#fff8e7',
  backgroundColor: 'var(--anime-night)',
  backgroundImage: 'radial-gradient(ellipse at 50% 120%, rgba(245,130,31,0.38), rgba(245,130,31,0) 62%), '
    + 'radial-gradient(ellipse at 50% -20%, rgba(164,64,10,0.3), rgba(164,64,10,0) 55%)',
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
    inset: 10,
    pointerEvents: 'none',
    border: '1px solid rgba(245,130,31,0.45)',
    boxShadow: 'inset 0 0 0 3px rgba(18,13,11,0.9), inset 0 0 0 4px rgba(255,248,231,0.12)',
  },
  '& .MuiButton-root': {
    minHeight: 46,
    borderRadius: 'var(--radius)',
    clipPath: chipCut,
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    fontSize: '1.05rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
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
  '& .MuiButton-contained.Mui-disabled': {
    color: 'rgba(23,18,15,0.7)',
    background: '#c9a27a',
  },
  // Ink plates with paper type; the keyline turns orange on hover.
  '& .MuiButton-outlined': {
    color: '#fff8e7',
    borderColor: 'rgba(255,248,231,0.72)',
    background: 'rgba(18,13,11,0.74)',
    boxShadow: '3px 3px 0 rgba(0,0,0,0.6)',
  },
  '& .MuiButton-outlined:hover': {
    borderColor: 'var(--anime-orange)',
    background: 'rgba(60,28,8,0.86)',
  },
  // The deep chakra ring would sit under 3:1 on this dark scene, so the ring
  // here is the bright chakra blue (7:1 on night), with the aura.
  '& .MuiButtonBase-root.Mui-focusVisible': {
    outline: '3px solid var(--chakra)',
    outlineOffset: 4,
  },
  '@media (max-width: 640px)': {
    justifyContent: 'flex-start',
    padding: 10,
  },
});

export const HeroSection = styled(Box)({
  position: 'relative',
  zIndex: 1,
  width: 'min(1120px, calc(100vw - 40px))',
  minHeight: 'min(760px, calc(100dvh - 40px))',
  overflow: 'hidden',
  borderRadius: 4,
  border: '3px solid var(--anime-ink)',
  boxShadow: '0 0 0 2px rgba(245,130,31,0.85), 10px 10px 0 2px rgba(0,0,0,0.55)',
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
  '@media (max-width: 720px) and (min-width: 561px)': {
    '& h1': {
      fontSize: '3.4rem',
      lineHeight: 0.94,
    },
  },
  // Speed lines over the village, then ink behind the copy column so small
  // text holds contrast on bright tiles, and a warm dusk at the edge.
  '&::after': {
    content: "''",
    position: 'absolute',
    inset: 0,
    background: `${HERO_SPEED_LINES}, `
      + 'linear-gradient(90deg, rgba(14,9,7,0.86) 0%, rgba(20,11,6,0.62) 46%, rgba(60,24,6,0.26) 100%)',
  },
  '@media (max-width: 720px)': {
    '&::after': {
      background: `${HERO_SPEED_LINES}, `
        + 'linear-gradient(180deg, rgba(14,9,7,0.3) 0%, rgba(14,9,7,0.7) 45%, rgba(14,9,7,0.9) 100%)',
    },
  },
  ':root[data-contrast="more"] &::after': {
    background: 'linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.72) 50%, rgba(0,0,0,0.4) 100%)',
  },
});

// The big brush kanji behind the title: 忍, "shinobi". Decoration only.
export const HeroKanji = styled('span')({
  position: 'absolute',
  zIndex: -1,
  right: 'clamp(8px, 4vw, 56px)',
  bottom: 'clamp(4px, 2vh, 24px)',
  color: 'rgba(245,130,31,0.3)',
  fontFamily: 'var(--font-brush)',
  fontSize: 'clamp(9rem, 34vh, 17rem)',
  lineHeight: 1,
  textShadow: '6px 6px 0 rgba(0,0,0,0.35)',
  pointerEvents: 'none',
  userSelect: 'none',
  '@media (max-width: 560px)': {
    bottom: 'auto',
    top: 8,
    right: 4,
    fontSize: '8.5rem',
    color: 'rgba(245,130,31,0.26)',
  },
});

// The Hidden Leaf mark, large and faint at the right of the scene.
export const HeroMark = styled('span')({
  position: 'absolute',
  right: 'clamp(16px, 5vw, 64px)',
  top: 'clamp(16px, 7vh, 64px)',
  width: 'clamp(110px, 22vw, 230px)',
  height: 'clamp(110px, 22vw, 230px)',
  opacity: 0.5,
  pointerEvents: 'none',
  filter: 'drop-shadow(4px 4px 0 rgba(0,0,0,0.55))',
  '& svg': { width: '100%', height: '100%' },
  // Phones: the kanji behind the title is enough.
  '@media (max-width: 560px)': {
    display: 'none',
  },
});

export const HeroCopy = styled(Box)({
  position: 'relative',
  minHeight: 'min(760px, calc(100dvh - 40px))',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  alignItems: 'flex-start',
  padding: 'clamp(28px, 7vh, 72px)',
  color: '#fff8e7',
  isolation: 'isolate',
  // The title card: comic display type in ninja orange, a thin ink line in
  // the letters, a thick ink outline around them and a hard ink drop.
  '& h1': {
    margin: 0,
    maxWidth: 600,
    color: 'var(--anime-orange)',
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    fontSize: '5.4rem',
    lineHeight: 0.86,
    letterSpacing: '0.035em',
    textTransform: 'uppercase',
    WebkitTextStroke: '1.5px var(--anime-ink)',
    textShadow: '3px 0 0 #17120f, -3px 0 0 #17120f, 0 3px 0 #17120f, 0 -3px 0 #17120f, '
      + '2px 2px 0 #17120f, -2px -2px 0 #17120f, 2px -2px 0 #17120f, -2px 2px 0 #17120f, '
      + '7px 7px 0 #17120f, 0 0 26px rgba(245,130,31,0.45)',
    overflowWrap: 'anywhere',
  },
  // A brush stroke under the title.
  '& h1::after': {
    content: "''",
    display: 'block',
    width: 'min(420px, 82%)',
    height: 14,
    marginTop: 14,
    background: 'var(--anime-orange)',
    WebkitMaskImage: 'var(--brush-swash)',
    maskImage: 'var(--brush-swash)',
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
  },
  '@media (max-width: 560px)': {
    minHeight: 'calc(100dvh - 40px)',
    padding: '28px 22px',
    '& h1': {
      fontSize: '3.25rem',
      lineHeight: 0.9,
    },
  },
  '@media (max-height: 600px)': {
    padding: 20,
    '& h1': {
      fontSize: '3rem',
      lineHeight: 0.9,
    },
  },
});

export const HeroSubtitle = styled(Typography)({
  maxWidth: 520,
  marginTop: 14,
  color: 'rgba(255,248,231,0.92)',
  fontWeight: 800,
  lineHeight: 1.36,
  textShadow: '2px 2px 0 rgba(0,0,0,0.6)',
});

// A slanted ink ribbon with an orange edge.
export const HeroMeta = styled(Box)({
  marginTop: 10,
  padding: '3px 14px 3px 10px',
  color: '#fff8e7',
  background: 'rgba(18,13,11,0.86)',
  borderLeft: '5px solid var(--anime-orange)',
  fontFamily: 'var(--font-display)',
  fontSize: '0.95rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

export const CharacterGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: 8,
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
  gap: 12,
  marginTop: 14,
});

export const QuickPlayPanel = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  marginTop: 22,
  '@media (max-width: 560px)': {
    alignSelf: 'stretch',
  },
});

/** Quick Play and Battle a CPU: the two big doors, side by side. */
export const QuickPlayDoors = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  '& .MuiButton-root': {
    minWidth: 220,
    minHeight: 56,
    fontSize: '1.45rem',
    letterSpacing: '0.07em',
  },
  '& .MuiButton-outlined': {
    borderWidth: 2,
    borderColor: 'var(--anime-paper-light)',
  },
  '@media (max-width: 560px)': {
    alignSelf: 'stretch',
    flexDirection: 'column',
    gap: 8,
    '& .MuiButton-root': {
      width: '100%',
    },
  },
});

export const QuickPlaySummary = styled(Box)({
  marginTop: 10,
  color: '#fff8e7',
  fontSize: '0.86rem',
  fontWeight: 800,
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
