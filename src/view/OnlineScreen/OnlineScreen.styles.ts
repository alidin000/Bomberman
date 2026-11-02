import { Box, Button, styled } from '@mui/material';
import {
  PRESSED, space, textStyles, transition,
} from '../../theme/tokens';

const NARROW = '@media (max-width: 700px)';
const PHONE = '@media (max-width: 520px)';

// The house backdrop: flat ink night. Buttons here sit on ink, so outlined
// and text ones carry paper type (the theme's ink type is for paper).
export const OnlinePage = styled(Box)({
  minHeight: '100dvh',
  color: 'var(--anime-paper-light)',
  backgroundColor: 'var(--anime-night)',
  padding: `${space[600]}px max(${space[200]}px, env(safe-area-inset-right)) `
    + `${space[600]}px max(${space[200]}px, env(safe-area-inset-left))`,
  [NARROW]: {
    paddingTop: space[300],
    paddingBottom: space[300],
  },
  '& .MuiButton-outlined': {
    color: 'var(--anime-paper-light)',
    borderColor: 'rgba(255,248,231,0.6)',
  },
  '& .MuiButton-outlined:hover': {
    borderColor: 'var(--anime-orange)',
    background: 'rgba(245,130,31,0.14)',
  },
  '& .MuiButton-text:hover': {
    background: 'rgba(255,248,231,0.1)',
  },
  // Disabled reads as disabled on ink: a flat tan fill, or a faint dashed
  // keyline with dim type.
  '& .MuiButton-contained.Mui-disabled': {
    color: 'rgba(23,18,15,0.7)',
    background: '#c9a27a',
    boxShadow: 'none',
  },
  '& .MuiButton-outlined.Mui-disabled': {
    color: 'rgba(255,248,231,0.5)',
    borderColor: 'rgba(255,248,231,0.3)',
    borderStyle: 'dashed',
  },
  // The bright chakra ring: the deep one sits under 3:1 on night.
  '& .MuiButtonBase-root.Mui-focusVisible': {
    outline: '3px solid var(--chakra)',
    outlineOffset: 3,
  },
});

export const OnlineShell = styled(Box)({
  width: 'min(860px, 100%)', margin: '0 auto', display: 'grid', gap: space[300],
});

// The screen's Heading 2 (Heading 3 on phones) and its one line.
export const OnlineHeader = styled('header')({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: space[200],
  paddingBottom: space[200],
  // design-system: allow a divider under the lobby header
  borderBottom: '1px solid color-mix(in srgb, var(--anime-paper-light) 24%, transparent)',
  '& h1': {
    ...textStyles.heading2,
    margin: 0,
    color: 'var(--anime-orange)',
    letterSpacing: '0.05em',
    textShadow: '3px 3px 0 #000',
  },
  '& p': {
    ...textStyles.body3,
    margin: `${space[75]}px 0 0`,
    color: 'var(--anime-paper-muted)',
    maxWidth: 560,
  },
  [NARROW]: {
    '& h1': {
      fontSize: 'var(--text-4xl)',
      lineHeight: 'var(--leading-4xl)',
    },
  },
});

export const SetupGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space[200],
  [NARROW]: { gridTemplateColumns: '1fr' },
});

export const ExperienceGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: space[100],
  [NARROW]: { gridTemplateColumns: '1fr' },
  // Phones: three compact tiles in a row, so Create room stays on screen.
  [PHONE]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: space[75] },
});

// A big choice tile: an icon, then its name over one line of help. On
// phones the icon sits over the name and the help is read aloud only.
export const ExperienceChoice = styled(Button)({
  minHeight: 78,
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  borderRadius: 'var(--radius-md)',
  padding: `${space[100]}px ${space[200]}px`,
  textAlign: 'left',
  '& .MuiButton-startIcon': { marginTop: space[25] },
  [PHONE]: {
    minHeight: 64,
    flexDirection: 'column',
    gap: space[50],
    padding: space[75],
    '& .MuiButton-startIcon': { margin: 0 },
  },
});

