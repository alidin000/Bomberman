// A story scene between the hub and the match: one line at a time under the
// two speakers' portraits. Next (Enter, Space, pad A, a tap) moves on, Back
// goes back, and Skip (Escape, pad B) ends it at once. The hub marks it seen
// either way, so it plays once; the hub can replay it.
import React, { CSSProperties, useMemo, useState } from 'react';
import { Button } from '@mui/material';
import { CAST, type CastId } from '../../content/animeCast';
import type { StoryScene as StorySceneData } from '../../content/storyScenes';
import { CastPortrait } from '../portraits/CastPortrait';
import { keepRovingStopOnFocus, moveFocusWithArrows } from '../ConfigScreen/menuNavigation';
import {
  NamePlate,
  SceneActions,
  SceneDialog,
  SceneHeader,
  SceneSpeaker,
  SceneStage,
  SpeechBox,
  SpeechText,
} from './StoryScene.styles';

export type SceneEnd = 'finished' | 'skipped';

export interface StorySceneProps {
  scene: StorySceneData;
  villageName: string;
  accent: string;
  // The last line's button: "Start mission" before a deploy, else "Done".
  finishLabel: string;
  onDone: (end: SceneEnd) => void;
}

/** Who stands on the left (the first speaker) and the right at line `index`. */
export function sceneSides(
  scene: StorySceneData,
  index: number
): { left: CastId; right: CastId | null } {
  const left = scene.lines[0].speaker;
  const spoken = scene.lines.slice(0, index + 1).map((line) => line.speaker);
  const others = spoken.filter((speaker) => speaker !== left);
  const right = others[others.length - 1]
    ?? scene.lines.find((line) => line.speaker !== left)?.speaker
    ?? null;
  return { left, right };
}

export const StoryScene = ({
  scene, villageName, accent, finishLabel, onDone,
}: StorySceneProps) => {
  const [index, setIndex] = useState(0);
  const line = scene.lines[index];
  const last = index === scene.lines.length - 1;
  const { left, right } = useMemo(() => sceneSides(scene, index), [scene, index]);
  const side = line.speaker === left ? 'left' : 'right';
  const speaker = CAST[line.speaker];
  const titleId = `story-${scene.id.replace(':', '-')}`;

  return (
    <SceneDialog
      open
      aria-labelledby={titleId}
      onClose={(_event, reason) => {
        if (reason === 'escapeKeyDown') onDone('skipped');
      }}
      PaperProps={{
        onKeyDown: moveFocusWithArrows,
        onFocus: keepRovingStopOnFocus,
        style: { '--scene-accent': accent } as CSSProperties,
      }}
    >
      <SceneHeader>
        <h2 id={titleId}>{scene.title}</h2>
        <small>{`${villageName} · ${scene.part === 'before' ? 'Before the mission' : 'After the victory'}`}</small>
      </SceneHeader>
      <SceneStage aria-hidden="true">
        <SceneSpeaker active={line.speaker === left}>
          <CastPortrait id={left} labelled={false} />
        </SceneSpeaker>
        {right && (
          <SceneSpeaker active={line.speaker === right}>
            <CastPortrait id={right} labelled={false} flip />
          </SceneSpeaker>
        )}
      </SceneStage>
      <SpeechBox>
        <NamePlate data-side={side}>{speaker.name}</NamePlate>
        <SpeechText aria-live="polite">
          <span className="visually-hidden">{`${speaker.name}: `}</span>
          {line.text}
        </SpeechText>
        <SceneActions>
          <span>{`${index + 1} / ${scene.lines.length}`}</span>
          <Button variant="text" onClick={() => onDone('skipped')}>Skip scene</Button>
          {index > 0 && (
            <Button variant="outlined" onClick={() => setIndex(index - 1)}>Back</Button>
          )}
          <Button
            // Next has focus on arrival, so Enter, Space or pad A moves on.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            variant="contained"
            onClick={() => (last ? onDone('finished') : setIndex(index + 1))}
          >
            {last ? finishLabel : 'Next'}
          </Button>
        </SceneActions>
      </SpeechBox>
    </SceneDialog>
  );
};
