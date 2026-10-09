// The lore codex: one entry per hidden area of each village. Finding the
// area in a mission (a scroll cache, an archive fragment, a burrow) makes its
// entry readable in the hub. The writing is original to this game.
import { CAMPAIGN_VILLAGES } from './campaign';
import { StageId } from './types';

export type HubLoreKind = 'scroll' | 'fragment' | 'burrow';

export interface HubLoreEntry {
  id: string;
  stageId: StageId;
  kind: HubLoreKind;
  title: string;
  text: string;
  // The campaign secret that unlocks it (see campaignMissions.ts hidden areas).
  secretId: string;
}

/** What a locked entry says about where it is found. */
export const HUB_LORE_HINTS: Record<HubLoreKind, string> = {
  scroll: 'Hidden in a scroll cache',
  fragment: 'Sealed with an archive fragment',
  burrow: 'Behind an unstable wall',
};

const SECRET_SUFFIX: Record<HubLoreKind, string> = {
  scroll: 'scroll-cache',
  fragment: 'archive-fragment',
  burrow: 'zetsu-burrow',
};

type EntryText = { title: string; text: string };

const LORE_TEXT: Record<StageId, Record<HubLoreKind, EntryText>> = {
  hiddenLeaf: {
    scroll: {
      title: "The Gatewarden's Ledger",
      text: 'Every name that left through the gate, and every name that came back. The last page has more of the first kind.',
    },
    fragment: {
      title: 'Root and Branch',
      text: "A torn page from a teacher's notebook: 'They will forget the lessons. Make sure they remember why.'",
    },
    burrow: {
      title: 'Hollow Under the Logs',
      text: 'The wall was hollow, and something had been living in it. The scratches run in neat rows, like a tally.',
    },
  },
  hiddenSand: {
    scroll: {
      title: "The Well Keepers' Rota",
      text: 'Seven wells, seven keepers, one rule: never draw water after the third bell. Nobody remembers why. Everybody obeys.',
    },
    fragment: {
      title: 'Glass Memory',
      text: 'Desert glass, fused by a blast long ago. Hold it to the light and a figure shows inside, caught mid-stride.',
    },
    burrow: {
      title: 'The Patient Dune',
      text: 'The burrow was dug by hand over years. Whoever dug it meant to come up exactly under the arena.',
    },
  },
  hiddenMist: {
    scroll: {
      title: 'Ferry Tolls',
      text: "A list of fares in a tidy hand. One line is crossed out again and again: 'one passenger, no face, paid in silence.'",
    },
    fragment: {
      title: 'The Drowned Bell',
      text: 'A bell clapper wrapped in reed. The bell lies somewhere under the lake, and some nights it still rings.',
    },
    burrow: {
      title: 'Behind the Pilings',
      text: 'Fresh cuts in old wood. Someone has been tunnelling up from the water into the docks, one plank at a time.',
    },
  },
  hiddenCloud: {
    scroll: {
      title: 'Storm Almanac',
      text: 'Forty years of strikes, one line each. The last season fills the margins, then the back cover, then the desk.',
    },
    fragment: {
      title: 'Copper Feather',
      text: "A kite's tail ornament, scorched black at one end. It hums softly whenever thunder is near.",
    },
    burrow: {
      title: 'The Grounding Pit',
      text: 'A pit under the tower, lined with copper. The storm has been feeding something down there.',
    },
  },
  hiddenStone: {
    scroll: {
      title: 'Quarry Tablet',
      text: 'A script older than the village repeats one warning over and over: leave the deepest seam alone.',
    },
    fragment: {
      title: 'Lamp of the First Miner',
      text: 'A clay lamp no bigger than a thumb. It has never been lit, and it still smells of oil.',
    },
    burrow: {
      title: 'Silk Gallery',
      text: 'The tunnel walls are hung with silk in careful patterns. Whatever wove them was not hunting. It was writing.',
    },
  },
  akatsukiHideout: {
    scroll: {
      title: 'Copied Plans',
      text: "Seals within seals, each page copied by a different hand. The scribes' margin notes grow shorter page by page.",
    },
    fragment: {
      title: 'The Cold Lantern',
      text: 'A red lantern that gives no light at all, only cold. Its wick has never burned.',
    },
    burrow: {
      title: 'Crow Roost',
      text: 'Hundreds of feathers, all pointing one way: toward a door that is no longer there.',
    },
  },
  greatShinobiWar: {
    scroll: {
      title: "The Runner's Satchel",
      text: 'Messages never delivered. Most are orders. A few are letters home, and those were folded with care.',
    },
    fragment: {
      title: 'One Banner',
      text: 'Seven village colours stitched into one cloth by seven hands. The stitches do not match. It holds anyway.',
    },
    burrow: {
      title: 'The Last Trench',
      text: 'Dug overnight by soldiers from rival villages, side by side. Their tools are still stacked neatly at the end.',
    },
  },
};

const KINDS: HubLoreKind[] = ['scroll', 'fragment', 'burrow'];

export const HUB_LORE_ENTRIES: HubLoreEntry[] = CAMPAIGN_VILLAGES.flatMap((village) => (
  KINDS.map((kind) => ({
    id: `${village.stageId}-${kind}`,
    stageId: village.stageId,
    kind,
    ...LORE_TEXT[village.stageId][kind],
    secretId: `${village.stageId}-${SECRET_SUFFIX[kind]}`,
  }))
));

export function getHubLoreEntries(stageId: StageId): HubLoreEntry[] {
  return HUB_LORE_ENTRIES.filter((entry) => entry.stageId === stageId);
}

export function isLoreUnlocked(entry: HubLoreEntry, discoveredSecrets: string[]): boolean {
  return discoveredSecrets.includes(entry.secretId);
}
