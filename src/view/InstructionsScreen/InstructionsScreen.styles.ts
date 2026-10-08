import styled from '@emotion/styled';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions as MuiDialogActions
} from '@mui/material';

const panelCut = 'none';
const chipCut = 'none';
const bannerCut = 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)';

export const InstructionsBackground = styled('div')({
  position: 'relative',
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
  overflow: 'hidden',
  backgroundColor: 'var(--anime-paper)',
  backgroundImage: 'radial-gradient(rgba(33,29,26,0.12) 0.7px, transparent 0.7px)',
  backgroundSize: '5px 5px',
  '&::before': {
    content: "''",
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    opacity: 1,
    border: '10px solid var(--anime-teal)',
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
    maxHeight: '92vh',
    padding: '18px 18px 0',
    overflow: 'hidden',
    color: 'var(--anime-ink)',
    clipPath: panelCut,
    background: 'var(--anime-paper-light)',
    border: '3px solid var(--anime-ink)',
    boxShadow: '8px 8px 0 var(--anime-vermilion)',
    borderRadius: 2,
  },
});

export const StyledDialogTitle = styled(DialogTitle)({
  width: 'fit-content',
  minWidth: 300,
  margin: '0 auto 14px',
  padding: '8px 36px 9px',
  clipPath: bannerCut,
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-teal)',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontWeight: 900,
  letterSpacing: 0,
  boxShadow: '4px 4px 0 var(--anime-ink)',
  '@media (max-width: 520px)': {
    minWidth: 0,
    width: '100%',
    padding: '8px 18px 9px',
    fontSize: '1rem',
  },
});

export const StyledDialogContent = styled(DialogContent)({
  padding: '0 4px 18px',
  maxHeight: '74vh',
  overflowY: 'auto',
  borderColor: 'var(--anime-ink)',
});

export const DialogActions = styled(MuiDialogActions)({
  justifyContent: 'center',
  padding: '14px 8px 18px',
  minHeight: 64,
  display: 'flex',
  alignItems: 'center',
  background: 'var(--anime-paper-light)',
});

export const BackButton = styled('button')({
  minWidth: 170,
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: '2px solid var(--anime-ink)',
  borderRadius: 2,
  clipPath: chipCut,
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-vermilion)',
  boxShadow: '3px 3px 0 var(--anime-ink)',
  cursor: 'pointer',
  fontWeight: 900,
  textTransform: 'uppercase',
  '&:hover': {
    background: '#d65343',
  },
  '&:focus-visible': {
    outline: '3px solid var(--anime-mustard)',
    outlineOffset: 3,
  },
});

export const ManualIntro = styled('div')({
  marginBottom: 14,
  padding: '14px 16px 14px 20px',
  clipPath: panelCut,
  color: 'rgba(33,29,26,0.84)',
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  borderLeft: '8px solid var(--anime-mustard)',
  fontWeight: 700,
});

export const ManualHero = styled('section')({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 16,
  alignItems: 'end',
  marginBottom: 14,
  padding: '18px 18px 16px',
  clipPath: panelCut,
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  boxShadow: '4px 4px 0 var(--anime-teal)',
  '@media (max-width: 760px)': {
    gridTemplateColumns: '1fr',
  },
});

