import styled from '@emotion/styled';
import { Dialog } from '@mui/material';
import {
  radius, space, textStyles,
} from '../../theme/tokens';

export type ResultTone = 'victory' | 'defeat' | 'neutral';

export const RESULT_TONE_ACCENTS: Record<ResultTone, string> = {
  victory: '#f5821f',
  defeat: '#b8281d',
  neutral: '#e0a526',
};

// Banner text on each tone: ink on orange (7.2:1) and gold, paper-light on
// vermilion (6:1; ink there was 3:1).
export const RESULT_TONE_TEXT: Record<ResultTone, string> = {
  victory: 'var(--anime-ink)',
  defeat: 'var(--anime-paper-light)',
  neutral: 'var(--anime-ink)',
};

/** The seal stamped on a result: 勝 for a win, 敗 for a loss, none for a draw. */
export function resultSeal(
  tone: ResultTone,
  versus: boolean,
  winnerSlot: number | null
): string | null {
  if (versus) return winnerSlot !== null ? '勝' : null;
  if (tone === 'victory') return '勝';
  if (tone === 'defeat') return '敗';
  return null;
}

// Between rounds the backdrop stays light, so the frozen arena (and the
// blast that decided the round) shows behind the tally. No blur: a
// backdrop-filter over the canvas re-blurs the WebGL frame every frame.
export const StyledResultDialog = styled(Dialog, {
  shouldForwardProp: (prop) => prop !== 'betweenRounds',
})<{ betweenRounds?: boolean }>(({ betweenRounds }) => ({
  '& .MuiBackdrop-root': {
    backgroundColor: betweenRounds ? 'rgba(18, 13, 11, 0.45)' : 'rgba(18, 13, 11, 0.78)',
  },
  // A scroll card: paper, a wooden rod across the top, ink keyline, a hard
  // orange offset, and faint ink speed lines bursting from the banner (hard
  // edged, faded out by a mask).
  '& .MuiDialog-paper': {
    position: 'relative',
    width: '480px',
    maxWidth: '92vw',
    // The rod (11 px) plus 21 px of paper above the banner.
    padding: `${space[400]}px ${space[300]}px ${space[300]}px`,
    borderRadius: radius.sm,
    color: 'var(--anime-ink)',
    textAlign: 'center',
    backgroundColor: 'var(--anime-paper-light)',
    backgroundImage: 'var(--scroll-rod), var(--scroll-paper)',
    backgroundSize: '100% 11px, 100% 100%, auto, 100% 100%',
    backgroundRepeat: 'no-repeat, no-repeat, repeat, no-repeat',
    border: '3px solid var(--anime-ink)',
    boxShadow: '8px 8px 0 var(--anime-orange)',
    '&::before': {
      content: "''",
      position: 'absolute',
      // design-system: allow sits under the 11 px scroll rod
      inset: '11px 0 auto',
      height: 150,
      pointerEvents: 'none',
      backgroundImage: 'repeating-conic-gradient(from 0deg at 50% 36px, '
        + 'rgba(23,18,15,0.09) 0deg 1.6deg, rgba(23,18,15,0) 1.6deg 6deg)',
      WebkitMaskImage: 'linear-gradient(#000, transparent)',
      maskImage: 'linear-gradient(#000, transparent)',
    },
    '@media (max-width: 420px)': {
      padding: `${space[400]}px ${space[200]}px ${space[200]}px`,
    },
  },
  '& .MuiButton-root': {
    ...textStyles.buttonMd,
    borderRadius: radius.sm,
  },
  '& .MuiButton-sizeLarge': textStyles.buttonLg,
  '& .MuiButton-contained': {
    background: 'var(--action)',
    color: 'var(--on-action)',
    border: '2px solid var(--anime-ink)',
    boxShadow: '3px 3px 0 var(--anime-ink)',
  },
  '& .MuiButton-contained:hover': {
    background: 'var(--action-deep)',
  },
  '& .MuiButton-outlined': {
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-ink)',
  },
  '& .MuiButton-outlined:hover': {
    borderColor: 'var(--anime-ink)',
    background: 'rgba(245,130,31,0.16)',
  },
}));

// A red seal in the corner, the way a scroll is stamped: 勝 (victory) or 敗
// (defeat). Decoration only; the banner says the result in words.
export const ResultStamp = styled.span`
  position: absolute;
  top: ${space[200]}px;
  right: ${space[200]}px;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  color: var(--anime-vermilion);
  border: 3px solid var(--anime-vermilion);
  border-radius: var(--radius-md);
  font-family: var(--font-brush);
  font-size: var(--text-3xl);
  font-weight: 400;
  line-height: 1;
  transform: rotate(-12deg);
  opacity: 0.88;
  pointer-events: none;

  @media (max-width: 420px) {
    top: ${space[100]}px;
    right: ${space[75]}px;
    width: 40px;
    height: 40px;
    font-size: var(--text-2xl);
  }
`;

