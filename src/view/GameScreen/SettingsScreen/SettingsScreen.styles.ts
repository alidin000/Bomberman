import styled from '@emotion/styled';
import { Button, Dialog, DialogTitle } from '@mui/material';

const panelCut = 'none';
const chipCut = 'none';

export const StyledSettingsDialog = styled(Dialog)({
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(33, 29, 26, 0.78)',
  },
  '& .MuiDialog-paper': {
    width: 430,
    maxWidth: '92vw',
    padding: '20px 22px 22px',
    clipPath: panelCut,
    borderRadius: 2,
    color: 'var(--anime-ink)',
    background: 'var(--anime-paper-light)',
    border: '3px solid var(--anime-ink)',
    boxShadow: '8px 8px 0 var(--anime-teal)',
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

export const SettingsTitle = styled(DialogTitle)({
  margin: '0 0 10px',
  padding: '8px 18px 9px',
  clipPath: chipCut,
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-vermilion)',
  fontSize: '1.12rem',
  fontWeight: 900,
  letterSpacing: 0,
  textAlign: 'center',
  textTransform: 'uppercase',
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
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
  '&.MuiButton-contained': {
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-teal)',
    border: '2px solid var(--anime-ink)',
    boxShadow: '3px 3px 0 var(--anime-ink)',
  },
  '&.MuiButton-outlined': {
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-ink)',
    background: 'var(--anime-paper)',
  },
  '&.MuiButton-colorWarning': {
    color: 'var(--anime-vermilion)',
    borderColor: 'var(--anime-vermilion)',
    background: 'rgba(189,63,50,0.1)',
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
    fontSize: '0.84rem',
    fontWeight: 900,
    letterSpacing: 0,
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
  '& .MuiSlider-root': { color: 'var(--anime-teal)', padding: '12px 0' },
});
