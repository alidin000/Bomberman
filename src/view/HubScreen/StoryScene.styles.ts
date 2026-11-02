import styled from '@emotion/styled';
import { Dialog } from '@mui/material';
import { styled as muiStyled } from '@mui/material/styles';
import { textStyles, transition } from '../../theme/tokens';

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
    // The house dialog lays scroll paper over its colour: the scene is ink.
    backgroundImage: 'none',
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
  padding: 12px 16px 8px;
  /* design-system: allow a divider under the scene header */
  border-bottom: 3px solid var(--scene-accent);

  & h2 {
    ${textStyles.heading5}
    margin: 0;
  }

  & small {
    ${textStyles.caption3}
    color: var(--anime-paper-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
`;

// Speed lines from below, over a cel-shaded burst in the village's colour:
// three hard-edged rings that dim outward, in place of a soft glow.
export const SceneStage = styled.div`
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  height: clamp(150px, 34dvh, 300px);
  padding: 8px 16px 0;
  overflow: hidden;
  background:
    repeating-conic-gradient(from 0deg at 50% 120%,
      rgba(255, 248, 231, 0.07) 0deg 4deg, transparent 4deg 11deg),
    radial-gradient(circle at 50% 110%,
      var(--scene-accent) 0 24%,
      color-mix(in srgb, var(--scene-accent) 62%, var(--anime-night)) 24% 40%,
      color-mix(in srgb, var(--scene-accent) 30%, var(--anime-night)) 40% 56%,
      transparent 56%);

  @media (max-width: 560px) {
    padding: 8px 8px 0;
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
  transition: ${transition(['transform'], ['opacity', 'filter'])};

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
  padding: 24px 16px 12px;
  color: var(--anime-ink);
  background: var(--anime-paper-light);
  /* design-system: allow a divider between the stage and the speech */
  border-top: 3px solid var(--anime-ink);
`;

// The speaker's ink plate, led by a diamond in the village's colour.
export const NamePlate = styled.p`
  display: flex;
  align-items: center;
  gap: 8px;
  position: absolute;
  top: -16px;
  left: 16px;
  margin: 0;
  padding: 4px 12px;
  color: var(--anime-paper-light);
  background: var(--anime-ink);
  font-family: var(--font-display);
  font-size: var(--text-base);
  line-height: var(--leading-base);
  font-weight: 400;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  &::before {
    content: "";
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    background: var(--scene-accent);
    transform: rotate(45deg);
  }

  &[data-side="right"] {
    left: auto;
    right: 16px;
  }
`;

export const SpeechText = styled.p`
  ${textStyles.body1}
  min-height: 48px;

  & .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  margin: 0 0 12px;
`;

export const SceneActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;

  & > span {
    ${textStyles.caption3}
    margin-right: auto;
    color: var(--ink-2);
  }
`;
