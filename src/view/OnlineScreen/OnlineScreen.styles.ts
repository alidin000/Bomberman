import { Box, Button, styled } from '@mui/material';

export const OnlinePage = styled(Box)({
  minHeight: '100dvh',
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-night)',
  padding: 'clamp(20px, 5vw, 56px) 20px',
});

export const OnlineShell = styled(Box)({
  width: 'min(860px, 100%)', margin: '0 auto', display: 'grid', gap: 24,
});

export const OnlineHeader = styled('header')({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 20,
  paddingBottom: 18,
  borderBottom: '1px solid color-mix(in srgb, var(--anime-paper-light) 24%, transparent)',
  '& h1': { margin: 0, fontSize: 'clamp(1.8rem, 5vw, 3rem)', letterSpacing: 0 },
  '& p': { margin: '6px 0 0', color: 'var(--anime-paper-muted)', maxWidth: 560 },
});

export const SetupGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 18,
  '@media (max-width: 700px)': { gridTemplateColumns: '1fr' },
});

export const OnlinePanel = styled('section')({
  border: '1px solid color-mix(in srgb, var(--anime-paper-light) 22%, transparent)',
  background: 'color-mix(in srgb, var(--anime-night) 88%, var(--anime-paper-light))',
  padding: 20,
  borderRadius: 6,
  display: 'grid',
  gap: 16,
  '& h2': { margin: 0, fontSize: '1.05rem', letterSpacing: 0 },
});

export const Field = styled('label')({
  display: 'grid',
  gap: 7,
  fontSize: '.78rem',
  textTransform: 'uppercase',
  letterSpacing: '.08em',
  color: 'var(--anime-paper-muted)',
  '& input': {
    minHeight: 46,
    padding: '10px 12px',
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-ink)',
    border: '1px solid color-mix(in srgb, var(--anime-paper-light) 28%, transparent)',
    borderRadius: 4,
    font: 'inherit',
    letterSpacing: 0,
  },
});

export const CharacterGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  '@media (max-width: 520px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
});

export const CharacterButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'chosen',
})<{ chosen: boolean }>(({ chosen }) => ({
  minHeight: 44,
  borderRadius: 4,
  borderColor: chosen ? 'var(--anime-mustard)' : undefined,
  color: chosen ? 'var(--anime-mustard)' : 'var(--anime-paper-light)',
  background: chosen ? 'color-mix(in srgb, var(--anime-mustard) 12%, transparent)' : undefined,
}));

export const RoomCode = styled('strong')({
  fontFamily: 'var(--anime-mono)',
  fontSize: 'clamp(1.8rem, 8vw, 3.4rem)',
  letterSpacing: '.14em',
  color: 'var(--anime-mustard)',
});

export const PlayerList = styled('ol')({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: 8,
  '& li': {
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 12px',
    background: 'color-mix(in srgb, var(--anime-paper-light) 7%, transparent)',
    borderLeft: '3px solid var(--anime-mustard)',
  },
});

export const OnlineNotice = styled(Box)({
  minHeight: 24, color: 'var(--anime-paper-muted)', fontSize: '.9rem',
});

export const MatchNetworkBar = styled(Box)({
  position: 'fixed',
  zIndex: 40,
  bottom: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  maxWidth: 'calc(100vw - 24px)',
  padding: '8px 12px',
  borderRadius: 4,
  background: 'color-mix(in srgb, var(--anime-ink) 88%, transparent)',
  border: '1px solid color-mix(in srgb, var(--anime-paper-light) 22%, transparent)',
  color: 'var(--anime-paper-light)',
  fontSize: '.78rem',
  whiteSpace: 'nowrap',
});

export const ConnectionCurtain = styled(Box)({
  position: 'fixed',
  zIndex: 70,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 20,
  textAlign: 'center',
  background: 'color-mix(in srgb, var(--anime-night) 76%, transparent)',
  color: 'var(--anime-paper-light)',
});

export const ResultPanel = styled(OnlinePanel)({ width: 'min(420px, 100%)', textAlign: 'center' });
export const CompactButton = styled(Button)({ borderRadius: 4, minHeight: 40 });
