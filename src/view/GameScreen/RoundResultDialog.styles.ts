import styled from '@emotion/styled';
import { Dialog } from '@mui/material';

const panelCut = 'none';
const chipCut = 'none';
const bannerCut = 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)';

export type ResultTone = 'victory' | 'defeat' | 'neutral';

export const RESULT_TONE_ACCENTS: Record<ResultTone, string> = {
  victory: '#667158',
  defeat: '#bd3f32',
  neutral: '#d4a33f',
};

export const StyledResultDialog = styled(Dialog)({
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(33, 29, 26, 0.82)',
  },
  '& .MuiDialog-paper': {
    width: '480px',
    maxWidth: '92vw',
    padding: '22px 24px 26px',
    borderRadius: 2,
    clipPath: panelCut,
    color: 'var(--anime-ink)',
    textAlign: 'center',
    background: 'var(--anime-paper-light)',
    border: '3px solid var(--anime-ink)',
    boxShadow: '8px 8px 0 var(--anime-vermilion)',
  },
  '& .MuiButton-root': {
    borderRadius: 2,
    clipPath: chipCut,
    fontWeight: 900,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  '& .MuiButton-contained': {
    background: 'var(--anime-vermilion)',
    color: 'var(--anime-paper-light)',
    border: '2px solid var(--anime-ink)',
    boxShadow: '3px 3px 0 var(--anime-ink)',
  },
  '& .MuiButton-contained:hover': {
    background: '#d65343',
  },
  '& .MuiButton-outlined': {
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-ink)',
  },
  '& .MuiButton-outlined:hover': {
    borderColor: 'var(--anime-ink)',
    background: 'rgba(212,163,63,0.18)',
  },
});

export const ResultBanner = styled.h2<{ accent: string }>`
  width: fit-content;
  min-width: 240px;
  margin: 0 auto;
  padding: 9px 38px 10px;
  clip-path: ${bannerCut};
  color: var(--anime-ink);
  background: ${(props) => props.accent};
  font-size: 1.12rem;
  font-weight: 900;
  letter-spacing: 0;
  text-align: center;
  text-transform: uppercase;
  box-shadow: 4px 4px 0 var(--anime-ink);
`;

export const ResultEmblem = styled.div<{ accent: string }>`
  width: 54px;
  height: 54px;
  margin: 18px auto 0;
  clip-path: polygon(50% 0, 96% 24%, 96% 76%, 50% 100%, 4% 76%, 4% 24%);
  background: ${(props) => props.accent};
  border: 3px solid var(--anime-ink);
  box-shadow: 4px 4px 0 var(--anime-mustard);
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
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.76rem;
  }

  th, td {
    padding: 6px 5px;
    border-bottom: 1px solid rgba(33, 29, 26, 0.18);
    text-align: left;
    vertical-align: top;
  }

  th {
    color: rgba(33, 29, 26, 0.82);
    font-size: 0.64rem;
    text-transform: uppercase;
  }

  td {
    color: var(--anime-ink);
    font-weight: 700;
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
    font-size: 0.62rem;
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
