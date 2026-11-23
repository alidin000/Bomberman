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
  takeMissionLoadout,
} from '../../story/progress';
import type { CampaignLoadout } from '../../content/hubShop';
import type { VillageVisitConfig } from '../../content/villageSquare';
import { buildVillageVisit } from '../../story/villageVisit';
import { PlayerSlotController, loadCampaignMapRows, loadStageMapRows } from '../../engine';
import { getControllerLabel, normalizeControllers } from '../../ai/controllers';
import { ArenaMapId, arenaMapRows, getArenaMap } from '../../content/arenaMaps';

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
  /** The campaign's village; Local Arena plays its arena when no arenaMapId is given. */
  stageId: StageId;
  /** Local Arena: the catalog map to play, a village's or a city's. */
  arenaMapId?: ArenaMapId;
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
  // Local Arena plays a catalog map: the deck's arena choice, else the stage's.
  const arena = mode === 'local' ? getArenaMap(request.arenaMapId ?? stageId) : undefined;
  // Missions play the village's campaign map; Local Arena keeps its arena map.
  let mapData: string[][];
  if (arena) mapData = arenaMapRows(arena.id);
  else if (mode === 'solo') mapData = loadCampaignMapRows(stageDefinition.mapId);
  else mapData = loadStageMapRows(stageDefinition.mapId);
  const characterId = safeCharacters[0] ?? DEFAULT_CHARACTER_ID;
  let progress = mode === 'solo'
    ? selectStoryLoadout(characterId, stageDefinition.id, upgrade)
    : null;
  // A campaign mission deploys with the hub pack (spent now) and upgrades.
  let loadout: CampaignLoadout | undefined;
  // ...and its village square: standing, the stall's Embers, the board.
  let village: VillageVisitConfig | undefined;
  if (mode === 'solo') {
    ({ progress, loadout } = takeMissionLoadout());
    village = buildVillageVisit(stageDefinition.id, progress);
  }
  localStorage.setItem('selectedMap', JSON.stringify(mapData));
  localStorage.setItem('playerKeyBindings', JSON.stringify(normalizeKeyBindings(keyBindings)));
  localStorage.setItem(GAME_SETUP_KEY, JSON.stringify({
    mode,
    // A village arena saves its stage as before; a city is no stage, so its
    // setup names only its arena.
    ...(arena?.family === 'city' ? {} : { stageId: arena ? arena.id : stageDefinition.id }),
    ...(arena ? { arenaMapId: arena.id } : {}),
    selectedCharacters: safeCharacters,
    selectedUpgrade: upgrade,
    ...(mode === 'local' ? { rounds } : {}),
    controllers: mode === 'local'
      ? normalizeControllers(controllers, safeCharacters.length)
      : undefined,
    loadout,
    village,
  }));
  navigate(`/game/${players}/${rounds}/${arena ? arena.id : stageDefinition.mapId}`);
  return progress;
}

/**
 * The match screen read this mission's loadout: drop the spent consumables
 * from the stored setup, so a page reload cannot pack them a second time.
 */
export function clearDeployedConsumables(): void {
  try {
    const stored = JSON.parse(localStorage.getItem(GAME_SETUP_KEY) ?? 'null');
    if (!stored?.loadout?.consumables?.length) return;
    localStorage.setItem(GAME_SETUP_KEY, JSON.stringify({
      ...stored,
      loadout: { ...stored.loadout, consumables: [] },
    }));
  } catch {
    // Without storage there is no setup to reload either.
  }
}

/**
 * The village stall took Embers (saved at once): a page reload starts the
 * mission with what is left, the way a deployed pack stays spent.
 */
export function storeVillageEmbers(embers: number): void {
  try {
    const stored = JSON.parse(localStorage.getItem(GAME_SETUP_KEY) ?? 'null');
    if (!stored?.village) return;
    localStorage.setItem(GAME_SETUP_KEY, JSON.stringify({
      ...stored,
      village: { ...stored.village, embers: Math.max(0, Math.floor(embers)) },
    }));
  } catch {
    // Without storage there is no setup to reload either.
  }
}

