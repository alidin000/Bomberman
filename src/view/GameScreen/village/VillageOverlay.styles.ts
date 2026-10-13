import styled from '@emotion/styled';
import { styled as muiStyled } from '@mui/material/styles';
import { StyledDialog } from '../../ConfigScreen/ConfigScreen.styles';

// The house dialog frame, narrower and shorter than the Mission Deck's,
// along the bottom edge over a lighter backdrop: the camera keeps your
// shinobi near the middle, so the square and the person you talk to stay
// in view above it.
export const VillageDialog = muiStyled(StyledDialog)({
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(33, 29, 26, 0.32)',
  },
  '& .MuiDialog-container': {
    alignItems: 'flex-end',
  },
  '& .MuiDialog-paper': {
    width: 600,
    minHeight: 0,
    maxHeight: 'calc(100dvh - 24px)',
    margin: '8px 8px 12px',
    padding: '14px 16px 0',
  },
  '& .MuiDialogTitle-root': {
    minWidth: 220,
    fontSize: '1rem',
  },
});

export const RoleLine = styled.p`
  margin: 0;
  color: var(--ink-2);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
`;

export const OverlayLead = styled.p`
  margin: 0 0 8px;
  color: var(--anime-ink);
  font-size: 0.88rem;
  line-height: 1.45;
`;

// Solo-only props in a co-op square: a dashed hairline, as the hub marks
// what is not open yet.
export const ClosedNote = styled.p`
  margin: 4px 0 8px;
  padding: 6px 10px;
  color: var(--ink-3);
  border-left: 4px dashed var(--ink-2);
  font-size: 0.88rem;
  font-weight: 800;
`;

export const RequestMeta = styled.small`
  display: block;
`;

export const PriceWas = styled.s`
  margin-right: 4px;
  color: var(--ink-2);
`;

export const BriefingList = styled.ul`
  display: grid;
  gap: 4px;
  margin: 0 0 8px;
  padding: 0;
  list-style: none;

  & li {
    padding-left: 12px;
    border-left: 4px solid var(--anime-olive);
    font-size: 0.9rem;
    font-weight: 800;
  }

  & li[data-done='true'] {
    color: var(--ink-2);
    border-left-style: dashed;
    text-decoration: line-through;
  }
`;

export const OverlayActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin: 10px 0 12px;
`;
