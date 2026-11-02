import styled from '@emotion/styled';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions as MuiDialogActions
} from '@mui/material';
import {
  PRESSED, space, textStyles, transition,
} from '../../theme/tokens';

const PHONE = '@media (max-width: 520px)';

/** A small square turned on its corner, placed before a label instead of an accent stripe. */
const diamondMarker = (color: string, size = 8) => ({
  content: "''",
  flex: '0 0 auto',
  display: 'inline-block',
  width: size,
  height: size,
  marginRight: space[75],
  background: color,
  border: '1px solid var(--anime-ink)',
  transform: 'rotate(45deg)',
});

export const InstructionsBackground = styled('div')({
  position: 'relative',
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  // Clear of notches and the home indicator (viewport-fit=cover).
  padding: 'max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) '
    + 'max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))',
  overflow: 'hidden',
  // The house backdrop: flat ink night and speed lines.
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
});

export const StyledDialog = styled(Dialog)({
  '& .MuiDialog-container': {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  '& .MuiPaper-root': {
    width: 'min(1180px, 96vw)',
    maxWidth: 'min(1180px, 96vw)',
    margin: space[75],
    maxHeight: '92vh',
    padding: `${space[300]}px ${space[200]}px 0`,
    overflow: 'hidden',
    color: 'var(--anime-ink)',
    // An unrolled scroll: its wooden rod across the top (the actions bar
    // carries the bottom one).
    backgroundColor: 'var(--anime-paper-light)',
    backgroundImage: 'var(--scroll-rod), var(--scroll-paper)',
    backgroundSize: '100% 11px, 100% 100%, auto, 100% 100%',
    backgroundRepeat: 'no-repeat, no-repeat, repeat, no-repeat',
    border: '3px solid var(--anime-ink)',
    boxShadow: 'var(--shadow-frame)',
    borderRadius: 'var(--radius)',
  },
});

// The screen's heading (Heading 3, Heading 4 on phones): display type on a
// ragged brush stroke of ink. Typed as DialogTitle itself so it keeps
// the `component` prop (the screen renders it as its h1).
export const StyledDialogTitle = styled(DialogTitle)({
  ...textStyles.heading3,
  position: 'relative',
  isolation: 'isolate',
  width: 'fit-content',
  minWidth: 300,
  margin: `0 auto ${space[200]}px`,
  padding: `${space[75]}px ${space[600]}px`,
  color: 'var(--anime-paper-light)',
  background: 'transparent',
  textAlign: 'center',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  textShadow: '2px 2px 0 var(--accent)',
  '&::before': {
    content: "''",
    position: 'absolute',
    inset: 0,
    zIndex: -1,
    background: 'var(--anime-ink)',
    WebkitMaskImage: 'var(--brush-swash)',
    maskImage: 'var(--brush-swash)',
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
  },
  [PHONE]: {
    minWidth: 0,
    width: '100%',
    padding: `${space[75]}px ${space[200]}px`,
    fontSize: 'var(--text-3xl)',
    lineHeight: 'var(--leading-3xl)',
  },
}) as typeof DialogTitle;

export const StyledDialogContent = styled(DialogContent)({
  padding: `0 ${space[50]}px ${space[200]}px`,
  maxHeight: '74vh',
  overflowY: 'auto',
  borderColor: 'var(--anime-ink)',
});

export const DialogActions = styled(MuiDialogActions)({
  justifyContent: 'center',
  padding: `${space[100]}px ${space[75]}px ${space[300]}px`,
  minHeight: 64,
  display: 'flex',
  alignItems: 'center',
  background: 'var(--scroll-rod) bottom / 100% 11px no-repeat, var(--anime-paper-light)',
});

export const BackButton = styled('button')({
  ...textStyles.buttonMd,
  minWidth: 170,
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space[75],
  padding: `${space[75]}px ${space[100]}px`,
  border: '2px solid var(--anime-ink)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--on-action)',
  background: 'var(--action)',
  boxShadow: 'var(--shadow-2)',
  cursor: 'pointer',
  transition: transition(['transform'], ['background-color', 'box-shadow']),
  '&:hover': {
    background: 'var(--action-deep)',
  },
  '&:active': PRESSED,
  '&:focus-visible': {
    outline: 'var(--focus-ring)',
    outlineOffset: 3,
  },
  '&:disabled': {
    color: 'rgba(23,18,15,0.7)',
    background: '#c9a27a',
    boxShadow: 'none',
    cursor: 'not-allowed',
  },
});

// A callout led by a mustard diamond, with the link to the dojo.
export const ManualIntro = styled('div')({
  ...textStyles.body1,
  marginBottom: space[200],
  padding: `${space[100]}px ${space[200]}px`,
  color: 'var(--ink-3)',
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  '&::before': {
    ...diamondMarker('var(--anime-mustard)', 10),
    marginRight: space[100],
    verticalAlign: 'middle',
  },
  '& a': {
    display: 'inline-block',
    padding: `0 ${space[25]}px`,
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent)',
    fontWeight: 600,
    textUnderlineOffset: 3,
    transition: transition(['transform'], ['color', 'background-color']),
  },
  '& a:hover': {
    color: 'var(--accent-deep)',
    background: 'rgba(164,64,10,0.1)',
  },
  '& a:active': PRESSED,
  '& a:focus-visible': {
    outline: 'var(--focus-ring)',
    outlineOffset: 2,
  },
});