export const ChoiceCopy = styled('span')({
  display: 'grid',
  gap: space[25],
  minWidth: 0,
});

export const ChoiceHint = styled('span')({
  ...textStyles.caption4,
  letterSpacing: 0,
  opacity: 0.85,
  textTransform: 'none',
  [PHONE]: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  },
});

export const OnlinePanel = styled('section')({
  border: '1px solid color-mix(in srgb, var(--anime-paper-light) 22%, transparent)',
  background: 'color-mix(in srgb, var(--anime-night) 88%, var(--anime-paper-light))',
  padding: space[300],
  borderRadius: 'var(--radius-md)',
  display: 'grid',
  alignContent: 'start',
  gap: space[200],
  '& h2': {
    ...textStyles.heading5,
    margin: 0,
  },
  '& p': {
    ...textStyles.body6,
    margin: 0,
    color: 'var(--anime-paper-muted)',
  },
  [NARROW]: { padding: space[200] },
});

// A label over its control: Caption 3 in capitals with a little tracking.
export const Field = styled('label')({
  ...textStyles.caption3,
  display: 'grid',
  gap: space[75],
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--anime-paper-muted)',
  '& input': {
    ...textStyles.body3,
    minHeight: 46,
    padding: `${space[75]}px ${space[100]}px`,
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-ink)',
    border: '1px solid color-mix(in srgb, var(--anime-paper-light) 28%, transparent)',
    borderRadius: 'var(--radius-base)',
    letterSpacing: 0,
    transition: transition([], ['border-color']),
  },
  '& input:hover': {
    borderColor: 'color-mix(in srgb, var(--anime-paper-light) 50%, transparent)',
  },
  '& input:focus-visible': {
    outline: '3px solid var(--chakra)',
    outlineOffset: 2,
  },
  '& .MuiInputBase-root': {
    ...textStyles.body3,
    minHeight: 46,
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-ink)',
    letterSpacing: 0,
  },
  '& .MuiOutlinedInput-root .MuiSelect-select': {
    padding: `${space[75]}px ${space[400]}px ${space[75]}px ${space[100]}px`,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'color-mix(in srgb, var(--anime-paper-light) 28%, transparent)',
  },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'color-mix(in srgb, var(--anime-paper-light) 50%, transparent)',
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--chakra)',
  },
  '& .MuiSvgIcon-root': { color: 'var(--anime-paper-muted)' },
});

// Round counts: paper on ink, the chosen one in mustard.
export const RoundToggles = styled(Box)({
  '& .MuiToggleButton-root': {
    ...textStyles.buttonSm,
    minHeight: 44,
    padding: `${space[75]}px ${space[100]}px`,
    color: 'var(--anime-paper-muted)',
    borderColor: 'color-mix(in srgb, var(--anime-paper-light) 32%, transparent)',
    transition: transition(['transform'], ['background-color', 'border-color', 'color']),
  },
  '& .MuiToggleButton-root:hover': {
    background: 'rgba(255,248,231,0.1)',
  },
  '& .MuiToggleButton-root:active': PRESSED,
  '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': {
    color: 'var(--anime-mustard)',
    background: 'color-mix(in srgb, var(--anime-mustard) 14%, transparent)',
  },
  '& .MuiToggleButton-root.Mui-focusVisible': {
    outline: '3px solid var(--chakra)',
    outlineOffset: 2,
  },
});

export const CharacterGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: space[75],
});

export const CharacterButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'chosen',
})<{ chosen: boolean }>(({ chosen }) => ({
  minHeight: 44,
  borderRadius: 'var(--radius-base)',
  borderColor: chosen ? 'var(--anime-mustard)' : undefined,
  color: chosen ? 'var(--anime-mustard)' : 'var(--anime-paper-light)',
  background: chosen ? 'color-mix(in srgb, var(--anime-mustard) 12%, transparent)' : undefined,
}));

export const RoomCode = styled('strong')({
  fontFamily: 'var(--anime-mono)',
  fontWeight: 600,
  fontSize: 'var(--text-5xl)',
  lineHeight: 1,
  letterSpacing: '.14em',
  color: 'var(--anime-mustard)',
  [NARROW]: {
    fontSize: 'var(--text-4xl)',
    lineHeight: 'var(--leading-4xl)',
  },
});