// The result in display type on a brush stroke of the winner's colour, over
// a ragged ink stroke offset like a hard shadow.
export const ResultBanner = styled.h2<{ accent: string; textColor?: string }>`
  ${textStyles.heading5}
  position: relative;
  isolation: isolate;
  width: fit-content;
  min-width: 240px;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: ${space[75]}px ${space[500]}px;
  color: ${(props) => props.textColor ?? 'var(--anime-ink)'};
  letter-spacing: 0.06em;
  text-align: center;
  text-transform: uppercase;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    -webkit-mask-image: var(--brush-swash);
    mask-image: var(--brush-swash);
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }

  &::before {
    transform: translate(5px, 5px);
    background: var(--anime-ink);
  }

  &::after {
    background: ${(props) => props.accent};
  }

  @media (max-width: 420px) {
    min-width: 0;
    padding: ${space[75]}px ${space[300]}px;
  }
`;

export const ResultMessage = styled.p`
  ${textStyles.body3}
  max-width: 380px;
  margin: ${space[200]}px auto 0;
  color: rgba(33, 29, 26, 0.86);
`;

export const ResultBreakdown = styled.div`
  margin-top: ${space[200]}px;
  padding: ${space[100]}px;
  background: var(--anime-paper);
  border: 2px solid var(--anime-ink);
  text-align: left;

  h3 {
    ${textStyles.buttonMd}
    margin: 0 0 ${space[75]}px;
    color: var(--anime-teal);
  }

  table {
    ${textStyles.body5}
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: ${space[75]}px ${space[50]}px;
    /* design-system: allow dividers between the rows of the results table */
    border-bottom: 1px solid rgba(33, 29, 26, 0.18);
    text-align: left;
    vertical-align: top;
  }

  th {
    ${textStyles.caption3}
    color: rgba(33, 29, 26, 0.82);
    text-transform: uppercase;
  }

  td {
    color: var(--anime-ink);
  }

  td small {
    ${textStyles.caption4}
    display: block;
    margin-top: ${space[25]}px;
    color: rgba(33, 29, 26, 0.82);
  }
`;

export const ResultPips = styled.span`
  display: inline-flex;
  gap: ${space[50]}px;
  padding-top: ${space[25]}px;
`;

// Filled per round won: shape and fill, not colour, carry the score.
export const ResultPip = styled('span', {
  shouldForwardProp: (prop) => prop !== 'filled',
})<{ filled: boolean }>`
  width: 14px;
  height: 14px;
  box-sizing: border-box;
  border-radius: var(--radius-full);
  border: 2px solid var(--anime-ink);
  background: ${(props) => (props.filled ? 'var(--anime-ink)' : 'var(--anime-paper-light)')};
`;

// A square of the slot colour before the name; the winner's row is
// stronger on an orange tint.
export const ResultRow = styled('tr', {
  shouldForwardProp: (prop) => prop !== 'slotColor' && prop !== 'winner',
})<{ slotColor: string; winner: boolean }>`
  background: ${(props) => (props.winner ? 'rgba(245, 130, 31, 0.24)' : 'transparent')};

  td:first-of-type {
    font-weight: ${textStyles.body4.fontWeight};
  }

  td:first-of-type::before {
    content: '';
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: ${space[75]}px;
    background: ${(props) => props.slotColor};
    border: 1px solid var(--anime-ink);
    vertical-align: -1px;
  }

  td {
    font-weight: ${(props) => (props.winner ? textStyles.body4.fontWeight : textStyles.body5.fontWeight)};
  }
`;

export const ResultIntel = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${space[75]}px;
  margin-top: ${space[100]}px;

  span {
    ${textStyles.caption3}
    display: grid;
    gap: ${space[25]}px;
    padding: ${space[75]}px;
    color: rgba(33, 29, 26, 0.82);
    background: var(--anime-paper-light);
    border: 1px solid rgba(33, 29, 26, 0.3);
    text-align: center;
    text-transform: uppercase;
  }

  strong {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    line-height: var(--leading-xl);
    font-weight: 400;
    letter-spacing: 0.04em;
    color: #8f2f26;
  }
`;

export const ResultActions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${space[100]}px;
  margin-top: ${space[300]}px;
`;
