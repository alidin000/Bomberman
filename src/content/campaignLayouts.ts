import type { StageId } from './types';
import type {
  CampaignBossArenaBounds,
  CampaignSecretRoomDefinition,
} from './campaignMissions';

export interface CampaignCell {
  x: number;
  y: number;
}

/** Where a village secret sits: its reward cell, and the room around it. */
export interface CampaignSecretPlacement extends CampaignCell {
  room?: CampaignSecretRoomDefinition;
}

/**
 * Every authored place a village mission uses on its campaign map
 * (public/maps/campaign), except the route puzzle (CAMPAIGN_PUZZLE_LAYOUTS)
 * and the defense wave entries (CAMPAIGN_WAVE_SCRIPTS), which keep their own
 * tables. Remapping a village to a new map means a new entry here: names,
 * rules and pacing stay. campaignLayouts.test.ts walks every map against its
 * layout (reachability, walled arena and rooms, spawns, corridors).
 */
export interface CampaignStageLayout {
  // The stage map's width and height, in cells.
  size: number;
  // Player one, then the co-op seats (two to four players).
  playerSpawns: readonly [CampaignCell, CampaignCell, CampaignCell, CampaignCell];
  entrance: CampaignCell;
  outerDistrict: CampaignCell;
  rescueTargets: readonly [CampaignCell, CampaignCell];
  // The defense structure, also the village-centre district.
  structure: CampaignCell;
  // The mini boss gate, also the boss-gate district.
  miniBossGate: CampaignCell;
  spawnPoints: {
    mainGate: CampaignCell;
    outerBurrow: CampaignCell;
    bossGateBurrow: CampaignCell;
  };
  // Where the boss appears. A walled arena also lists its floor and the gate
  // cells that stay shut (walls) until the mini boss gate is cleared.
  bossArena: CampaignCell & { bounds?: CampaignBossArenaBounds; gates?: readonly CampaignCell[] };
  secrets: {
    scroll: CampaignSecretPlacement;
    fragment: CampaignSecretPlacement;
    burrow: CampaignSecretPlacement;
  };
}

const LEAF_50: CampaignStageLayout = {
  size: 50,
  playerSpawns: [{ x: 1, y: 1 }, { x: 9, y: 7 }, { x: 1, y: 7 }, { x: 9, y: 1 }],
  entrance: { x: 1, y: 1 },
  outerDistrict: { x: 20, y: 6 },
  rescueTargets: [{ x: 26, y: 7 }, { x: 12, y: 22 }],
  structure: { x: 24, y: 23 },
  miniBossGate: { x: 42, y: 33 },
  spawnPoints: {
    mainGate: { x: 18, y: 28 },
    outerBurrow: { x: 2, y: 35 },
    bossGateBurrow: { x: 46, y: 32 },
  },
  bossArena: {
    x: 42,
    y: 42,
    bounds: {
      x: 36, y: 36, width: 13, height: 13,
    },
    gates: [
      { x: 41, y: 35 },
      { x: 42, y: 35 },
      { x: 43, y: 35 },
      { x: 35, y: 41 },
      { x: 35, y: 42 },
      { x: 35, y: 43 },
    ],
  },
  secrets: {
    scroll: {
      x: 16,
      y: 8,
      room: {
        x: 15, y: 7, width: 3, height: 2, entry: 'crackedWall', door: { x: 16, y: 6 },
      },
    },
    fragment: {
      x: 37,
      y: 18,
      room: {
        x: 35, y: 17, width: 3, height: 3, entry: 'hiddenPassage', door: { x: 34, y: 18 },
      },
    },
    burrow: {
      x: 2,
      y: 46,
      room: {
        x: 2, y: 45, width: 3, height: 3, entry: 'crackedWall', door: { x: 5, y: 46 },
      },
    },
  },
};

const SAND_50: CampaignStageLayout = {
  size: 50,
  playerSpawns: [{ x: 1, y: 1 }, { x: 9, y: 7 }, { x: 1, y: 7 }, { x: 9, y: 1 }],
  entrance: { x: 1, y: 1 },
  outerDistrict: { x: 20, y: 2 },
  rescueTargets: [{ x: 5, y: 22 }, { x: 40, y: 6 }],
  structure: { x: 24, y: 24 },
  miniBossGate: { x: 33, y: 21 },
  spawnPoints: {
    mainGate: { x: 19, y: 2 },
    outerBurrow: { x: 6, y: 30 },
    bossGateBurrow: { x: 33, y: 18 },
  },
  bossArena: {
    x: 42,
    y: 21,
    bounds: {
      x: 37, y: 14, width: 12, height: 15,
    },
    gates: [
      { x: 36, y: 20 },
      { x: 36, y: 21 },
      { x: 36, y: 22 },
      { x: 41, y: 29 },
      { x: 42, y: 29 },
      { x: 43, y: 29 },
    ],
  },
  secrets: {
    scroll: {
      x: 30,
      y: 14,
      room: {
        x: 29, y: 14, width: 3, height: 2, entry: 'crackedWall', door: { x: 30, y: 16 },
      },
    },
    fragment: {
      x: 25,
      y: 17,
      room: {
        x: 24, y: 17, width: 3, height: 2, entry: 'hiddenPassage', door: { x: 25, y: 19 },
      },
    },
    burrow: {
      x: 22,
      y: 47,
      room: {
        x: 21, y: 45, width: 3, height: 3, entry: 'crackedWall', door: { x: 22, y: 44 },
      },
    },
  },
};