// The invite link, shown when it could not be copied: select and copy it.
export const InviteLink = styled('code')({
  ...textStyles.caption2,
  display: 'block',
  padding: `${space[75]}px ${space[100]}px`,
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-ink)',
  borderRadius: 'var(--radius-base)',
  overflowWrap: 'anywhere',
  userSelect: 'all',
});

// Seats, each led by a diamond: filled when taken, an outline when open.
export const PlayerList = styled('ol')({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: space[75],
  '& li': {
    ...textStyles.title4,
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    gap: space[100],
    padding: `${space[75]}px ${space[100]}px`,
    background: 'color-mix(in srgb, var(--anime-paper-light) 7%, transparent)',
    border: '1px solid color-mix(in srgb, var(--anime-paper-light) 14%, transparent)',
    borderRadius: 'var(--radius-base)',
  },
  '& li::before': {
    content: "''",
    flex: '0 0 auto',
    width: 8,
    height: 8,
    background: 'var(--anime-mustard)',
    border: '1px solid var(--anime-mustard)',
    transform: 'rotate(45deg)',
  },
  '& li[data-open="true"]': { color: 'var(--anime-paper-muted)' },
  '& li[data-open="true"]::before': { background: 'transparent' },
  '& li > span:last-of-type': {
    ...textStyles.caption1,
    marginLeft: 'auto',
    color: 'var(--anime-paper-muted)',
  },
});

// What failed and what to do next, inline under the header.
export const OnlineError = styled('section')({
  display: 'grid',
  gap: space[75],
  justifyItems: 'start',
  padding: space[200],
  color: 'var(--anime-paper-light)',
  background: 'color-mix(in srgb, var(--anime-vermilion) 18%, var(--anime-night))',
  border: '2px solid var(--anime-vermilion)',
  borderRadius: 'var(--radius-md)',
  '& h1, & h2': {
    ...textStyles.heading6,
    margin: 0,
  },
  '& p': {
    ...textStyles.body6,
    margin: 0,
    color: 'var(--anime-paper-muted)',
  },
});

export const ErrorActions = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[75],
  marginTop: space[50],
});

// While a socket opens: the room's two panels, drawn as skeletons.
export const RoomSkeleton = styled(Box)({
  display: 'grid',
  gap: space[200],
  '& > span': {
    ...textStyles.caption1,
    color: 'var(--anime-paper-muted)',
  },
});

export const MatchNetworkBar = styled(Box)({
  ...textStyles.caption4,
  position: 'fixed',
  zIndex: 40,
  bottom: space[100],
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: space[100],
  maxWidth: 'calc(100vw - 24px)',
  padding: `${space[75]}px ${space[100]}px`,
  borderRadius: 'var(--radius-base)',
  background: 'color-mix(in srgb, var(--anime-ink) 88%, transparent)',
  border: '1px solid color-mix(in srgb, var(--anime-paper-light) 22%, transparent)',
  color: 'var(--anime-paper-light)',
  whiteSpace: 'nowrap',
  '& strong': { fontWeight: 600 },
  'html[data-touch="on"] &': {
    '@media (orientation: portrait)': {
      bottom: 'calc(var(--touch-bottom, 0px) + env(safe-area-inset-bottom, 0px) + 8px)',
    },
  },
});

export const ConnectionCurtain = styled(Box)({
  position: 'fixed',
  zIndex: 70,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: space[200],
  textAlign: 'center',
  background: 'color-mix(in srgb, var(--anime-night) 76%, transparent)',
  color: 'var(--anime-paper-light)',
});

export const ResultPanel = styled(OnlinePanel)({
  width: 'min(420px, 100%)',
  textAlign: 'center',
  '& strong': { ...textStyles.heading6 },
});
export const CompactButton = styled(Button)({
  flexShrink: 0,
  minHeight: 40,
  borderRadius: 'var(--radius-base)',
  whiteSpace: 'nowrap',
});
