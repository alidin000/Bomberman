import styled from '@emotion/styled';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions as MuiDialogActions
} from '@mui/material';

export const InstructionsBackground = styled('div')({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
  background: 'linear-gradient(135deg, #17120e 0%, #2a2118 42%, #12151a 100%)',
});

export const StyledDialog = styled(Dialog)({
  '& .MuiDialog-container': {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  '& .MuiPaper-root': {
    width: 'min(1120px, 96vw)',
    maxHeight: '92vh',
    padding: '18px 20px 0',
    overflow: 'hidden',
    color: '#f8fafc',
    background: 'linear-gradient(145deg, rgba(15, 15, 16, 0.98), rgba(43, 34, 25, 0.97))',
    border: '1px solid rgba(255,255,255,0.16)',
    boxShadow: '0 26px 90px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
});

export const StyledDialogTitle = styled(DialogTitle)({
  padding: '0 0 14px',
  color: '#fff7ed',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textShadow: '0 2px 0 #000',
});

export const StyledDialogContent = styled(DialogContent)({
  padding: '0 4px 18px',
  maxHeight: '74vh',
  overflowY: 'auto',
  borderColor: 'rgba(255,255,255,0.12)',
});

export const DialogActions = styled(MuiDialogActions)({
  justifyContent: 'center',
  padding: '14px 8px 18px',
  minHeight: 64,
  display: 'flex',
  alignItems: 'center',
  background: 'linear-gradient(180deg, rgba(28,22,18,0), rgba(28,22,18,0.82))',
});

export const BackButton = styled('button')({
  minWidth: 170,
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: '1px solid rgba(245, 158, 11, 0.58)',
  borderRadius: 6,
  color: '#111827',
  background: 'linear-gradient(180deg, #f5a524, #ad4f12)',
  boxShadow: '0 10px 24px rgba(0,0,0,0.34)',
  cursor: 'pointer',
  fontWeight: 900,
  textTransform: 'uppercase',
  '&:hover': {
    background: 'linear-gradient(180deg, #ffd166, #c25a13)',
  },
});

export const ManualIntro = styled('div')({
  marginBottom: 14,
  padding: '14px 16px',
  borderRadius: 8,
  color: 'rgba(248,250,252,0.82)',
  background: 'linear-gradient(90deg, rgba(0,0,0,0.28), rgba(255,255,255,0.06), rgba(0,0,0,0.28))',
  border: '1px solid rgba(255,255,255,0.1)',
  fontWeight: 700,
});

export const ManualGrid = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  '@media (max-width: 760px)': {
    gridTemplateColumns: '1fr',
  },
});

export const ManualSection = styled('section', {
  shouldForwardProp: (prop) => prop !== 'wide',
})<{ wide?: boolean }>(({ wide }) => ({
  gridColumn: wide ? '1 / -1' : 'auto',
  padding: 12,
  borderRadius: 8,
  color: '#f8fafc',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(0,0,0,0.24))',
  border: '1px solid rgba(255,255,255,0.11)',
}));

export const ManualSectionTitle = styled('h2')({
  width: 'fit-content',
  margin: '0 auto 10px',
  padding: '4px 24px 5px',
  color: '#fff7ed',
  background: 'linear-gradient(90deg, transparent, #111 15%, #17120f 85%, transparent)',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontSize: '0.82rem',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textShadow: '0 2px 0 #000',
});

export const ManualList = styled('div', {
  shouldForwardProp: (prop) => prop !== 'compact',
})<{ compact?: boolean }>(({ compact }) => ({
  display: 'grid',
  gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr',
  gap: 8,
}));

export const ManualItem = styled('div')({
  minHeight: 38,
  padding: '8px 10px',
  borderRadius: 6,
  color: 'rgba(248,250,252,0.82)',
  background: 'rgba(0,0,0,0.24)',
  border: '1px solid rgba(255,255,255,0.09)',
  fontSize: '0.86rem',
  fontWeight: 700,
  lineHeight: 1.32,
});

export const ManualBadge = styled('strong')({
  display: 'inline-flex',
  marginRight: 8,
  padding: '2px 7px',
  borderRadius: 5,
  color: '#ffd166',
  background: 'rgba(245,158,11,0.12)',
  border: '1px solid rgba(245,158,11,0.28)',
  textTransform: 'uppercase',
  fontSize: '0.68rem',
  letterSpacing: '0.04em',
});

export const CharacterManualGrid = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: 8,
  '@media (max-width: 1000px)': {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  },
  '@media (max-width: 520px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
});

export const CharacterManualCard = styled('div', {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  minHeight: 124,
  display: 'grid',
  gap: 5,
  padding: 9,
  borderRadius: 6,
  background: `linear-gradient(180deg, ${color}2f, rgba(0,0,0,0.32))`,
  border: `1px solid ${color}88`,
  '& strong': {
    color,
    textTransform: 'uppercase',
    fontWeight: 900,
    textShadow: '0 2px 0 #000',
  },
  '& span': {
    color: 'rgba(248,250,252,0.82)',
    fontSize: '0.76rem',
    fontWeight: 800,
  },
  '& small': {
    color: 'rgba(248,250,252,0.58)',
    fontWeight: 800,
  },
  '& p': {
    margin: 0,
    color: 'rgba(248,250,252,0.68)',
    fontSize: '0.68rem',
    lineHeight: 1.25,
  },
}));
