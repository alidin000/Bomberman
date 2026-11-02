import styled from '@emotion/styled';
import { textStyles } from '../../theme/tokens';

const PHONE = '@media (max-width: 640px)';

// The Mission Deck's button roles: orange (ink type) is the action colour,
// ink outlines the rest (vermilion stays for danger).
export const DOJO_BUTTON_RULES = {
  '& .MuiButton-root': {
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  '& .MuiButton-contained, & .MuiButton-contained.Mui-focusVisible': {
    color: 'var(--on-action)',
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
    background: 'rgba(245,130,31,0.16)',
  },
};

// The dojo's welcome, led by a brush 道 seal in mustard (decoration: its
// alt text is empty).
export const DojoIntro = styled('p')({
  ...textStyles.body2,
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  margin: '0 0 16px',
  padding: '12px 16px',
  color: 'var(--ink-3)',
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  '&::before': {
    content: '"道" / ""',
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 auto',
    width: 40,
    height: 40,
    color: 'var(--anime-mustard)',
    background: 'var(--anime-ink)',
    fontFamily: 'var(--font-brush)',
    fontSize: 'var(--text-2xl)',
    lineHeight: 'var(--leading-2xl)',
    fontWeight: 400,
  },
  // A tall paragraph on a phone: the seal stays by its first line.
  [PHONE]: { alignItems: 'flex-start' },
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
  // Status shows in the badge (word and fill) and, once cleared, the
  // olive wash; the room to play next stands on an orange offset.
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
  gap: 8,
  minWidth: 0,
  padding: 12,
  background: status === 'cleared' ? 'rgba(102, 113, 88, 0.14)' : 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  boxShadow: current ? '4px 4px 0 var(--anime-orange)' : 'var(--shadow-1)',
  '& h3': {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--text-xl)',
    lineHeight: 'var(--leading-xl)',
    fontWeight: 400,
    letterSpacing: '0.05em',
  },
  '& p': {
    ...textStyles.body5,
    margin: 0,
    color: 'var(--ink-2)',
  },
  [PHONE]: {
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gridTemplateRows: 'auto auto',
    alignItems: 'center',
    columnGap: 12,
    padding: '8px 12px',
    '& > span:first-of-type': { gridColumn: '1 / -1' },
    '& p': { display: 'none' },
  },
}));

export const DojoRoomBadge = styled('span', {
  shouldForwardProp: (prop) => prop !== 'status',
})<{ status: 'cleared' | 'skipped' | 'new' }>(({ status }) => ({
  ...textStyles.caption3,
  justifySelf: 'start',
  padding: '2px 8px',
  color: status === 'cleared' ? 'var(--anime-paper-light)' : 'var(--anime-ink)',
  background: status === 'cleared' ? 'var(--anime-olive)' : 'var(--anime-paper-light)',
  border: '2px solid var(--anime-ink)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}));

export const DojoActions = styled('div')({
  ...DOJO_BUTTON_RULES,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: 12,
  width: '100%',
});
