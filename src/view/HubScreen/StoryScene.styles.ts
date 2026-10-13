import styled from '@emotion/styled';
import { Dialog } from '@mui/material';
import { styled as muiStyled } from '@mui/material/styles';

// A story scene: ink panel with speed lines behind two portraits, and a
// paper speech box along the bottom, like an anime's dialogue card.
export const SceneDialog = muiStyled(Dialog)({
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(14, 12, 10, 0.86)',
  },
  '& .MuiDialog-paper': {
    width: 860,
    maxWidth: 'calc(100vw - 16px)',
    maxHeight: 'calc(100dvh - 16px)',
    margin: 8,
    overflow: 'hidden',
    borderRadius: 'var(--radius)',
    color: 'var(--anime-paper-light)',
    backgroundColor: 'var(--anime-night)',
    border: '3px solid var(--anime-ink)',
    boxShadow: 'var(--shadow-frame)',
  },
});

export const SceneHeader = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 12px;
  padding: 10px 16px 6px;
  border-bottom: 3px solid var(--scene-accent);

  & h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  & small {
    color: rgba(255, 248, 231, 0.82);
    font-size: 0.74rem;
    font-weight: 800;
    text-transform: uppercase;
  }
`;

export const SceneStage = styled.div`
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  height: clamp(150px, 34dvh, 300px);
  padding: 8px 18px 0;
  overflow: hidden;
  background:
    repeating-conic-gradient(from 0deg at 50% 120%,
      rgba(255, 248, 231, 0.07) 0deg 4deg, transparent 4deg 11deg),
    radial-gradient(circle at 50% 110%, var(--scene-accent) 0, transparent 62%);

  @media (max-width: 560px) {
    padding: 6px 6px 0;
  }
`;

export const SceneSpeaker = styled.figure<{ active: boolean }>`
  display: flex;
  flex: 0 1 46%;
  align-items: flex-end;
  justify-content: center;
  height: 100%;
  min-width: 0;
  margin: 0;
  opacity: ${(props) => (props.active ? 1 : 0.42)};
  filter: ${(props) => (props.active ? 'none' : 'grayscale(0.6)')};
  transform: translateY(${(props) => (props.active ? '0' : '6px')});
  transition: opacity 160ms ease, transform 160ms ease, filter 160ms ease;

  & svg {
    width: 100%;
    height: 100%;
    filter: drop-shadow(4px 0 0 rgba(0, 0, 0, 0.45));
  }

  :root[data-contrast="more"] & {
    opacity: ${(props) => (props.active ? 1 : 0.7)};
  }
`;

export const SpeechBox = styled.div`
  position: relative;
  margin: 0;
  padding: 18px 16px 12px;
  color: var(--anime-ink);
  background: var(--anime-paper-light);
  border-top: 3px solid var(--anime-ink);
`;

export const NamePlate = styled.p`
  position: absolute;
  top: -15px;
  left: 14px;
  margin: 0;
  padding: 3px 14px;
  color: var(--anime-paper-light);
  background: var(--anime-ink);
  border-left: 6px solid var(--scene-accent);
  font-size: 0.82rem;
  font-weight: 900;
  text-transform: uppercase;

  &[data-side="right"] {
    left: auto;
    right: 14px;
    border-left: none;
    border-right: 6px solid var(--scene-accent);
  }
`;

export const SpeechText = styled.p`
  min-height: 3.2em;

  & .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  margin: 0 0 10px;
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.45;

  @media (max-width: 560px) {
    font-size: 0.95rem;
  }
`;

export const SceneActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;

  & > span {
    margin-right: auto;
    color: var(--ink-2);
    font-size: 0.78rem;
    font-weight: 800;
  }
`;
