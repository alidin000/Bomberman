import styled from '@emotion/styled';
import { Dialog } from '@mui/material';

const panelCut = 'none';
const chipCut = 'none';

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
  // orange offset, and faint ink speed lines bursting from the banner.
  '& .MuiDialog-paper': {
    position: 'relative',
    width: '480px',
    maxWidth: '92vw',
    padding: '30px 24px 26px',
    borderRadius: 2,
    clipPath: panelCut,
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
      inset: '11px 0 auto',
      height: 150,
      pointerEvents: 'none',
      backgroundImage: 'repeating-conic-gradient(from 0deg at 50% 36px, '
        + 'rgba(23,18,15,0.09) 0deg 1.6deg, rgba(23,18,15,0) 1.6deg 6deg)',
      WebkitMaskImage: 'linear-gradient(#000, transparent)',
      maskImage: 'linear-gradient(#000, transparent)',
    },
  },
  '& .MuiButton-root': {
    borderRadius: 2,
    clipPath: chipCut,
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    fontSize: '1.08rem',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
  },
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
  top: 18px;
  right: 14px;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  color: var(--anime-vermilion);
  border: 3px solid var(--anime-vermilion);
  border-radius: 6px;
  font-family: var(--font-brush);
  font-size: 2.1rem;
  line-height: 1;
  transform: rotate(-12deg);
  opacity: 0.88;
  pointer-events: none;

  @media (max-width: 420px) {
    top: 14px;
    right: 8px;
    width: 40px;
    height: 40px;
    font-size: 1.6rem;
  }
`;

// The result in display type on a brush stroke of the winner's colour, over
// a ragged ink stroke offset like a hard shadow.
export const ResultBanner = styled.h2<{ accent: string; textColor?: string }>`
  position: relative;
  isolation: isolate;
  width: fit-content;
  min-width: 240px;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 8px 40px 9px;
  color: ${(props) => props.textColor ?? 'var(--anime-ink)'};
  font-family: var(--font-display);
  font-size: 1.7rem;
  font-weight: 400;
  line-height: 1.1;
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
`;

export const ResultMessage = styled.p`
  max-width: 380px;
  margin: 14px auto 0;
  color: rgba(33, 29, 26, 0.86);
  font-size: 0.95rem;
  line-height: 1.55;
`;

export const ResultBreakdown = styled.div`
  margin-top: 16px;
  padding: 12px;
  background: var(--anime-paper);
  border: 2px solid var(--anime-ink);
  text-align: left;

  h3 {
    margin: 0 0 8px;
    color: var(--anime-teal);
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  th, td {
    padding: 6px 5px;
    border-bottom: 1px solid rgba(33, 29, 26, 0.18);
    text-align: left;
    vertical-align: top;
  }

  th {
    color: rgba(33, 29, 26, 0.82);
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  td {
    color: var(--anime-ink);
    font-weight: 700;
  }

  td small {
    display: block;
    margin-top: 2px;
    color: rgba(33, 29, 26, 0.82);
    font-size: 0.75rem;
    font-weight: 800;
  }
`;

export const ResultPips = styled.span`
  display: inline-flex;
  gap: 4px;
  padding-top: 2px;
`;

// Filled per round won: shape and fill, not colour, carry the score.
export const ResultPip = styled('span', {
  shouldForwardProp: (prop) => prop !== 'filled',
})<{ filled: boolean }>`
  width: 14px;
  height: 14px;
  box-sizing: border-box;
  border-radius: 50%;
  border: 2px solid var(--anime-ink);
  background: ${(props) => (props.filled ? 'var(--anime-ink)' : 'var(--anime-paper-light)')};
`;

// Slot colour down the left edge; the winner's row is bold on mustard.
export const ResultRow = styled('tr', {
  shouldForwardProp: (prop) => prop !== 'slotColor' && prop !== 'winner',
})<{ slotColor: string; winner: boolean }>`
  background: ${(props) => (props.winner ? 'rgba(245, 130, 31, 0.24)' : 'transparent')};

  td:first-of-type {
    border-left: 5px solid ${(props) => props.slotColor};
    font-weight: 900;
  }

  td {
    font-weight: ${(props) => (props.winner ? 900 : 700)};
  }
`;

export const ResultIntel = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;

  span {
    display: grid;
    gap: 2px;
    padding: 7px;
    color: rgba(33, 29, 26, 0.82);
    background: var(--anime-paper);
    font-size: 0.75rem;
    font-weight: 800;
    text-align: center;
    text-transform: uppercase;
  }

  strong {
    color: #8f2f26;
    font-size: 0.86rem;
  }
`;

export const ResultActions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  margin-top: 20px;
`;
