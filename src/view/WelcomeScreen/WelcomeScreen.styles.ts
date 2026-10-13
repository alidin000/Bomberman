import styled from '@emotion/styled';
import { Box, Paper, Typography } from '@mui/material';
// The Hidden Leaf tile of the stage atlas, cut to 512x512 (72 KB instead of the
// 552 KB atlas). index.html preloads the same file and paints it before React.
import HeroLeaf from '../../assets/ninja-bomber-hero-leaf.webp';

const angularPanel = 'none';
const bannerCut = 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)';
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

export const BoardFrame = styled(Box)({
  position: 'relative',
  padding: 8,
  clipPath: angularPanel,
  background: '#356f6b',
  border: '2px solid #211d1a',
  boxShadow: '6px 6px 0 #211d1a',
});

export const BoardTitleStrip = styled(Box)({
  position: 'absolute',
  top: -1,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 2,
  width: 'min(440px, 72%)',
  padding: '8px 20px',
  clipPath: bannerCut,
  color: '#fff8e7',
  background: '#bd3f32',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontWeight: 900,
  letterSpacing: 0,
  boxShadow: '3px 3px 0 #211d1a',
});

export const BoardSurface = styled(Box)({
  display: 'grid',
  gridTemplateColumns: '1.26fr 0.74fr',
  gap: 10,
  maxHeight: 650,
  overflowY: 'auto',
  padding: '34px 12px 12px',
  clipPath: angularPanel,
  border: '2px solid #211d1a',
  backgroundColor: '#fff8e7',
  backgroundImage: 'radial-gradient(rgba(33,29,26,0.09) 0.7px, transparent 0.7px)',
  backgroundSize: '7px 7px',
  boxShadow: 'none',
  scrollbarColor: '#bd3f32 #efe3c4',
  '@media (max-width: 980px)': {
    gridTemplateColumns: '1fr',
    maxHeight: 'none',
  },
});

export const BoardSection = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'wide',
})<{ wide?: boolean }>(({ wide }) => ({
  position: 'relative',
  gridColumn: wide ? '1 / -1' : 'auto',
  padding: 9,
  clipPath: angularPanel,
  background: '#efe3c4',
  border: '1px solid rgba(33,29,26,0.55)',
  '&::before': {
    content: "''",
    position: 'absolute',
    inset: '0 auto auto 0',
    width: 42,
    height: 4,
    background: '#356f6b',
  },
}));

export const BoardSectionTitle = styled(Box)({
  width: 'fit-content',
  margin: '0 auto 9px',
  padding: '5px 26px 6px',
  clipPath: bannerCut,
  color: '#fff8e7',
  background: '#356f6b',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontSize: '0.76rem',
  fontWeight: 900,
  letterSpacing: 0,
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

export const CharacterCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'accent',
})<{ accent: string }>(({ accent }) => ({
  minHeight: 208,
  padding: 7,
  border: '2px solid var(--anime-ink)',
  background: `color-mix(in srgb, ${accent} 12%, var(--anime-paper-light))`,
  boxShadow: '3px 3px 0 var(--anime-ink)',
  transition: 'transform 0.16s ease, filter 0.16s ease',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: '5px 5px 0 var(--anime-ink)',
  },
}));

export const CharacterArt = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'image' && prop !== 'imagePosition',
})<{ image: string; imagePosition: string }>(({ image, imagePosition }) => ({
  height: 96,
  marginBottom: 7,
  borderBottom: '2px solid var(--anime-ink)',
  backgroundImage: `url(${image})`,
  backgroundSize: '600% 280%',
  backgroundPosition: imagePosition,
  backgroundRepeat: 'no-repeat',
  filter: 'saturate(0.78) contrast(1.08)',
}));

export const CharacterName = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  color,
  textAlign: 'center',
  textTransform: 'uppercase',
  fontWeight: 900,
  lineHeight: 1.05,
  letterSpacing: 0,
  textShadow: 'none',
}));

export const AbilityStack = styled(Box)({
  display: 'grid',
  gap: 5,
  marginTop: 7,
});

export const AbilityTag = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  padding: '5px 7px',
  clipPath: chipCut,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 15%, var(--anime-paper-light))`,
  borderLeft: `4px solid ${color}`,
  fontSize: '0.67rem',
  fontWeight: 800,
  lineHeight: 1.12,
}));

export const CharacterNote = styled(Box)({
  marginTop: 7,
  color: 'rgba(33,29,26,0.7)',
  fontSize: '0.65rem',
  fontWeight: 700,
  lineHeight: 1.22,
});

export const BossGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 7,
});

export const BossCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  display: 'grid',
  gridTemplateColumns: '34px 1fr',
  gap: 8,
  alignItems: 'center',
  minHeight: 60,
  padding: 7,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 13%, var(--anime-paper-light))`,
  border: '2px solid var(--anime-ink)',
  '& strong': {
    display: 'block',
    color: 'var(--anime-ink)',
    textTransform: 'uppercase',
    fontSize: '0.76rem',
    letterSpacing: 0,
  },
}));

export const BossEmblem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  width: 34,
  height: 34,
  display: 'grid',
  placeItems: 'center',
  clipPath: 'polygon(50% 0, 96% 24%, 96% 76%, 50% 100%, 4% 76%, 4% 24%)',
  color: 'var(--anime-paper-light)',
  background: color,
  border: '2px solid var(--anime-ink)',
  fontWeight: 900,
}));