export const ManualHero = styled('section')({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: space[200],
  alignItems: 'end',
  marginBottom: space[200],
  padding: space[200],
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  boxShadow: '4px 4px 0 var(--anime-teal)',
  '@media (max-width: 760px)': {
    gridTemplateColumns: '1fr',
  },
});

// The lead: Heading 4 (Heading 5 on phones) over a line of Body 5.
export const ManualHeroTitle = styled('div')({
  display: 'grid',
  gap: space[75],
  '& strong': {
    ...textStyles.heading4,
    color: 'var(--anime-ink)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    textShadow: '2px 2px 0 var(--anime-orange)',
  },
  '& p': {
    ...textStyles.body5,
    maxWidth: 720,
    margin: 0,
    color: 'var(--ink-2)',
  },
  [PHONE]: {
    '& strong': {
      fontSize: 'var(--text-2xl)',
      lineHeight: 'var(--leading-2xl)',
    },
  },
});

export const ManualHeroMeta = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: space[75],
  '@media (max-width: 760px)': {
    justifyContent: 'flex-start',
  },
});

export const ManualPill = styled('span')({
  ...textStyles.caption3,
  display: 'inline-flex',
  alignItems: 'center',
  gap: space[75],
  minHeight: 32,
  padding: `${space[50]}px ${space[75]}px`,
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper-light)',
  border: '1px solid var(--anime-ink)',
  textTransform: 'uppercase',
});

export const ManualLayout = styled('div')({
  display: 'grid',
  gridTemplateColumns: '180px minmax(0, 1fr)',
  gap: space[100],
  alignItems: 'start',
  '@media (max-width: 880px)': {
    gridTemplateColumns: '1fr',
  },
});

export const ManualNav = styled('nav')({
  position: 'sticky',
  top: 0,
  display: 'grid',
  gap: space[75],
  padding: space[75],
  background: 'var(--anime-ink)',
  border: '2px solid var(--anime-ink)',
  '@media (max-width: 880px)': {
    position: 'static',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  },
});

