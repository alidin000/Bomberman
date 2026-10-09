import React, { useMemo } from 'react';
import { DOJO_ROOMS } from '../../content/dojo';
import { DojoRoom } from '../../content/dojoRooms';
import {
  ControlLabelSource,
  GAMEPAD_LABEL_SOURCE,
  controlPromptText,
  controlPrompts,
  keyboardLabelSource,
} from '../../content/dojoControls';
import { KeyBindings } from '../../constants/props';
import { EngineSelector, EngineStore, useEngineSelector } from '../../hooks/engineStore';
import { firstOpenTrainingGoal } from '../../engine/training';
import { hudZoom } from '../GameScreen/scene/cameraFraming';
import { useViewportSize } from '../GameScreen/useViewportSize';
import {
  DojoBand,
  DojoBandHeader,
  DojoBandRoot,
  DojoControlRow,
  DojoGoalLine,
  DojoGoalText,
  DojoKey,
} from './DojoGoalBand.styles';

/** The step the player is on: the first goal that does not hold yet. */
export const selectDojoStep: EngineSelector<number> = (state) => (
  state ? firstOpenTrainingGoal(state) : 0
);

/** Where prompts read their key names: the player's keys, then the pad. */
export function dojoLabelSources(keyBindings: KeyBindings): ControlLabelSource[] {
  return [keyboardLabelSource(keyBindings, 1), GAMEPAD_LABEL_SOURCE];
}

type DojoGoalBandProps = {
  room: DojoRoom;
  store: EngineStore;
  keyBindings: KeyBindings;
  hudScale: number;
};

/**
 * The room's one-line goal with the player's own controls. It follows the
 * room's steps (Scroll and Sentry has two), and re-renders only when the
 * step changes, never per tick.
 */
export function DojoGoalBand({
  room, store, keyBindings, hudScale,
}: DojoGoalBandProps) {
  const viewport = useViewportSize();
  const zoom = hudZoom(hudScale, viewport.width, viewport.height);
  const stepIndex = useEngineSelector(store, selectDojoStep);
  const step = room.steps[Math.min(stepIndex, room.steps.length - 1)];
  const prompts = useMemo(
    () => controlPrompts(step.controls, dojoLabelSources(keyBindings)),
    [keyBindings, step]
  );
  const [first] = prompts;
  const stepLabel = room.steps.length > 1
    ? ` · Step ${Math.min(stepIndex + 1, room.steps.length)} of ${room.steps.length}`
    : '';

  return (
    <DojoBandRoot hudZoom={zoom}>
      <DojoBand aria-label="dojo goal">
        <DojoBandHeader>
          <strong>{`Room ${room.order} of ${DOJO_ROOMS.length}`}</strong>
          <span>{`${room.name} · ${room.instructor}${stepLabel}`}</span>
        </DojoBandHeader>
        {/* One reading for every layout, again whenever the step changes. */}
        <p className="visually-hidden" aria-live="polite">
          {[step.prompt, ...prompts.map(controlPromptText)].join('. ')}
        </p>
        <DojoGoalText aria-hidden="true">{step.prompt}</DojoGoalText>
        <DojoControlRow aria-hidden="true">
          {prompts.map((prompt) => (
            <li key={prompt.control}>
              <span>{prompt.name}</span>
              {prompt.labels.map((label) => (
                <DojoKey key={label.device}>{label.text}</DojoKey>
              ))}
            </li>
          ))}
        </DojoControlRow>
        <DojoGoalLine aria-hidden="true">
          {step.short}
          {first?.labels.map((label) => (
            <DojoKey key={label.device}>{label.text}</DojoKey>
          ))}
        </DojoGoalLine>
      </DojoBand>
    </DojoBandRoot>
  );
}