export const BossMeta = styled(Box)({
  color: 'rgba(33,29,26,0.68)',
  fontSize: '0.66rem',
  fontWeight: 700,
  lineHeight: 1.15,
});

export const StageGrid = styled(Box)({
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

export const StageCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  overflow: 'hidden',
  border: '2px solid var(--anime-ink)',
  background: 'var(--anime-paper-light)',
  boxShadow: `inset 0 -5px 0 ${color}`,
}));

export const StageArt = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'image' && prop !== 'imagePosition',
})<{ image: string; imagePosition: string }>(({ image, imagePosition }) => ({
  height: 70,
  backgroundImage: `url(${image})`,
  backgroundSize: '300% 200%',
  backgroundPosition: imagePosition,
  backgroundRepeat: 'no-repeat',
  filter: 'saturate(0.72) contrast(1.08)',
  borderBottom: '2px solid var(--anime-ink)',
}));

export const StageLabel = styled(Box)({
  padding: '6px 4px',
  color: 'var(--anime-ink)',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontSize: '0.68rem',
  fontWeight: 900,
  lineHeight: 1.1,
  letterSpacing: 0,
});

export const PowerGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 7,
});

export const PowerTile = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  minHeight: 42,
  display: 'flex',
  alignItems: 'center',
  padding: '8px 10px',
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 12%, var(--anime-paper-light))`,
  border: '2px solid var(--anime-ink)',
  borderLeft: `7px solid ${color}`,
  fontSize: '0.76rem',
  fontWeight: 900,
  lineHeight: 1.1,
}));

export const MonsterGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 7,
});

export const MonsterTile = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  display: 'grid',
  gridTemplateColumns: '38px 1fr',
  gap: 8,
  alignItems: 'center',
  minHeight: 56,
  padding: 7,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 12%, var(--anime-paper-light))`,
  border: '2px solid var(--anime-ink)',
  fontSize: '0.72rem',
  fontWeight: 900,
  lineHeight: 1.1,
}));

export const MonsterIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'beast' && prop !== 'color',
})<{ beast: string; color: string }>(({ beast, color }) => ({
  position: 'relative',
  width: 36,
  height: 34,
  clipPath: beast === 'flame'
    ? 'polygon(50% 0, 84% 26%, 100% 72%, 68% 100%, 30% 100%, 0 72%, 16% 28%)'
    : 'polygon(50% 0, 92% 24%, 92% 76%, 50% 100%, 8% 76%, 8% 24%)',
  background: color,
  border: '2px solid var(--anime-ink)',
  '&::before': {
    content: "''",
    position: 'absolute',
    left: beast === 'horn' ? -3 : 8,
    top: beast === 'horn' ? -2 : -3,
    width: beast === 'horn' ? 14 : 8,
    height: beast === 'horn' ? 14 : 18,
    clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
    background: beast === 'sand' ? '#d6a45d' : '#f8fafc',
    transform: beast === 'horn' ? 'rotate(-24deg)' : 'rotate(18deg)',
  },
  '&::after': {
    content: "''",
    position: 'absolute',
    right: beast === 'horn' ? -3 : 5,
    top: beast === 'horn' ? -2 : 8,
    width: beast === 'horn' ? 14 : 18,
    height: beast === 'horn' ? 14 : 7,
    clipPath: beast === 'horn' ? 'polygon(50% 0, 100% 100%, 0 100%)' : 'polygon(0 0, 100% 0, 72% 100%, 18% 100%)',
    background: beast === 'flame' ? '#bfdbfe' : color,
    transform: beast === 'horn' ? 'rotate(24deg)' : 'rotate(-25deg)',
  },
}));

export const ShowcaseArt = styled.img({
  width: '100%',
  maxHeight: 560,
  objectFit: 'cover',
  objectPosition: 'center',
  borderRadius: 2,
  border: '3px solid var(--anime-ink)',
  boxShadow: '6px 6px 0 var(--anime-teal)',
  filter: 'saturate(0.75) contrast(1.06)',
  display: 'block',
});

export const ActionPanel = styled(Box)({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  justifyContent: 'center',
  width: 'min(1380px, 96vw)',
});

export const ActionCard = styled(Paper)({
  width: '100%',
  padding: 14,
  borderRadius: 2,
  background: 'var(--anime-paper-light)',
  border: '2px solid var(--anime-ink)',
  boxShadow: '6px 6px 0 var(--anime-vermilion)',
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

export const PanelText = styled(Typography)({
  color: 'rgba(33,29,26,0.72)',
  marginBottom: 12,
});

export const FeatureGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
  '@media (max-width: 760px)': {
    gridTemplateColumns: '1fr',
  },
});

export const FeatureCard = styled(Box)({
  padding: 14,
  minHeight: 76,
  borderRadius: 2,
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  color: 'var(--anime-ink)',
  fontSize: '0.88rem',
  '& strong': {
    display: 'block',
    marginBottom: 4,
    color: 'var(--anime-vermilion)',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
});

/** Shared export used by the game screen background wrapper. */
export const StyledBackground = styled(Box)({
  minHeight: '100dvh',
  position: 'relative',
  backgroundColor: 'var(--anime-paper)',
  backgroundImage: 'radial-gradient(rgba(23,18,15,0.12) 0.7px, transparent 0.7px)',
  backgroundSize: '5px 5px',
});
