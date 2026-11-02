import styled from '@emotion/styled';
import { styled as muiStyled } from '@mui/material/styles';
import { StyledDialog } from '../../ConfigScreen/ConfigScreen.styles';
import { space, textStyles } from '../../../theme/tokens';

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
    margin: `${space[75]}px ${space[75]}px ${space[100]}px`,
    padding: `${space[200]}px ${space[200]}px 0`,
  },
  '& .MuiDialogTitle-root': {
    minWidth: 220,
    fontSize: 'var(--text-base)',
    lineHeight: 'var(--leading-base)',
  },
});

export const RoleLine = styled.p`
  ${textStyles.caption3}
  margin: 0;
  color: var(--ink-2);
  text-transform: uppercase;
`;

export const OverlayLead = styled.p`
  ${textStyles.body6}
  margin: 0 0 ${space[75]}px;
  color: var(--anime-ink);
`;

// Nothing to do here (solo-only props in a co-op square, or an empty
// board): a short title and one line in a dashed box, as the hub marks
// what is not open yet. The Close button under it is the way on.
export const ClosedNote = styled.p`
  ${textStyles.body6}
  display: grid;
  gap: ${space[25]}px;
  margin: ${space[50]}px 0 ${space[75]}px;
  padding: ${space[75]}px ${space[100]}px;
  color: var(--ink-3);
  border: 2px dashed var(--ink-2);

  & strong {
    ${textStyles.title4}
    color: var(--anime-ink);
  }
`;

export const RequestMeta = styled.small`
  display: block;
`;

export const PriceWas = styled.s`
  margin-right: ${space[50]}px;
  color: var(--ink-2);
`;

// One objective per line after an olive square: hollow and struck through
// once it is done.
export const BriefingList = styled.ul`
  display: grid;
  gap: ${space[50]}px;
  margin: 0 0 ${space[75]}px;
  padding: 0;
  list-style: none;

  & li {
    ${textStyles.body4}
    display: flex;
    align-items: baseline;
    gap: ${space[75]}px;
  }

  & li::before {
    content: '';
    flex: 0 0 auto;
    width: 10px;
    height: 10px;
    background: var(--anime-olive);
    border: 2px solid var(--anime-olive);
  }

  & li[data-done='true'] {
    color: var(--ink-2);
    text-decoration: line-through;
  }

  & li[data-done='true']::before {
    background: transparent;
  }
`;

export const OverlayActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: ${space[75]}px;
  margin: ${space[100]}px 0;
`;
