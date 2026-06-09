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
  background: 'linear-gradient(135deg, #08111a 0%, #101827 46%, #17120e 100%)',
});

export const StyledDialog = styled(Dialog)({
  '& .MuiDialog-container': {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  '& .MuiPaper-root': {
    width: 'min(1180px, 96vw)',
    maxHeight: '92vh',
    padding: '18px 18px 0',
    overflow: 'hidden',
    color: '#f8fafc',
    background: 'linear-gradient(145deg, rgba(7, 13, 20, 0.98), rgba(28, 21, 18, 0.97))',
    border: '1px solid rgba(255,255,255,0.16)',
    boxShadow: '0 26px 90px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
});

export const StyledDialogTitle = styled(DialogTitle)({
  padding: '0 0 14px',
  color: '#ecfeff',
  textAlign: 'left',
  textTransform: 'uppercase',
  fontWeight: 900,
  letterSpacing: 0,
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
  color: 'rgba(236,254,255,0.84)',
  background: 'linear-gradient(90deg, rgba(8,47,73,0.42), rgba(13,148,136,0.14), rgba(67,56,202,0.16))',
  border: '1px solid rgba(125,211,252,0.2)',
  fontWeight: 700,
});

export const ManualHero = styled('section')({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 16,
  alignItems: 'end',
  marginBottom: 14,
  padding: '18px 18px 16px',
  borderRadius: 8,
  background: 'linear-gradient(135deg, rgba(8,47,73,0.72), rgba(15,23,42,0.58) 54%, rgba(120,53,15,0.34))',
  border: '1px solid rgba(125,211,252,0.18)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
  '@media (max-width: 760px)': {
    gridTemplateColumns: '1fr',
  },
});

export const ManualHeroTitle = styled('div')({
  display: 'grid',
  gap: 6,
  '& strong': {
    color: '#ecfeff',
    fontSize: '1.35rem',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  '& p': {
    maxWidth: 720,
    margin: 0,
    color: 'rgba(248,250,252,0.74)',
    fontSize: '0.9rem',
    lineHeight: 1.4,
    fontWeight: 700,
  },
});

export const ManualHeroMeta = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 8,
  '@media (max-width: 760px)': {
    justifyContent: 'flex-start',
  },
});

export const ManualPill = styled('span')({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  minHeight: 32,
  padding: '6px 10px',
  borderRadius: 6,
  color: '#fef3c7',
  background: 'rgba(245,158,11,0.14)',
  border: '1px solid rgba(245,158,11,0.24)',
  fontSize: '0.72rem',
  fontWeight: 900,
  textTransform: 'uppercase',
});

export const ManualLayout = styled('div')({
  display: 'grid',
  gridTemplateColumns: '180px minmax(0, 1fr)',
  gap: 12,
  alignItems: 'start',
  '@media (max-width: 880px)': {
    gridTemplateColumns: '1fr',
  },
});

export const ManualNav = styled('nav')({
  position: 'sticky',
  top: 0,
  display: 'grid',
  gap: 8,
  padding: 10,
  borderRadius: 8,
  background: 'rgba(2,6,23,0.46)',
  border: '1px solid rgba(148,163,184,0.16)',
  '@media (max-width: 880px)': {
    position: 'static',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  },
});

export const ManualNavLink = styled('a')({
  minHeight: 34,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 9px',
  borderRadius: 6,
  color: 'rgba(248,250,252,0.78)',
  textDecoration: 'none',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  fontSize: '0.74rem',
  fontWeight: 900,
  textTransform: 'uppercase',
  '&:hover': {
    color: '#ecfeff',
    borderColor: 'rgba(125,211,252,0.38)',
    background: 'rgba(14,165,233,0.12)',
  },
});

export const ManualGrid = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  '@media (max-width: 760px)': {
    gridTemplateColumns: '1fr',
  },
});

export const ManualRuleGrid = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 10,
  marginBottom: 12,
  '@media (max-width: 980px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  '@media (max-width: 560px)': {
    gridTemplateColumns: '1fr',
  },
});