export interface QuickPlayPlan {
  mode: 'solo' | 'local';
  stageId: StageId;
  /** Local plans: the arena the last local battle played. */
  arenaMapId?: ArenaMapId;
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

function arenaName(id: ArenaMapId): string {
  return getArenaMap(id)?.name ?? id;
}

// A local plan still names a stage (LaunchRequest needs one): a village
// arena's own, or the first village for a city, which plays by its arena id.
function localStageId(id: ArenaMapId): StageId {
  return STAGE_DEFINITIONS.find((stage) => stage.id === id)?.id ?? STAGE_DEFINITIONS[0].id;
}

/** The last local battle setup, if the last match played was local. */
export function readLastLocalSetup(): {
  arenaMapId: ArenaMapId;
  characters: CharacterId[];
  rounds: MatchRounds;
  controllers?: PlayerSlotController[];
} | null {
  try {
    const stored = JSON.parse(localStorage.getItem(GAME_SETUP_KEY) ?? 'null');
    if (!stored || stored.mode !== 'local') return null;
    // A city setup names its arena; older and village setups name the stage.
    const savedArena = typeof stored.arenaMapId === 'string' ? stored.arenaMapId : stored.stageId;
    const arena = getArenaMap(typeof savedArena === 'string' ? savedArena : undefined);
    const ids = CHARACTER_DEFINITIONS.map((item) => item.id);
    const characters: CharacterId[] = Array.isArray(stored.selectedCharacters)
      ? stored.selectedCharacters.filter((id: CharacterId) => ids.includes(id))
      : [];
    if (!arena || characters.length < 2 || characters.length > 3) return null;
    return {
      arenaMapId: arena.id,
      characters,
      rounds: toMatchRounds(stored.rounds),
      controllers: normalizeControllers(stored.controllers, characters.length),
    };
  } catch {
    return null;
  }
}

/**
 * The title screen's "Battle a CPU": you (P1) against one CPU Normal shinobi
 * in Local Arena, on the last local stage (else the first stage), with the
 * last local shinobi and round count when there are any.
 */
export function getCpuBattlePlan(storyProgress: StoryProgress): QuickPlayPlan {
  const lastLocal = readLastLocalSetup();
  const arenaMapId: ArenaMapId = lastLocal?.arenaMapId ?? STAGE_DEFINITIONS[0].id;
  const player = lastLocal?.characters[0] ?? storyProgress.lastCharacter ?? DEFAULT_CHARACTER_ID;
  const rival = lastLocal?.characters[1]
    ?? CHARACTER_DEFINITIONS.find((character) => character.id !== player)?.id
    ?? player;
  const rounds = lastLocal?.rounds ?? SINGLE_MATCH_ROUNDS;
  return {
    mode: 'local',
    stageId: localStageId(arenaMapId),
    arenaMapId,
    characters: [player, rival],
    upgrade: storyProgress.selectedUpgrade,
    players: '2',
    rounds,
    controllers: ['human', 'cpu-normal'],
    summary: [
      arenaName(arenaMapId),
      `${characterName(player)} vs ${characterName(rival)} (${getControllerLabel('cpu-normal')})`,
      ...(rounds === SINGLE_MATCH_ROUNDS ? [] : [`Best of ${rounds}`]),
    ].join(' · '),
  };
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
      stageId: localStageId(lastLocal.arenaMapId),
      arenaMapId: lastLocal.arenaMapId,
      characters: lastLocal.characters,
      upgrade: storyProgress.selectedUpgrade,
      players: String(lastLocal.characters.length),
      rounds: lastLocal.rounds,
      controllers: lastLocal.controllers,
      summary: [
        'Local rematch',
        arenaName(lastLocal.arenaMapId),
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
