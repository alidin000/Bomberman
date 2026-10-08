import type { NavigateFunction } from 'react-router-dom';
import {
  CHARACTER_DEFINITIONS,
  CharacterId,
  DEFAULT_CHARACTER_ID,
  GameMode,
  STAGE_DEFINITIONS,
  StageId,
  getCampaignMission,
  getCampaignVillage,
  getStageDefinition,
} from '../../content';
import { DEFAULT_KEY_BINDINGS, KeyBindings, normalizeKeyBindings } from '../../constants/props';
import {
  StoryProgress,
  StoryUpgradeId,
  selectStoryLoadout,
} from '../../story/progress';
import { PlayerSlotController, fetchMapFromFile } from '../../engine';
import { getControllerLabel, normalizeControllers } from '../../ai/controllers';

export const SINGLE_MATCH_ROUNDS = '1';
/** Local matches are best of 1, 3 or 5 rounds. */
export const MATCH_ROUND_OPTIONS = ['1', '3', '5'] as const;
export type MatchRounds = typeof MATCH_ROUND_OPTIONS[number];

function toMatchRounds(value: unknown): MatchRounds {
  return MATCH_ROUND_OPTIONS.find((option) => option === value) ?? SINGLE_MATCH_ROUNDS;
}
const GAME_SETUP_KEY = 'gameSetup';

export function loadStoredKeyBindings(): KeyBindings {
  try {
    const stored = localStorage.getItem('playerKeyBindings');
    return normalizeKeyBindings(stored ? JSON.parse(stored) : DEFAULT_KEY_BINDINGS);
  } catch {
    return normalizeKeyBindings(DEFAULT_KEY_BINDINGS);
  }
}

export interface LaunchRequest {
  mode: GameMode;
  stageId: StageId;
  characters: CharacterId[];
  upgrade: StoryUpgradeId;
  players: string;
  keyBindings: KeyBindings;
  storyProgress: StoryProgress;
  /** Local matches only; campaign missions are always one round. */
  rounds?: MatchRounds;
  // Local Arena only: human or CPU per slot (missing means all human).
  controllers?: PlayerSlotController[];
}

/**
 * Stores the chosen setup and opens the match. Shared by the Mission Deck and
 * the title screen's Quick Play, so both start a match the same way.
 * Returns the saved story progress for campaign runs.
 */
export async function launchGame(
  request: LaunchRequest,
  navigate: NavigateFunction
): Promise<StoryProgress | null> {
  const {
    mode, stageId, characters, upgrade, players, keyBindings, storyProgress, controllers,
  } = request;
  const rounds = mode === 'local' ? toMatchRounds(request.rounds) : SINGLE_MATCH_ROUNDS;
  const safeStageId = mode === 'solo' && !storyProgress.unlockedStages.includes(stageId)
    ? storyProgress.lastStage
    : stageId;
  const safeCharacters = mode === 'solo'
    ? characters.map((characterId) => (
      storyProgress.unlockedCharacters.includes(characterId)
        ? characterId
        : storyProgress.lastCharacter ?? DEFAULT_CHARACTER_ID
    ))
    : characters;
  const stageDefinition = getStageDefinition(safeStageId);
  const mapData = await fetchMapFromFile(stageDefinition.mapId);
  const characterId = safeCharacters[0] ?? DEFAULT_CHARACTER_ID;
  const progress = mode === 'solo'
    ? selectStoryLoadout(characterId, stageDefinition.id, upgrade)
    : null;
  localStorage.setItem('selectedMap', JSON.stringify(mapData));
  localStorage.setItem('playerKeyBindings', JSON.stringify(normalizeKeyBindings(keyBindings)));
  localStorage.setItem(GAME_SETUP_KEY, JSON.stringify({
    mode,
    stageId: stageDefinition.id,
    selectedCharacters: safeCharacters,
    selectedUpgrade: upgrade,
    ...(mode === 'local' ? { rounds } : {}),
    controllers: mode === 'local'
      ? normalizeControllers(controllers, safeCharacters.length)
      : undefined,
  }));
  navigate(`/game/${players}/${rounds}/${stageDefinition.mapId}`);
  return progress;
}