// Nav items: Title 5, paper on ink; mustard on hover.
export const ManualNavLink = styled('a')({
  ...textStyles.title5,
  minHeight: 34,
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${space[75]}px ${space[75]}px`,
  color: 'var(--anime-paper-light)',
  textDecoration: 'none',
  textTransform: 'uppercase',
  background: 'transparent',
  border: '1px solid rgba(255,248,231,0.25)',
  transition: transition(['transform'], ['color', 'background-color', 'border-color']),
  '&:hover': {
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-paper-light)',
    background: 'var(--anime-mustard)',
  },
  '&:active': PRESSED,
  '&:focus-visible': {
    outline: 'var(--focus-ring)',
    outlineOffset: 2,
  },
});

export const ManualGrid = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space[100],
  '@media (max-width: 760px)': {
    gridTemplateColumns: '1fr',
  },
});

export const ManualRuleGrid = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: space[100],
  marginBottom: space[100],
  '@media (max-width: 980px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  '@media (max-width: 560px)': {
    gridTemplateColumns: '1fr',
  },
});

// A rule card: a step badge and icon, a Title 3 heading and Body 6.
export const ManualRuleCard = styled('article')({
  minHeight: 134,
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr',
  gap: space[75],
  padding: space[100],
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  '& strong': {
    ...textStyles.title3,
    color: 'var(--anime-teal)',
    textTransform: 'uppercase',
  },
  '& span': {
    ...textStyles.caption3,
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    clipPath: 'polygon(50% 0, 96% 24%, 96% 76%, 50% 100%, 4% 76%, 4% 24%)',
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-vermilion)',
  },
  '& p': {
    ...textStyles.body6,
    margin: 0,
    color: 'var(--ink-2)',
  },
});

export const ManualRuleHeader = styled('div')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[75],
  '& svg': {
    color: 'var(--anime-mustard)',
  },
});

export const ManualSection = styled('section', {
  shouldForwardProp: (prop) => prop !== 'wide',
})<{ wide?: boolean }>(({ wide }) => ({
  gridColumn: wide ? '1 / -1' : 'auto',
  padding: space[100],
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
}));

// Section headings (Heading 5) on a brush stroke of the deep accent
// (paper-light type, 6.3:1).
export const ManualSectionTitle = styled('h2')({
  ...textStyles.heading5,
  position: 'relative',
  isolation: 'isolate',
  width: 'fit-content',
  margin: `0 auto ${space[100]}px`,
  padding: `${space[50]}px ${space[400]}px`,
  color: 'var(--anime-paper-light)',
  background: 'transparent',
  textAlign: 'center',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  textShadow: 'none',
  '&::before': {
    content: "''",
    position: 'absolute',
    inset: 0,
    zIndex: -1,
    background: 'var(--accent)',
    WebkitMaskImage: 'var(--brush-swash)',
    maskImage: 'var(--brush-swash)',
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
  },
});

export const ManualList = styled('div', {
  shouldForwardProp: (prop) => prop !== 'compact',
})<{ compact?: boolean }>(({ compact }) => ({
  display: 'grid',
  gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr',
  gap: space[75],
}));

// One rule: Body 5 on paper-light, its key words at the same weight as a badge.
export const ManualItem = styled('div')({
  ...textStyles.body5,
  minHeight: 38,
  padding: `${space[75]}px ${space[100]}px`,
  color: 'var(--ink-3)',
  background: 'var(--anime-paper-light)',
  border: '1px solid rgba(33,29,26,0.3)',
  '& strong': {
    fontWeight: 600,
  },
});

export const ManualBadge = styled('strong')({
  ...textStyles.caption3,
  display: 'inline-flex',
  marginRight: space[75],
  padding: `${space[25]}px ${space[75]}px`,
  color: 'var(--anime-vermilion-deep)',
  background: 'rgba(212,163,63,0.16)',
  border: '1px solid var(--anime-mustard)',
  textTransform: 'uppercase',
});

export const ManualFlow = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: space[75],
  marginBottom: space[100],
});

// A step of the campaign: its number led by an accent diamond, then the label.
export const ManualFlowStep = styled('div')({
  minHeight: 74,
  display: 'grid',
  alignContent: 'start',
  gap: space[50],
  padding: space[100],
  background: 'var(--anime-paper-light)',
  border: '1px solid var(--anime-ink)',
  '& strong': {
    ...textStyles.caption3,
    display: 'flex',
    alignItems: 'center',
    color: 'var(--anime-teal)',
    textTransform: 'uppercase',
  },
  '& strong::before': diamondMarker('var(--anime-teal)'),
  '& span': {
    ...textStyles.title4,
    color: 'var(--ink-2)',
  },
});

export const ManualDiagram = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 36px)',
  gridTemplateRows: 'repeat(5, 36px)',
  gap: space[50],
  justifyContent: 'center',
  marginBottom: space[100],
  padding: space[100],
  background: 'var(--anime-ink)',
  border: '2px solid var(--anime-ink)',
});

export const ManualLegend = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: space[75],
  margin: `0 0 ${space[100]}px`,
  '& span': {
    ...textStyles.caption3,
    minHeight: 28,
    display: 'inline-flex',
    alignItems: 'center',
    gap: space[75],
    padding: `${space[50]}px ${space[75]}px`,
    color: 'var(--anime-ink)',
    background: 'var(--anime-paper-light)',
    border: '1px solid var(--anime-ink)',
    textTransform: 'uppercase',
  },
  '& strong': {
    ...textStyles.caption3,
    width: 18,
    height: 18,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    clipPath: 'polygon(50% 0, 96% 24%, 96% 76%, 50% 100%, 4% 76%, 4% 24%)',
    color: 'var(--anime-ink)',
    background: 'var(--anime-mustard)',
  },
});

type DiagramCellKind = 'blast' | 'bomb' | 'wall';

function getDiagramBackground(kind?: DiagramCellKind): string {
  switch (kind) {
    case 'bomb':
      return 'var(--anime-mustard)';
    case 'blast':
      return 'var(--anime-vermilion)';
    case 'wall':
      return 'var(--anime-olive)';
    default:
      return 'var(--anime-paper-light)';
  }
}

function getDiagramBorder(kind?: DiagramCellKind): string {
  switch (kind) {
    case 'bomb':
      return 'var(--anime-mustard)';
    case 'blast':
      return 'var(--anime-vermilion)';
    default:
      return 'var(--anime-ink)';
  }
}

export const DiagramCell = styled('span', {
  shouldForwardProp: (prop) => prop !== 'kind',
})<{ kind?: DiagramCellKind }>(({ kind }) => ({
  ...textStyles.body4,
  minWidth: 36,
  minHeight: 36,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: kind === 'bomb' ? 'var(--anime-ink)' : 'var(--anime-paper-light)',
  background: getDiagramBackground(kind),
  border: `1px solid ${getDiagramBorder(kind)}`,
}));

export const CharacterManualGrid = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: space[75],
  '@media (max-width: 1000px)': {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  },
  '@media (max-width: 520px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
});

// A fighter card, tinted with the fighter's colour: the name (Title 3, led by
// a square of that colour), the kit as captions and the blurb as Body 6.
export const CharacterManualCard = styled('div', {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  minHeight: 124,
  display: 'grid',
  alignContent: 'start',
  gap: space[50],
  padding: space[75],
  background: `color-mix(in srgb, ${color} 13%, var(--anime-paper-light))`,
  border: '2px solid var(--anime-ink)',
  '& strong': {
    ...textStyles.title3,
    display: 'flex',
    alignItems: 'center',
    color: 'var(--anime-ink)',
    textTransform: 'uppercase',
    textShadow: 'none',
  },
  '& strong::before': {
    ...diamondMarker(color, 10),
    transform: 'none',
  },
  '& span': {
    ...textStyles.caption3,
    color: 'var(--ink-3)',
  },
  '& small': {
    ...textStyles.caption4,
    color: 'var(--ink-2)',
  },
  '& p': {
    ...textStyles.body6,
    margin: 0,
    color: 'var(--ink-2)',
  },
}));
