import React, { useEffect, useRef } from 'react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { PlayerSlotController } from '../../engine/types';
import { getControllerLabel } from '../../ai/controllers';
import { CHARACTER_DEFINITIONS, CharacterId } from '../../content';
import RosterBoard from '../../assets/ninja-bomber-roster-board.png';
import {
  playerSlotColor, playerSlotLabel, playerSlotTextColor,
} from '../GameScreen/playerSlots';
import {
  AddSlotButton,
  ControllerChip,
  SlotCard,
  SlotKeys,
  SlotName,
  SlotPicker,
  SlotPickerButton,
  SlotPlate,
  SlotPortrait,
  SlotRemoveButton,
  SlotRow,
} from './ConfigScreen.styles';

export const MIN_LOCAL_PLAYERS = 2;
export const MAX_LOCAL_PLAYERS = 3;

// One press turns a human seat into the usual opponent (CPU Normal); more
// presses walk Hard and Easy, then back to Human.
const CONTROLLER_CYCLE: readonly PlayerSlotController[] = [
  'human',
  'cpu-normal',
  'cpu-hard',
  'cpu-easy',
];

export function nextSlotController(controller: PlayerSlotController): PlayerSlotController {
  const index = CONTROLLER_CYCLE.indexOf(controller);
  return CONTROLLER_CYCLE[(index + 1) % CONTROLLER_CYCLE.length];
}

function cycleCharacter(current: CharacterId, step: 1 | -1): CharacterId {
  const index = CHARACTER_DEFINITIONS.findIndex((character) => character.id === current);
  const count = CHARACTER_DEFINITIONS.length;
  return CHARACTER_DEFINITIONS[(index + step + count) % count].id;
}

function characterName(id: CharacterId): string {
  return CHARACTER_DEFINITIONS.find((character) => character.id === id)?.name ?? id;
}

function portraitPosition(id: CharacterId): string {
  const index = Math.max(0, CHARACTER_DEFINITIONS.findIndex((character) => character.id === id));
  // 20% steps across the six busts; 5.5% down skips the board's title band
  // and the box height stops above each bust's name plate.
  return `${index * 20}% 5.5%`;
}

type PlayerSlotsSelectorProps = {
  characters: CharacterId[];
  /** One entry per seat, already resolved (missing seats are human). */
  controllers: PlayerSlotController[];
  /** Each human seat's keys in one short line, e.g. "W A S D · Bomb 2". */
  keyLines: string[];
  /** Seats whose keys clash with another seat: the warning to show. */
  keyClashes: Record<number, string>;
  onCharacterChange: (slot: number, characterId: CharacterId) => void;
  onControllersChange: (controllers: PlayerSlotController[]) => void;
  onAddPlayer: () => void;
  onRemovePlayer: () => void;
};

/**
 * Local Arena seats in one row: each shows its shinobi, a Human/CPU chip and
 * that seat's keys, so players see who they are before the match. One seat
 * always stays human, so the last human's chip is locked. The whole row is
 * one Tab stop; the arrow keys move inside it.
 */
export const PlayerSlotsSelector = ({
  characters,
  controllers,
  keyLines,
  keyClashes,
  onCharacterChange,
  onControllersChange,
  onAddPlayer,
  onRemovePlayer,
}: PlayerSlotsSelectorProps) => {
  const humans = controllers.filter((controller) => controller === 'human').length;
  const rowRef = useRef<HTMLDivElement>(null);
  const previousCount = useRef(characters.length);

  // Adding or removing a seat removes the button that was pressed: keep the
  // focus in the row (on the new seat's chip, or on the add seat).
  useEffect(() => {
    const before = previousCount.current;
    previousCount.current = characters.length;
    const row = rowRef.current;
    const lost = !document.activeElement || document.activeElement === document.body;
    if (!row || before === characters.length || !lost) return;
    const target = characters.length > before
      ? row.querySelector<HTMLElement>(`[data-slot="${characters.length - 1}"] [data-controller]`)
      : row.querySelector<HTMLElement>('[data-add-slot]');
    target?.focus();
  }, [characters.length]);

  return (
    <SlotRow ref={rowRef} role="group" aria-label="shinobi seats" data-roving-group>
      {characters.map((characterId, slot) => {
        const label = playerSlotLabel(slot);
        const controller = controllers[slot] ?? 'human';
        const cpu = controller !== 'human';
        const lastHuman = !cpu && humans === 1;
        const name = characterName(characterId);
        const clash = keyClashes[slot];
        const removable = characters.length > MIN_LOCAL_PLAYERS && slot === characters.length - 1;
        return (
          <SlotCard
            // eslint-disable-next-line react/no-array-index-key
            key={slot}
            data-slot={slot}
            role="group"
            aria-label={`${label} · ${name} · ${getControllerLabel(controller)}`}
          >
            <SlotPlate slotColor={playerSlotColor(slot)} textColor={playerSlotTextColor(slot)}>
              <span>{label}</span>
              {removable && (
                <SlotRemoveButton type="button" aria-label={`Remove ${label}`} onClick={onRemovePlayer}>
                  <CloseIcon aria-hidden="true" />
                </SlotRemoveButton>
              )}
            </SlotPlate>
            <SlotPortrait image={RosterBoard} backgroundPosition={portraitPosition(characterId)} aria-hidden="true" />
            <SlotPicker>
              <SlotPickerButton
                type="button"
                aria-label={`Previous shinobi for ${label}`}
                onClick={() => onCharacterChange(slot, cycleCharacter(characterId, -1))}
              >
                <ChevronLeftIcon aria-hidden="true" />
              </SlotPickerButton>
              <SlotName aria-live="polite">{name}</SlotName>
              <SlotPickerButton
                type="button"
                // Tab into the row lands here: choosing your shinobi comes first.
                data-roving-default={slot === 0 ? '' : undefined}
                aria-label={`Next shinobi for ${label}`}
                onClick={() => onCharacterChange(slot, cycleCharacter(characterId, 1))}
              >
                <ChevronRightIcon aria-hidden="true" />
              </SlotPickerButton>
            </SlotPicker>
            <ControllerChip
              type="button"
              cpu={cpu}
              data-controller
              disabled={lastHuman}
              aria-label={`${label} controller: ${getControllerLabel(controller)}`}
              title={lastHuman ? 'One shinobi stays human' : 'Change who plays this seat'}
              onClick={() => onControllersChange(controllers.map((item, index) => (
                index === slot ? nextSlotController(item) : item
              )))}
            >
              {cpu && <SmartToyOutlinedIcon aria-hidden="true" />}
              {getControllerLabel(controller)}
            </ControllerChip>
            <SlotKeys clash={Boolean(clash)}>
              {clash && <WarningAmberIcon aria-hidden="true" />}
              {clash ?? (cpu ? 'No keys needed' : keyLines[slot])}
            </SlotKeys>
          </SlotCard>
        );
      })}
      {characters.length < MAX_LOCAL_PLAYERS && (
        <AddSlotButton type="button" data-add-slot onClick={onAddPlayer}>
          <AddIcon aria-hidden="true" />
          Add shinobi
        </AddSlotButton>
      )}
    </SlotRow>
  );
};
