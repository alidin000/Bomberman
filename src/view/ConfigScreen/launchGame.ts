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
import { fetchMapFromFile } from '../../engine';

export const SINGLE_MATCH_ROUNDS = '1';
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
    mode, stageId, characters, upgrade, players, keyBindings, storyProgress,
  } = request;
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
  }));
  navigate(`/game/${players}/${SINGLE_MATCH_ROUNDS}/${stageDefinition.mapId}`);
  return progress;
}

export interface QuickPlayPlan {
  mode: 'solo' | 'local';
  stageId: StageId;
  characters: CharacterId[];
  upgrade: StoryUpgradeId;
  players: string;
  /** Short line that says what Quick Play starts. */
  summary: string;
}

function characterName(id: CharacterId): string {
  return CHARACTER_DEFINITIONS.find((character) => character.id === id)?.name ?? id;
}

/** The last local battle setup, if the last match played was local. */
export function readLastLocalSetup(): { stageId: StageId; characters: CharacterId[] } | null {
  try {
    const stored = JSON.parse(localStorage.getItem(GAME_SETUP_KEY) ?? 'null');
    if (!stored || stored.mode !== 'local') return null;
    const stage = STAGE_DEFINITIONS.find((item) => item.id === stored.stageId);
    const ids = CHARACTER_DEFINITIONS.map((item) => item.id);
    const characters: CharacterId[] = Array.isArray(stored.selectedCharacters)
      ? stored.selectedCharacters.filter((id: CharacterId) => ids.includes(id))
      : [];
    if (!stage || characters.length < 2 || characters.length > 3) return null;
    return { stageId: stage.id, characters };
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
      summary: `Local rematch · ${getStageDefinition(lastLocal.stageId).name} · ${lastLocal.characters.map(characterName).join(' vs ')}`,
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
    summary: `Mission ${village.order} · ${missionTitle} · ${characterName(character)}`,
  };
}