export const ManualRuleCard = styled('article')({
  minHeight: 134,
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr',
  gap: 7,
  padding: 12,
  borderRadius: 8,
  color: '#f8fafc',
  background: 'linear-gradient(180deg, rgba(14, 165, 233, 0.16), rgba(0,0,0,0.28))',
  border: '1px solid rgba(125, 211, 252, 0.22)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
  '& strong': {
    color: '#bae6fd',
    fontSize: '0.84rem',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  '& span': {
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    color: '#06121f',
    background: '#7dd3fc',
    fontWeight: 900,
  },
  '& p': {
    margin: 0,
    color: 'rgba(248,250,252,0.76)',
    fontSize: '0.82rem',
    lineHeight: 1.34,
    fontWeight: 700,
  },
});

export const ManualRuleHeader = styled('div')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  '& svg': {
    color: '#fbbf24',
  },
});

export const ManualSection = styled('section', {
  shouldForwardProp: (prop) => prop !== 'wide',
})<{ wide?: boolean }>(({ wide }) => ({
  gridColumn: wide ? '1 / -1' : 'auto',
  padding: 12,
  borderRadius: 8,
  color: '#f8fafc',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.065), rgba(2,6,23,0.28))',
  border: '1px solid rgba(148,163,184,0.15)',
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
  letterSpacing: 0,
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
  letterSpacing: 0,
});

export const ManualFlow = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 8,
  marginBottom: 10,
});

export const ManualFlowStep = styled('div')({
  minHeight: 74,
  display: 'grid',
  gap: 4,
  padding: 10,
  borderRadius: 7,
  background: 'rgba(13,148,136,0.12)',
  border: '1px solid rgba(45,212,191,0.2)',
  '& strong': {
    color: '#99f6e4',
    fontSize: '0.78rem',
    textTransform: 'uppercase',
  },
  '& span': {
    color: 'rgba(248,250,252,0.72)',
    fontSize: '0.78rem',
    fontWeight: 800,
  },
});

export const ManualDiagram = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 36px)',
  gridTemplateRows: 'repeat(5, 36px)',
  gap: 4,
  justifyContent: 'center',
  marginBottom: 10,
  padding: 10,
  borderRadius: 8,
  background: 'rgba(2,6,23,0.3)',
  border: '1px solid rgba(148,163,184,0.14)',
});

export const ManualLegend = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: 8,
  margin: '-2px 0 10px',
  '& span': {
    minHeight: 28,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    borderRadius: 6,
    color: 'rgba(248,250,252,0.78)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    fontSize: '0.72rem',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  '& strong': {
    width: 18,
    height: 18,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    color: '#111827',
    background: '#fbbf24',
    fontSize: '0.66rem',
  },
});

type DiagramCellKind = 'blast' | 'bomb' | 'wall';

function getDiagramBackground(kind?: DiagramCellKind): string {
  switch (kind) {
    case 'bomb':
      return '#fbbf24';
    case 'blast':
      return 'rgba(248,113,113,0.42)';
    case 'wall':
      return 'rgba(100,116,139,0.42)';
    default:
      return 'rgba(255,255,255,0.05)';
  }
}

function getDiagramBorder(kind?: DiagramCellKind): string {
  switch (kind) {
    case 'bomb':
      return 'rgba(251,191,36,0.72)';
    case 'blast':
      return 'rgba(248,113,113,0.36)';
    default:
      return 'rgba(255,255,255,0.08)';
  }
}

export const DiagramCell = styled('span', {
  shouldForwardProp: (prop) => prop !== 'kind',
})<{ kind?: DiagramCellKind }>(({ kind }) => ({
  minWidth: 36,
  minHeight: 36,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  color: kind === 'bomb' ? '#111827' : 'rgba(248,250,252,0.78)',
  background: getDiagramBackground(kind),
  border: `1px solid ${getDiagramBorder(kind)}`,
  fontWeight: 900,
}));

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