const MIST_50: CampaignStageLayout = {
  size: 50,
  playerSpawns: [{ x: 1, y: 1 }, { x: 9, y: 7 }, { x: 1, y: 7 }, { x: 9, y: 1 }],
  entrance: { x: 1, y: 1 },
  outerDistrict: { x: 20, y: 3 },
  rescueTargets: [{ x: 4, y: 24 }, { x: 36, y: 10 }],
  structure: { x: 22, y: 25 },
  miniBossGate: { x: 25, y: 35 },
  spawnPoints: {
    mainGate: { x: 16, y: 30 },
    outerBurrow: { x: 32, y: 18 },
    bossGateBurrow: { x: 37, y: 36 },
  },
  bossArena: {
    x: 25,
    y: 43,
    bounds: {
      x: 18, y: 38, width: 15, height: 11,
    },
    gates: [
      { x: 24, y: 37 },
      { x: 25, y: 37 },
      { x: 26, y: 37 },
      { x: 33, y: 42 },
      { x: 33, y: 43 },
      { x: 33, y: 44 },
    ],
  },
  secrets: {
    scroll: {
      x: 42,
      y: 4,
      room: {
        x: 41, y: 4, width: 3, height: 2, entry: 'crackedWall', door: { x: 42, y: 6 },
      },
    },
    fragment: {
      x: 2,
      y: 43,
      room: {
        x: 2, y: 42, width: 3, height: 3, entry: 'hiddenPassage', door: { x: 5, y: 43 },
      },
    },
    burrow: {
      x: 46,
      y: 18,
      room: {
        x: 44, y: 17, width: 3, height: 3, entry: 'crackedWall', door: { x: 43, y: 18 },
      },
    },
  },
};

const CLOUD_50: CampaignStageLayout = {
  size: 50,
  playerSpawns: [{ x: 1, y: 1 }, { x: 9, y: 7 }, { x: 1, y: 7 }, { x: 9, y: 1 }],
  entrance: { x: 1, y: 1 },
  outerDistrict: { x: 6, y: 20 },
  rescueTargets: [{ x: 6, y: 28 }, { x: 40, y: 42 }],
  structure: { x: 24, y: 24 },
  miniBossGate: { x: 42, y: 15 },
  spawnPoints: {
    mainGate: { x: 20, y: 17 },
    outerBurrow: { x: 20, y: 5 },
    bossGateBurrow: { x: 38, y: 19 },
  },
  bossArena: {
    x: 42,
    y: 6,
    bounds: {
      x: 36, y: 1, width: 13, height: 12,
    },
    gates: [
      { x: 41, y: 13 },
      { x: 42, y: 13 },
      { x: 43, y: 13 },
      { x: 35, y: 5 },
      { x: 35, y: 6 },
      { x: 35, y: 7 },
    ],
  },
  secrets: {
    scroll: {
      x: 2,
      y: 19,
      room: {
        x: 2, y: 18, width: 3, height: 3, entry: 'hiddenPassage', door: { x: 5, y: 19 },
      },
    },
    fragment: {
      x: 27,
      y: 17,
      room: {
        x: 26, y: 17, width: 3, height: 2, entry: 'crackedWall', door: { x: 27, y: 19 },
      },
    },
    burrow: {
      x: 46,
      y: 45,
      room: {
        x: 44, y: 44, width: 3, height: 3, entry: 'crackedWall', door: { x: 43, y: 45 },
      },
    },
  },
};

