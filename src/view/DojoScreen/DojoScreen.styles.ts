import styled from '@emotion/styled';

const PHONE = '@media (max-width: 640px)';

// The Mission Deck's button roles: teal is the action colour, ink outlines
// the rest (vermilion stays for danger).
export const DOJO_BUTTON_RULES = {
  '& .MuiButton-root': {
    fontWeight: 900,
    textTransform: 'uppercase' as const,
  },
  '& .MuiButton-contained, & .MuiButton-contained.Mui-focusVisible': {
    color: 'var(--anime-paper-light)',
    background: 'var(--action)',
    border: '2px solid var(--anime-ink)',
    boxShadow: 'var(--shadow-1)',
  },
  '& .MuiButton-contained:hover': {
    background: 'var(--action-deep)',
  },
  '& .MuiButton-outlined, & .MuiButton-text': {
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-ink)',
  },
  '& .MuiButton-text': {
    borderColor: 'transparent',
  },
  '& .MuiButton-outlined:hover, & .MuiButton-text:hover': {
    background: 'rgba(53,111,107,0.1)',
  },
};

export const DojoIntro = styled('p')({
  margin: '0 0 14px',
  padding: '12px 16px 12px 18px',
  color: 'var(--ink-3)',
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  borderLeft: '8px solid var(--anime-mustard)',
  fontWeight: 700,
});

export const DojoRoomList = styled('ol')({
  ...DOJO_BUTTON_RULES,
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 12,
  margin: 0,
  padding: 0,
  listStyle: 'none',
  '@media (max-width: 900px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  [PHONE]: {
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: 8,
  },
});

export const DojoRoomCard = styled('li', {
  shouldForwardProp: (prop) => prop !== 'status' && prop !== 'current',
})<{ status: 'cleared' | 'skipped' | 'new'; current: boolean }>(({ status, current }) => ({
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
  gap: 6,
  minWidth: 0,
  padding: '10px 12px 12px',
  background: status === 'cleared' ? 'rgba(102, 113, 88, 0.14)' : 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  borderTop: `6px solid ${status === 'cleared' ? 'var(--anime-olive)' : 'var(--anime-mustard)'}`,
  boxShadow: current ? '4px 4px 0 var(--anime-teal)' : 'var(--shadow-1)',
  '& h3': {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 900,
  },
  '& p': {
    margin: 0,
    color: 'var(--ink-2)',
    fontSize: '0.86rem',
    fontWeight: 700,
  },
  [PHONE]: {
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gridTemplateRows: 'auto auto',
    alignItems: 'center',
    columnGap: 10,
    padding: '8px 10px',
    '& > span:first-of-type': { gridColumn: '1 / -1' },
    '& p': { display: 'none' },
  },
}));

export const DojoRoomBadge = styled('span', {
  shouldForwardProp: (prop) => prop !== 'status',
})<{ status: 'cleared' | 'skipped' | 'new' }>(({ status }) => ({
  justifySelf: 'start',
  padding: '2px 8px',
  color: status === 'cleared' ? 'var(--anime-paper-light)' : 'var(--anime-ink)',
  background: status === 'cleared' ? 'var(--anime-olive)' : 'var(--anime-paper-light)',
  border: '2px solid var(--anime-ink)',
  fontSize: '0.75rem',
  fontWeight: 900,
  textTransform: 'uppercase',
}));

export const DojoActions = styled('div')({
  ...DOJO_BUTTON_RULES,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: 12,
  width: '100%',
});
