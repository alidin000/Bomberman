import styled from '@emotion/styled';
import { Button, Dialog, DialogTitle } from '@mui/material';
import theme from '../../../theme/InstructionsTheme';
import { radius, space, textStyles } from '../../../theme/tokens';

export const StyledSettingsDialog = styled(Dialog)({
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(18, 13, 11, 0.78)',
  },
  // A scroll card with its wooden rod across the top.
  '& .MuiDialog-paper': {
    width: 430,
    maxWidth: '92vw',
    // The rod (11 px) plus 21 px of paper above the title.
    padding: `${space[400]}px ${space[300]}px ${space[300]}px`,
    borderRadius: radius.sm,
    color: 'var(--anime-ink)',
    backgroundColor: 'var(--anime-paper-light)',
    backgroundImage: 'var(--scroll-rod), var(--scroll-paper)',
    backgroundSize: '100% 11px, 100% 100%, auto, 100% 100%',
    backgroundRepeat: 'no-repeat, no-repeat, repeat, no-repeat',
    border: '3px solid var(--anime-ink)',
    boxShadow: '8px 8px 0 var(--anime-orange)',
    maxHeight: 'min(760px, 92vh)',
    '@media (max-width: 420px)': {
      padding: `${space[400]}px ${space[200]}px ${space[200]}px`,
    },
  },
  '& .MuiDialogContent-root': {
    padding: `${space[50]}px 0 0`,
  },
  '& .MuiDialogActions-root': {
    gap: space[75],
    justifyContent: 'center',
    padding: `${space[200]}px 0 0`,
  },
});

// Display type on a ragged brush stroke of ink.
export const SettingsTitle = styled(DialogTitle)({
  ...textStyles.heading5,
  position: 'relative',
  isolation: 'isolate',
  margin: `0 0 ${space[100]}px`,
  padding: `${space[75]}px ${space[200]}px`,
  color: 'var(--anime-paper-light)',
  background: 'transparent',
  letterSpacing: '0.07em',
  textAlign: 'center',
  textTransform: 'uppercase',
  textShadow: '2px 2px 0 var(--accent)',
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    zIndex: -1,
    background: 'var(--anime-ink)',
    WebkitMaskImage: 'var(--brush-swash)',
    maskImage: 'var(--brush-swash)',
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
  },
});

export const SettingsIntro = styled.p({
  ...textStyles.body6,
  margin: `0 0 ${space[200]}px`,
  color: 'var(--ink-2)',
  textAlign: 'center',
});

export const ButtonContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${space[100]}px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

export const SettingsButton = styled(Button)({
  ...textStyles.buttonMd,
  minHeight: 48,
  borderRadius: radius.sm,
  '&.MuiButton-contained': {
    color: 'var(--on-action)',
    background: 'var(--action)',
    border: '2px solid var(--anime-ink)',
    boxShadow: '3px 3px 0 var(--anime-ink)',
  },
  '&.MuiButton-contained:hover': {
    background: 'var(--action-deep)',
  },
  '&.MuiButton-outlined': {
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-ink)',
    background: 'var(--anime-paper)',
  },
  '&.MuiButton-outlined:hover': {
    background: 'rgba(245,130,31,0.16)',
  },
  // The theme's warning ink: 5.8:1 on this tint over paper-light (the old
  // vermilion read 4.37:1).
  '&.MuiButton-colorWarning': {
    color: theme.palette.warning.main,
    borderColor: theme.palette.warning.main,
    background: 'rgba(184,40,29,0.1)',
  },
  '&.MuiButton-colorWarning:hover': {
    background: 'rgba(184,40,29,0.18)',
  },
  // Unavailable (Save with clashing keys): flat paper, a dashed keyline and
  // no offset, so it never reads as the orange action.
  '&.MuiButton-root.Mui-disabled': {
    color: 'var(--ink-2)',
    background: 'var(--anime-paper)',
    borderColor: 'var(--ink-2)',
    borderStyle: 'dashed',
    boxShadow: 'none',
  },
});

export const ConfirmText = styled.p({
  ...textStyles.body3,
  margin: `${space[75]}px 0 0`,
  color: 'rgba(33,29,26,0.8)',
  textAlign: 'center',
});

// Sections split by an ink rule across the dialog (a divider, not a box).
export const PreferenceSection = styled.section({
  marginTop: space[200],
  paddingTop: space[200],
  // design-system: allow a divider between sections
  borderTop: '2px solid var(--anime-ink)',
  '& h3': {
    ...textStyles.buttonMd,
    display: 'flex',
    alignItems: 'center',
    gap: space[75],
    margin: `0 0 ${space[100]}px`,
    color: 'var(--anime-teal)',
  },
  // Keyboard focus on a switch or a slider: the chakra ring on its thumb
  // (index.css adds the aura).
  '& .MuiSwitch-switchBase.Mui-focusVisible .MuiSwitch-thumb, & .MuiSlider-thumb.Mui-focusVisible': {
    outline: 'var(--focus-ring)',
    outlineOffset: 2,
  },
});

export const PreferenceGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: `${space[25]}px ${space[100]}px`,
  '& .MuiFormControlLabel-root': { margin: 0 },
  '& .MuiFormControlLabel-label': textStyles.body5,
  '& .MuiSwitch-root': { marginRight: space[50] },
  '@media (max-width: 480px)': { gridTemplateColumns: '1fr' },
});

export const PreferenceSlider = styled.label({
  ...textStyles.body5,
  display: 'grid',
  gridTemplateColumns: '144px minmax(0, 1fr)',
  alignItems: 'center',
  gap: space[100],
  minHeight: 34,
  color: 'var(--ink-3)',
  // The value stays visible next to its name, not only while dragging.
  '& > span': { display: 'flex', justifyContent: 'space-between', gap: space[75] },
  '& > span strong': {
    color: 'var(--anime-ink)',
    fontWeight: textStyles.body4.fontWeight,
    fontVariantNumeric: 'tabular-nums',
  },
  '& .MuiSlider-root': { color: 'var(--anime-teal)', padding: `${space[100]}px 0` },
});