const STONE_50: CampaignStageLayout = {
  size: 50,
  playerSpawns: [{ x: 1, y: 1 }, { x: 9, y: 7 }, { x: 1, y: 7 }, { x: 9, y: 1 }],
  entrance: { x: 1, y: 1 },
  outerDistrict: { x: 6, y: 14 },
  rescueTargets: [{ x: 4, y: 13 }, { x: 33, y: 6 }],
  structure: { x: 25, y: 22 },
  miniBossGate: { x: 41, y: 32 },
  spawnPoints: {
    mainGate: { x: 17, y: 24 },
    outerBurrow: { x: 5, y: 38 },
    bossGateBurrow: { x: 44, y: 30 },
  },
  bossArena: {
    x: 41,
    y: 41,
    bounds: {
      x: 35, y: 35, width: 14, height: 14,
    },
    gates: [
      { x: 40, y: 34 },
      { x: 41, y: 34 },
      { x: 42, y: 34 },
      { x: 34, y: 40 },
      { x: 34, y: 41 },
      { x: 34, y: 42 },
    ],
  },
  secrets: {
    scroll: {
      x: 42,
      y: 3,
      room: {
        x: 41, y: 3, width: 3, height: 3, entry: 'crackedWall', door: { x: 42, y: 6 },
      },
    },
    fragment: {
      x: 20,
      y: 17,
      room: {
        x: 20, y: 17, width: 3, height: 1, entry: 'hiddenPassage', door: { x: 21, y: 18 },
      },
    },
    burrow: {
      x: 2,
      y: 46,
      room: {
        x: 2, y: 44, width: 3, height: 3, entry: 'crackedWall', door: { x: 4, y: 43 },
      },
    },
  },
};

const AKATSUKI_50: CampaignStageLayout = {
  size: 50,
  playerSpawns: [{ x: 1, y: 1 }, { x: 9, y: 7 }, { x: 1, y: 7 }, { x: 9, y: 1 }],
  entrance: { x: 1, y: 1 },
  outerDistrict: { x: 17, y: 8 },
  rescueTargets: [{ x: 20, y: 9 }, { x: 26, y: 18 }],
  structure: { x: 21, y: 23 },
  miniBossGate: { x: 33, y: 25 },
  spawnPoints: {
    mainGate: { x: 15, y: 27 },
    outerBurrow: { x: 25, y: 8 },
    bossGateBurrow: { x: 33, y: 32 },
  },
  bossArena: {
    x: 42,
    y: 25,
    bounds: {
      x: 37, y: 17, width: 12, height: 17,
    },
    gates: [
      { x: 36, y: 24 },
      { x: 36, y: 25 },
      { x: 36, y: 26 },
      { x: 41, y: 16 },
      { x: 42, y: 16 },
      { x: 43, y: 16 },
    ],
  },
  secrets: {
    scroll: {
      x: 46,
      y: 14,
      room: {
        x: 45, y: 12, width: 3, height: 3, entry: 'crackedWall', door: { x: 46, y: 11 },
      },
    },
    fragment: {
      x: 3,
      y: 42,
      room: {
        x: 2, y: 40, width: 3, height: 3, entry: 'hiddenPassage', door: { x: 3, y: 39 },
      },
    },
    burrow: {
      x: 47,
      y: 41,
      room: {
        x: 45, y: 40, width: 3, height: 3, entry: 'crackedWall', door: { x: 44, y: 41 },
      },
    },
  },
};

const WAR_50: CampaignStageLayout = {
  size: 50,
  playerSpawns: [{ x: 1, y: 1 }, { x: 9, y: 7 }, { x: 1, y: 7 }, { x: 9, y: 1 }],
  entrance: { x: 1, y: 1 },
  outerDistrict: { x: 20, y: 4 },
  rescueTargets: [{ x: 30, y: 6 }, { x: 6, y: 30 }],
  structure: { x: 22, y: 23 },
  miniBossGate: { x: 30, y: 23 },
  spawnPoints: {
    mainGate: { x: 17, y: 18 },
    outerBurrow: { x: 19, y: 36 },
    bossGateBurrow: { x: 30, y: 20 },
  },
  bossArena: {
    x: 40,
    y: 23,
    bounds: {
      x: 33, y: 15, width: 16, height: 18,
    },
    gates: [
      { x: 32, y: 22 },
      { x: 32, y: 23 },
      { x: 32, y: 24 },
      { x: 39, y: 33 },
      { x: 40, y: 33 },
      { x: 41, y: 33 },
    ],
  },
  secrets: {
    scroll: {
      x: 41,
      y: 2,
      room: {
        x: 40, y: 2, width: 3, height: 2, entry: 'hiddenPassage', door: { x: 41, y: 4 },
      },
    },
    fragment: {
      x: 2,
      y: 46,
      room: {
        x: 2, y: 45, width: 3, height: 3, entry: 'crackedWall', door: { x: 5, y: 46 },
      },
    },
    burrow: {
      x: 22,
      y: 47,
      room: {
        x: 21, y: 45, width: 3, height: 3, entry: 'crackedWall', door: { x: 22, y: 44 },
      },
    },
  },
};

export const CAMPAIGN_STAGE_LAYOUTS: Record<StageId, CampaignStageLayout> = {
  hiddenLeaf: LEAF_50,
  hiddenSand: SAND_50,
  hiddenMist: MIST_50,
  hiddenCloud: CLOUD_50,
  hiddenStone: STONE_50,
  akatsukiHideout: AKATSUKI_50,
  greatShinobiWar: WAR_50,
};