export interface QuickPlayPlan {
  mode: 'solo' | 'local';
  stageId: StageId;
  characters: CharacterId[];
  upgrade: StoryUpgradeId;
  players: string;
  rounds: MatchRounds;
  controllers?: PlayerSlotController[];
  /** Short line that says what Quick Play starts. */
  summary: string;
}

function characterName(id: CharacterId): string {
  return CHARACTER_DEFINITIONS.find((character) => character.id === id)?.name ?? id;
}

/** The last local battle setup, if the last match played was local. */
export function readLastLocalSetup(): {
  stageId: StageId;
  characters: CharacterId[];
  rounds: MatchRounds;
  controllers?: PlayerSlotController[];
} | null {
  try {
    const stored = JSON.parse(localStorage.getItem(GAME_SETUP_KEY) ?? 'null');
    if (!stored || stored.mode !== 'local') return null;
    const stage = STAGE_DEFINITIONS.find((item) => item.id === stored.stageId);
    const ids = CHARACTER_DEFINITIONS.map((item) => item.id);
    const characters: CharacterId[] = Array.isArray(stored.selectedCharacters)
      ? stored.selectedCharacters.filter((id: CharacterId) => ids.includes(id))
      : [];
    if (!stage || characters.length < 2 || characters.length > 3) return null;
    return {
      stageId: stage.id,
      characters,
      rounds: toMatchRounds(stored.rounds),
      controllers: normalizeControllers(stored.controllers, characters.length),
    };
  } catch {
    return null;
  }
}

/**
 * What Quick Play starts: the last local battle if that was the last match,
 * otherwise the current campaign mission with the saved shinobi and upgrade.
 */
export function getQuickPlayPlan(storyProgress: StoryProgress): QuickPlayPlan {
  const lastLocal = readLastLocalSetup();
  if (lastLocal) {
    return {
      mode: 'local',
      stageId: lastLocal.stageId,
      characters: lastLocal.characters,
      upgrade: storyProgress.selectedUpgrade,
      players: String(lastLocal.characters.length),
      rounds: lastLocal.rounds,
      controllers: lastLocal.controllers,
      summary: [
        'Local rematch',
        getStageDefinition(lastLocal.stageId).name,
        lastLocal.characters.map((id, slot) => {
          const controller = lastLocal.controllers?.[slot] ?? 'human';
          return controller === 'human'
            ? characterName(id)
            : `${characterName(id)} (${getControllerLabel(controller)})`;
        }).join(' vs '),
        ...(lastLocal.rounds === SINGLE_MATCH_ROUNDS ? [] : [`Best of ${lastLocal.rounds}`]),
      ].join(' · '),
    };
  }
  const stageId = storyProgress.unlockedStages.includes(storyProgress.lastStage)
    ? storyProgress.lastStage
    : storyProgress.unlockedStages[0] ?? 'hiddenLeaf';
  const lastCharacter = storyProgress.lastCharacter ?? DEFAULT_CHARACTER_ID;
  const character = storyProgress.unlockedCharacters.includes(lastCharacter)
    ? lastCharacter
    : storyProgress.unlockedCharacters[0] ?? DEFAULT_CHARACTER_ID;
  const village = getCampaignVillage(stageId);
  const missionTitle = getCampaignMission(stageId)?.title ?? village.villageName;
  return {
    mode: 'solo',
    stageId,
    characters: [character],
    upgrade: storyProgress.selectedUpgrade,
    players: '1',
    rounds: SINGLE_MATCH_ROUNDS,
    summary: `Mission ${village.order} · ${missionTitle} · ${characterName(character)}`,
  };
}
