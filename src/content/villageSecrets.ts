// The Secrets tracker: each village hides three secret rooms in its mission
// map (a scroll cache, an archive fragment, a Zetsu burrow). This says where
// each one roughly is, worked out from the layout so it follows a remap,
// what it gives, and the set reward for finding all three.
import type { StageId } from './types';
import { CAMPAIGN_STAGE_LAYOUTS } from './campaignLayouts';
import { getCampaignMission } from './campaignMissions';
import type { CampaignHiddenAreaDefinition } from './campaignMissions';
import { getCharacterPowerTheme } from './characterPowerups';
import { getHubLoreEntries } from './hubLore';
import type { HubLoreEntry, HubLoreKind } from './hubLore';
import { getEnemyArchetypeDefinition } from './enemies';

export type VillageSecretKind = HubLoreKind;

export const SECRET_KINDS: readonly VillageSecretKind[] = ['scroll', 'fragment', 'burrow'];

/** Finding all three of a village's secrets pays this once, plus its scarf. */
export const SECRET_SET_REWARD = { embers: 30 } as const;

export interface VillageSecret {
  // The campaign secret id (`${stageId}-scroll-cache` and so on).
  id: string;
  stageId: StageId;
  kind: VillageSecretKind;
  // The mission's name for it, for example "Training Grounds Secret Scroll".
  name: string;
  // Rough place on the map, for example "North-west, near the outer district".
  where: string;
  // How the room is opened.
  entry: string;
  // What walking in gives.
  gives: string;
  // The story page it unlocks (the old Codex entry), a bonus once found.
  page: HubLoreEntry;
}

const KIND_OF_AREA: Partial<Record<CampaignHiddenAreaDefinition['kind'], VillageSecretKind>> = {
  scroll: 'scroll',
  fragment: 'fragment',
  zetsuBurrow: 'burrow',
};

const ENTRY_TEXT = {
  crackedWall: 'Behind a cracked wall: blast it open.',
  hiddenPassage: 'Through a false wall: walk into the seam.',
  crate: 'Under a crate: break it.',
} as const;

// Districts, by the names the tracker uses, and how near counts as "near".
const NEAR_CELLS = 11;
const EDGE_CELLS = 5;
const DISTRICT_NAMES: Record<string, string> = {
  entrance: 'the entrance',
  'outer-district': 'the outer district',
  center: 'the village centre',
  'boss-gate': 'the boss gate',
};

function compass(x: number, y: number, size: number): string {
  const third = size / 3;
  let north = '';
  if (y < third) north = 'north';
  else if (y >= third * 2) north = 'south';
  let east = '';
  if (x < third) east = 'west';
  else if (x >= third * 2) east = 'east';
  if (north && east) return `${north}-${east}`;
  return north || east || 'centre';
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Where a secret roughly is: the compass ninth of the map, then the nearest
 * named place within a few cells (the districts and the boss arena).
 */
export function secretWhere(stageId: StageId, x: number, y: number): string {
  const layout = CAMPAIGN_STAGE_LAYOUTS[stageId];
  const mission = getCampaignMission(stageId);
  const places: { name: string; x: number; y: number }[] = [];
  mission?.districts.forEach((district) => {
    const key = district.id.replace(`${stageId}-`, '');
    places.push({
      name: DISTRICT_NAMES[key] ?? `the ${district.label.toLowerCase()}`,
      x: district.x,
      y: district.y,
    });
  });
  if (mission) {
    places.push({
      name: `the ${mission.bossArena.label}`,
      x: layout.bossArena.x,
      y: layout.bossArena.y,
    });
  }
  let nearest: { name: string; distance: number } | null = null;
  places.forEach((place) => {
    const distance = Math.hypot(place.x - x, place.y - y);
    if (distance <= NEAR_CELLS && (!nearest || distance < nearest.distance)) {
      nearest = { name: place.name, distance };
    }
  });
  const side = capital(compass(x, y, layout.size));
  const near = nearest as { name: string } | null;
  if (near && side === 'Centre' && near.name === DISTRICT_NAMES.center) return 'In the village centre';
  if (near) return `${side}, near ${near.name}`;
  const edge = EDGE_CELLS;
  const byX = x <= edge || x >= layout.size - 1 - edge;
  const byY = y <= edge || y >= layout.size - 1 - edge;
  if (byX && byY) return `${side}, in the corner`;
  if (byX || byY) return `${side}, by the map's edge`;
  return side;
}

function gives(area: CampaignHiddenAreaDefinition): string {
  if (area.enemyArchetype) {
    return `An elite ${getEnemyArchetypeDefinition(area.enemyArchetype).label} ambush waits inside. Beat it for the room.`;
  }
  if (area.rewardPowerUp === 'CharacterFragment') {
    return 'A Character Fragment: fills your ultimate at once, and pays extra Embers the first time.';
  }
  if (area.rewardPowerUp) {
    const theme = getCharacterPowerTheme(undefined, area.rewardPowerUp);
    return `${theme.label} power-up: ${theme.effect.charAt(0).toLowerCase()}${theme.effect.slice(1)}`;
  }
  return 'A hidden reward.';
}

const SECRETS = new Map<StageId, VillageSecret[]>();

/** A village's three secrets, scroll cache first. */
export function getVillageSecrets(stageId: StageId): VillageSecret[] {
  const cached = SECRETS.get(stageId);
  if (cached) return cached;
  const mission = getCampaignMission(stageId);
  const pages = getHubLoreEntries(stageId);
  const secrets = (mission?.hiddenAreas ?? []).flatMap((area) => {
    const kind = KIND_OF_AREA[area.kind];
    const page = pages.find((entry) => entry.kind === kind);
    if (!kind || !page) return [];
    return [{
      id: area.id,
      stageId,
      kind,
      name: area.label,
      where: secretWhere(stageId, area.x, area.y),
      entry: ENTRY_TEXT[area.room?.entry ?? 'crate'],
      gives: gives(area),
      page,
    }];
  }).sort((a, b) => SECRET_KINDS.indexOf(a.kind) - SECRET_KINDS.indexOf(b.kind));
  SECRETS.set(stageId, secrets);
  return secrets;
}

export type SecretSetState = 'hunting' | 'ready' | 'claimed';

export interface SecretSetProgress {
  found: number;
  total: number;
  state: SecretSetState;
}

/** How far a village's set is: found count, then ready to claim or claimed. */
export function secretSetProgress(
  stageId: StageId,
  discoveredSecrets: readonly string[],
  claimedSets: readonly StageId[]
): SecretSetProgress {
  const secrets = getVillageSecrets(stageId);
  const found = secrets.filter((secret) => discoveredSecrets.includes(secret.id)).length;
  let state: SecretSetState = 'hunting';
  if (claimedSets.includes(stageId)) state = 'claimed';
  else if (secrets.length > 0 && found === secrets.length) state = 'ready';
  return { found, total: secrets.length, state };
}

const ENTRY_HINT = {
  crackedWall: 'behind a cracked wall',
  hiddenPassage: 'through a false wall',
  crate: 'under a crate',
} as const;

/** A villager's hint at a secret: "north-west, near the outer district, behind a cracked wall". */
export function secretHint(stageId: StageId, kind: VillageSecretKind): string {
  const mission = getCampaignMission(stageId);
  const area = mission?.hiddenAreas.find((item) => KIND_OF_AREA[item.kind] === kind);
  if (!area) return 'somewhere in the village';
  const where = secretWhere(stageId, area.x, area.y);
  return `${where.charAt(0).toLowerCase()}${where.slice(1)}, ${ENTRY_HINT[area.room?.entry ?? 'crate']}`;
}