export const ManualHeroTitle = styled('div')({
  display: 'grid',
  gap: 6,
  '& strong': {
    color: 'var(--anime-ink)',
    fontSize: '1.35rem',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  '& p': {
    maxWidth: 720,
    margin: 0,
    color: 'rgba(33,29,26,0.74)',
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
  clipPath: chipCut,
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper-light)',
  border: '1px solid var(--anime-ink)',
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
  clipPath: panelCut,
  background: 'var(--anime-ink)',
  border: '2px solid var(--anime-ink)',
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
  clipPath: chipCut,
  color: 'var(--anime-paper-light)',
  textDecoration: 'none',
  background: 'transparent',
  border: '1px solid rgba(255,248,231,0.25)',
  fontSize: '0.74rem',
  fontWeight: 900,
  textTransform: 'uppercase',
  '&:hover': {
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-paper-light)',
    background: 'var(--anime-mustard)',
  },
  '&:focus-visible': {
    outline: '3px solid var(--anime-vermilion)',
    outlineOffset: 2,
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
  clipPath: panelCut,
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  '& strong': {
    color: 'var(--anime-teal)',
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
    clipPath: 'polygon(50% 0, 96% 24%, 96% 76%, 50% 100%, 4% 76%, 4% 24%)',
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-vermilion)',
    fontWeight: 900,
  },
  '& p': {
    margin: 0,
    color: 'rgba(33,29,26,0.76)',
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
    color: 'var(--anime-mustard)',
  },
});

export const ManualSection = styled('section', {
  shouldForwardProp: (prop) => prop !== 'wide',
})<{ wide?: boolean }>(({ wide }) => ({
  gridColumn: wide ? '1 / -1' : 'auto',
  padding: 12,
  clipPath: panelCut,
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
}));

export const ManualSectionTitle = styled('h2')({
  width: 'fit-content',
  margin: '0 auto 10px',
  padding: '5px 26px 6px',
  clipPath: bannerCut,
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-teal)',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontSize: '0.82rem',
  fontWeight: 900,
  letterSpacing: 0,
  textShadow: 'none',
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
  clipPath: chipCut,
  color: 'rgba(33,29,26,0.82)',
  background: 'var(--anime-paper-light)',
  border: '1px solid rgba(33,29,26,0.3)',
  fontSize: '0.86rem',
  fontWeight: 700,
  lineHeight: 1.32,
});

export const ManualBadge = styled('strong')({
  display: 'inline-flex',
  marginRight: 8,
  padding: '2px 7px',
  clipPath: chipCut,
  color: 'var(--anime-vermilion)',
  background: 'rgba(212,163,63,0.16)',
  border: '1px solid var(--anime-mustard)',
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
  clipPath: chipCut,
  background: 'var(--anime-paper-light)',
  border: '1px solid var(--anime-ink)',
  borderTop: '5px solid var(--anime-teal)',
  '& strong': {
    color: 'var(--anime-teal)',
    fontSize: '0.78rem',
    textTransform: 'uppercase',
  },
  '& span': {
    color: 'rgba(33,29,26,0.72)',
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
  clipPath: panelCut,
  background: 'var(--anime-ink)',
  border: '2px solid var(--anime-ink)',
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
    clipPath: chipCut,
    color: 'var(--anime-ink)',
    background: 'var(--anime-paper-light)',
    border: '1px solid var(--anime-ink)',
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
    clipPath: 'polygon(50% 0, 96% 24%, 96% 76%, 50% 100%, 4% 76%, 4% 24%)',
    color: 'var(--anime-ink)',
    background: 'var(--anime-mustard)',
    fontSize: '0.66rem',
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
  minWidth: 36,
  minHeight: 36,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  clipPath: chipCut,
  color: kind === 'bomb' ? 'var(--anime-ink)' : 'var(--anime-paper-light)',
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
  clipPath: panelCut,
  background: `color-mix(in srgb, ${color} 13%, var(--anime-paper-light))`,
  border: '2px solid var(--anime-ink)',
  borderTop: `6px solid ${color}`,
  '& strong': {
    color,
    textTransform: 'uppercase',
    fontWeight: 900,
    textShadow: 'none',
  },
  '& span': {
    color: 'rgba(33,29,26,0.82)',
    fontSize: '0.76rem',
    fontWeight: 800,
  },
  '& small': {
    color: 'rgba(33,29,26,0.58)',
    fontWeight: 800,
  },
  '& p': {
    margin: 0,
    color: 'rgba(33,29,26,0.68)',
    fontSize: '0.68rem',
    lineHeight: 1.25,
  },
}));
