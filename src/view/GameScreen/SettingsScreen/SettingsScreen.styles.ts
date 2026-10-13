import styled from '@emotion/styled';
import { Button, Dialog, DialogTitle } from '@mui/material';
import theme from '../../../theme/InstructionsTheme';

const panelCut = 'none';
const chipCut = 'none';

export const StyledSettingsDialog = styled(Dialog)({
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(18, 13, 11, 0.78)',
  },
  // A scroll card with its wooden rod across the top.
  '& .MuiDialog-paper': {
    width: 430,
    maxWidth: '92vw',
    padding: '29px 22px 22px',
    clipPath: panelCut,
    borderRadius: 2,
    color: 'var(--anime-ink)',
    backgroundColor: 'var(--anime-paper-light)',
    backgroundImage: 'var(--scroll-rod), var(--scroll-paper)',
    backgroundSize: '100% 11px, 100% 100%, auto, 100% 100%',
    backgroundRepeat: 'no-repeat, no-repeat, repeat, no-repeat',
    border: '3px solid var(--anime-ink)',
    boxShadow: '8px 8px 0 var(--anime-orange)',
    maxHeight: 'min(760px, 92vh)',
  },
  '& .MuiDialogContent-root': {
    padding: '4px 0 0',
  },
  '& .MuiDialogActions-root': {
    gap: 8,
    justifyContent: 'center',
    padding: '18px 0 0',
  },
});

// Display type on a ragged brush stroke of ink.
export const SettingsTitle = styled(DialogTitle)({
  position: 'relative',
  isolation: 'isolate',
  margin: '0 0 10px',
  padding: '6px 18px 7px',
  clipPath: chipCut,
  color: 'var(--anime-paper-light)',
  background: 'transparent',
  fontFamily: 'var(--font-display)',
  fontSize: '1.6rem',
  fontWeight: 400,
  lineHeight: 1.15,
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
  margin: '0 0 16px',
  color: 'rgba(33,29,26,0.72)',
  fontSize: '0.84rem',
  fontWeight: 700,
  lineHeight: 1.45,
  textAlign: 'center',
});

export const ButtonContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

export const SettingsButton = styled(Button)({
  minHeight: 48,
  borderRadius: 2,
  clipPath: chipCut,
  fontFamily: 'var(--font-display)',
  fontSize: '1.08rem',
  fontWeight: 400,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  '&.MuiButton-contained': {
    color: 'var(--on-action)',
    background: 'var(--action)',
    border: '2px solid var(--anime-ink)',
    boxShadow: '3px 3px 0 var(--anime-ink)',
  },
  '&.MuiButton-outlined': {
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-ink)',
    background: 'var(--anime-paper)',
  },
  // The theme's warning ink: 5.8:1 on this tint over paper-light (the old
  // vermilion read 4.37:1).
  '&.MuiButton-colorWarning': {
    color: theme.palette.warning.main,
    borderColor: theme.palette.warning.main,
    background: 'rgba(184,40,29,0.1)',
  },
});

export const ConfirmText = styled.p({
  margin: '6px 0 0',
  color: 'rgba(33,29,26,0.8)',
  fontWeight: 700,
  lineHeight: 1.45,
  textAlign: 'center',
});

export const PreferenceSection = styled.section({
  marginTop: 18,
  paddingTop: 16,
  borderTop: '2px solid var(--anime-ink)',
  '& h3': {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '0 0 10px',
    color: 'var(--anime-teal)',
    fontFamily: 'var(--font-display)',
    fontSize: '1.1rem',
    fontWeight: 400,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
});

export const PreferenceGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '2px 12px',
  '& .MuiFormControlLabel-root': { margin: 0 },
  '& .MuiFormControlLabel-label': { fontSize: '0.78rem', fontWeight: 700 },
  '& .MuiSwitch-root': { marginRight: 4 },
  '@media (max-width: 480px)': { gridTemplateColumns: '1fr' },
});

export const PreferenceSlider = styled.label({
  display: 'grid',
  gridTemplateColumns: '112px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 12,
  minHeight: 34,
  color: 'rgba(33,29,26,0.78)',
  fontSize: '0.76rem',
  fontWeight: 800,
  // The value stays visible next to its name, not only while dragging.
  '& > span': { display: 'flex', justifyContent: 'space-between', gap: 6 },
  '& > span strong': { color: 'var(--anime-ink)', fontVariantNumeric: 'tabular-nums' },
  '& .MuiSlider-root': { color: 'var(--anime-teal)', padding: '12px 0' },
});
