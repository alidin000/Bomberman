import { gameReducer } from './reducer';
import { createBossForConfig, createInitialState } from './initialState';
import { GameConfig, GameEngineState, MonsterState } from './types';
import { applyPowerUp } from './players';
import { cellKey } from './fogOfWar';
import { tickMonsters } from './monsters';
import { parseMapRows } from './mapLoader';
import { defaultMap } from '../constants/contants';
import { isObstacle } from '../model/gameItem';
import { getCampaignPickupPool } from '../content/characterPowerups';
import { resolveZetsuOutcomeKind } from './campaignExploration';
import { STAGE_DEFINITIONS } from '../content/stages';
import { CAMPAIGN_MISSIONS, getCampaignMission } from '../content/campaignMissions';

const baseConfig: GameConfig = {
  numPlayers: 2,
  totalRounds: 1,
  selectedMap: 'map1',
  map: parseMapRows(defaultMap),
};

const soloConfig: GameConfig = {
  ...baseConfig,
  mode: 'solo',
  numPlayers: 1,
  selectedCharacters: ['deidara'],
  stageId: 'hiddenSand',
};

const akatsukiMap = parseMapRows([
  'WWWWWWWWWWWWWWW',
  'W B B   B B  W',
  'W  WWW B  W  W',
  'WB   B B   B W',
  'W B W   W B  W',
  'W  B W W   B W',
  'W B   B WWW  W',
  'W  W  B   B W',
  'W  B B   B  W',
  'WWWWWWWWWWWWWWW',
].map((row) => row.split('')));

const hiddenLeafCampaignMap = parseMapRows([
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'W                                 W',
  'W  B    B    B    B    B    B     W',
  'W                                 W',
  'W     B      B      B      B      W',
  'W                                 W',
  'W                                 W',
  'W  B    B    B    B    B    B     W',
  'W                                 W',
  'W     B      B      B      B      W',
  'W                                 W',
  'W                                 W',
  'W  B    B    B    B    B    B     W',
  'W                                 W',
  'W     B      B      B      B      W',
  'W                                 W',
  'W                                 W',
  'W                                 W',
  'W                                 W',
  'W     B      B      B      B      W',
  'W                                 W',
  'W  B    B    B    B    B    B     W',
  'W                                 W',
  'W     B      B      B      B      W',
  'W                                 W',
  'W                                 W',
  'W  B    B    B    B    B    B     W',
  'W                                 W',
  'W     B      B      B      B      W',
  'W                                 W',
  'W                                 W',
  'W  B    B    B    B    B    B     W',
  'W                                 W',
  'W                                 W',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
].map((row) => row.split('')));

const hiddenLeafCampaignConfig: GameConfig = {
  ...baseConfig,
  mode: 'solo',
  numPlayers: 1,
  selectedMap: 'hiddenLeaf',
  stageId: 'hiddenLeaf',
  selectedCharacters: ['naruto'],
  map: hiddenLeafCampaignMap,
};

const campaignStageIds = STAGE_DEFINITIONS.map((stage) => stage.id);

function unlockBossForTest(state: GameEngineState): GameEngineState {
  const { campaign } = state;
  return {
    ...state,
    campaign: campaign
      ? {
        ...campaign,
        missionResult: 'success',
        bossUnlocked: true,
        bossArena: { ...campaign.bossArena, unlocked: true },
        objectives: campaign.objectives.map((objective) => ({
          ...objective,
          status: 'complete',
          current: objective.target,
          ticksRemaining: objective.kind === 'defense' ? 0 : objective.ticksRemaining,
          targets: objective.targets?.map((target) => ({ ...target, rescued: true })),
        })),
        structures: campaign.structures.map((structure) => ({
          ...structure,
          status: 'complete',
        })),
      }
      : campaign,
    boss: createBossForConfig(state.config),
    monsters: [],
  };
}

const abilityTestMap = parseMapRows([
  'WWWWWWW',
  'W     W',
  'W     W',
  'W     W',
  'W     W',
  'W     W',
  'WWWWWWW',
].map((row) => row.split('')));

function shinobiEnemy(
  partial: Partial<MonsterState> & Pick<MonsterState, 'id' | 'name' | 'x' | 'y' | 'kind'>
): MonsterState {
  return {
    moveCooldown: 1000,
    abilityCooldown: 0,
    abilityWarningTicks: 0,
    abilityTarget: null,
    ...partial,
  };
}

describe('gameReducer', () => {
  it('initializes game state', () => {
    const state = gameReducer(null, { type: 'INIT', config: baseConfig });
    expect(state).not.toBeNull();
    expect(state!.players).toHaveLength(2);
    expect(state!.monsters.length).toBeGreaterThan(0);
    expect(state!.phase).toBe('playing');
  });

  it('spawns ninja enemies for village arena maps', () => {
    const state = createInitialState({
      ...baseConfig,
      selectedMap: 'hiddenSand',
      stageId: 'hiddenSand',
    });

    expect(state.monsters.length).toBeGreaterThan(0);
    expect(state.monsters.map((monster) => monster.name)).toContain('Puppet Scout');
  });

  it('keeps local arena maps fully visible', () => {
    const state = createInitialState(baseConfig);
    const mapCells = state.map.reduce((count, row) => count + row.length, 0);

    expect(state.fogOfWar.visible).toHaveLength(mapCells);
    expect(state.fogOfWar.explored).toHaveLength(mapCells);
  });

  it('initializes campaign fog from character vision radius', () => {
    const narutoState = createInitialState({
      ...soloConfig,
      selectedCharacters: ['naruto'],
    });
    const sasukeState = createInitialState({
      ...soloConfig,
      selectedCharacters: ['sasuke'],
    });

    expect(narutoState.fogOfWar.visible).toContain(cellKey(4, 1));
    expect(narutoState.fogOfWar.visible).not.toContain(cellKey(6, 1));
    expect(sasukeState.fogOfWar.visible).toContain(cellKey(6, 1));
  });

  it('gates the Hidden Leaf boss behind campaign objectives', () => {
    const state = createInitialState(hiddenLeafCampaignConfig);

    expect(state.map).toHaveLength(35);
    expect(state.map[0]).toHaveLength(35);
    expect(state.campaign?.title).toBe('Hidden Leaf Emergency');
    expect(state.campaign?.missionStep).toBe('rescue');
    expect(state.campaign?.missionResult).toBe('in_progress');
    expect(state.campaign?.districts.map((district) => district.id)).toEqual([
      'hiddenLeaf-entrance',
      'hiddenLeaf-outer-district',
      'hiddenLeaf-center',
      'hiddenLeaf-boss-gate',
    ]);
    expect(state.campaign?.spawnPoints[0]).toMatchObject({
      id: 'hiddenLeaf-main-gate',
      x: 6,
      y: 5,
      respawnMs: 20000,
      maxActive: 3,
    });
    expect(state.monsters.map((monster) => monster.archetype)).toEqual(
      expect.arrayContaining(['rogueGenin', 'mistNinja'])
    );
    expect(state.boss).toBeNull();
    expect(state.campaign?.objectives[0]).toMatchObject({
      id: 'rescueLeafVillagers',
      status: 'active',
      current: 0,
      target: 2,
    });
    expect(state.campaign?.objectives[1]).toMatchObject({
      id: 'protectHokageBuilding',
      status: 'locked',
    });
    expect(state.campaign?.objectives[2]).toMatchObject({
      id: 'confrontIruka',
      status: 'locked',
    });
  });

  it('defines Phase 1 and Phase 2 campaign content for every stage', () => {
    expect(CAMPAIGN_MISSIONS.map((mission) => mission.stageId)).toEqual(campaignStageIds);

    STAGE_DEFINITIONS.forEach((stage) => {
      const mission = getCampaignMission(stage.id);
      expect(mission).not.toBeNull();
      expect(mission).toMatchObject({
        stageId: stage.id,
      });
      expect(mission?.objectives.map((objective) => objective.kind)).toEqual([
        'rescue',
        'defense',
        'miniBoss',
      ]);
      expect(mission?.bossArena.requires).toEqual([
        mission?.objectives[2].id,
      ]);
      expect(mission?.spawnPoints).toHaveLength(3);
      expect(mission?.spawnPoints.every((point) => (
        point.respawnMs === 20000
        && point.maxActive >= 3
        && point.archetypes.length >= 2
      ))).toBe(true);
      expect(mission?.hiddenAreas).toHaveLength(3);
      expect(mission?.hiddenAreas.some((area) => area.rewardPowerUp)).toBe(true);
      expect(mission?.hiddenAreas.some((area) => area.enemyArchetype === 'blackZetsu'))
        .toBe(true);
    });
  });

  it('lets every campaign stage complete Phase 1 objectives and unlock its boss', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      let state = createInitialState({
        ...hiddenLeafCampaignConfig,
        selectedMap: stage.mapId,
        stageId: stage.id,
      });
      const mission = state.campaign;
      expect(mission?.stageId).toBe(stage.id);
      expect(state.boss).toBeNull();

      mission?.objectives[0].targets?.forEach((target) => {
        state = {
          ...state,
          players: state.players.map((player) => ({ ...player, x: target.x, y: target.y })),
        };
        state = gameReducer(state, { type: 'TICK', deltaMs: 0 })!;
      });
      expect(state.campaign?.objectives[0].status).toBe('complete');

      state = gameReducer(state, { type: 'TICK', deltaMs: 20000 })!;
      expect(state.campaign?.objectives[1].status).toBe('complete');

      const miniBoss = state.campaign?.objectives[2];
      const guardId = `${miniBoss?.id}-guard`;
      expect(state.monsters.some((monster) => (
        monster.id === guardId
        && monster.name === miniBoss?.miniBossLabel
        && monster.elite
      ))).toBe(true);
      state = {
        ...state,
        players: state.players.map((player) => ({
          ...player,
          x: miniBoss?.x ?? player.x,
          y: miniBoss?.y ?? player.y,
        })),
      };
      state = gameReducer(state, { type: 'TICK', deltaMs: 0 })!;

      expect(state.campaign?.objectives[2].status).toBe('active');
      expect(state.campaign?.bossUnlocked).toBe(false);

      state = {
        ...state,
        monsters: state.monsters.filter((monster) => monster.id !== guardId),
      };
      state = gameReducer(state, { type: 'TICK', deltaMs: 0 })!;

      expect(state.campaign?.objectives[2].status).toBe('complete');
      expect(state.campaign?.bossUnlocked).toBe(true);
      expect(state.boss?.id).toBe(stage.bossId);
    });
  });

  it('uses character-specific campaign pickup pools and the PRD Zetsu outcome bands', () => {
    expect(getCampaignPickupPool('naruto')).toContain('Rasengan');
    expect(getCampaignPickupPool('naruto')).not.toContain('Sharingan');
    expect(getCampaignPickupPool('sasuke')).toContain('Sharingan');
    expect(getCampaignPickupPool('minato')).toContain('FTGKunai');

    expect(resolveZetsuOutcomeKind(59)).toBe('nothing');
    expect(resolveZetsuOutcomeKind(60)).toBe('powerUp');
    expect(resolveZetsuOutcomeKind(79)).toBe('powerUp');
    expect(resolveZetsuOutcomeKind(80)).toBe('whiteZetsu');
    expect(resolveZetsuOutcomeKind(95)).toBe('eliteZetsu');
    expect(resolveZetsuOutcomeKind(99)).toBe('rareReward');
  });

  it('reveals authored hidden rewards after a campaign crate is destroyed', () => {
    let state = createInitialState(hiddenLeafCampaignConfig);
    const map = state.map.map((row) => [...row]);
    map[2][3] = 'Empty';
    state = {
      ...state,
      map,
      monsters: [],
      destroyedBoxes: [{
        x: 3,
        y: 2,
        ticksRemaining: 1,
        pendingPowerUp: null,
        pendingOutcome: {
          kind: 'powerUp',
          powerUp: 'Rasengan',
          secretId: 'hiddenLeaf-scroll-cache',
          label: 'Training Grounds Secret Scroll',
        },
      }],
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 2 })!;

    expect(state.map[2][3]).toBe('Rasengan');
    expect(state.campaign?.discoveredSecrets).toContain('hiddenLeaf-scroll-cache');
  });

  it('spawns Zetsu ambushes from campaign destruction outcomes', () => {
    let state = createInitialState(hiddenLeafCampaignConfig);
    const map = state.map.map((row) => [...row]);
    map[31][28] = 'Empty';
    state = {
      ...state,
      map,
      monsters: [],
      destroyedBoxes: [{
        x: 28,
        y: 31,
        ticksRemaining: 1,
        pendingPowerUp: null,
        pendingOutcome: {
          kind: 'eliteZetsu',
          enemyArchetype: 'blackZetsu',
          secretId: 'hiddenLeaf-zetsu-burrow',
          label: 'Forest Zetsu Burrow',
        },
      }],
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 2 })!;

    expect(state.monsters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'hiddenLeaf-zetsu-burrow-enemy',
        archetype: 'blackZetsu',
        abilityKind: 'zetsuMelee',
      }),
    ]));
    expect(state.campaign?.discoveredSecrets).toContain('hiddenLeaf-zetsu-burrow');
  });

  it('respawns campaign enemies with timers and max-active tracking', () => {
    let state = createInitialState(hiddenLeafCampaignConfig);
    state = {
      ...state,
      monsters: [],
      campaign: state.campaign
        ? {
          ...state.campaign,
          spawnPoints: state.campaign.spawnPoints.map((point, index) => ({
            ...point,
            activeMonsterIds: [],
            ticksRemaining: index === 0 ? 1 : point.respawnMs,
            maxActive: index === 0 ? 2 : point.maxActive,
          })),
        }
        : state.campaign,
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 20 })!;

    expect(state.monsters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'hiddenLeaf-main-gate-1',
        spawnPointId: 'hiddenLeaf-main-gate',
      }),
    ]));
    expect(state.campaign?.spawnPoints[0].activeMonsterIds).toContain('hiddenLeaf-main-gate-1');
    expect(state.campaign?.spawnPoints[0].ticksRemaining).toBe(20000);
  });

  it('starts warned enemy ability state and readable hazard targets', () => {
    let state = createInitialState({
      ...baseConfig,
      map: abilityTestMap,
      selectedMap: 'ability-test',
    });
    state = {
      ...state,
      players: state.players.map((player, index) => (
        index === 0
          ? { ...player, x: 3, y: 3 }
          : { ...player, alive: false }
      )),
      monsters: [
        shinobiEnemy({
          id: 'genin',
          name: 'Rogue Genin',
          x: 1,
          y: 3,
          kind: 'basic',
          archetype: 'rogueGenin',
          abilityKind: 'kunaiThrow',
          abilityLabel: 'Kunai Throw',
        }),
        shinobiEnemy({
          id: 'sand',
          name: 'Sand Ninja',
          x: 3,
          y: 1,
          kind: 'smart',
          archetype: 'sandNinja',
          abilityKind: 'sandSpike',
          abilityLabel: 'Sand Spike',
        }),
        shinobiEnemy({
          id: 'cloud',
          name: 'Cloud Ninja',
          x: 5,
          y: 3,
          kind: 'fork',
          archetype: 'cloudNinja',
          abilityKind: 'lightningStrike',
          abilityLabel: 'Lightning Strike',
        }),
      ],
      hazards: [],
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.monsters.every((monster) => (monster.abilityWarningTicks ?? 0) > 0))
      .toBe(true);
    expect(state.monsters[0].abilityTarget).toEqual({ x: 3, y: 3 });
    expect(state.hazards.map((hazard) => hazard.kind)).toEqual(
      expect.arrayContaining(['chakraShockwave', 'sandSpikes', 'airStrike'])
    );
  });

  it('moves smart monsters along the shared distance field instead of dead ends', () => {
    let state = createInitialState(baseConfig);
    const map = parseMapRows([
      'WWWWWWW',
      'W  W  W',
      'W WWW W',
      'W     W',
      'WWWWWWW',
    ].map((row) => row.split('')));
    state = {
      ...state,
      map,
      players: state.players.map((player, index) => (
        index === 0
          ? {
            ...player, x: 5, y: 1, alive: true,
          }
          : { ...player, alive: false }
      )),
      monsters: [
        shinobiEnemy({
          id: 'smart-pathfinder',
          name: 'Smart Pathfinder',
          kind: 'smart',
          x: 1,
          y: 1,
          moveCooldown: 0,
        }),
      ],
    };

    const next = tickMonsters(state, 1000);

    expect(next.monsters[0]).toMatchObject({ x: 1, y: 2 });
  });

  it('resolves body flicker, water clone, and Zetsu melee abilities', () => {
    let state = createInitialState({
      ...baseConfig,
      map: abilityTestMap,
      selectedMap: 'ability-test',
    });
    state = {
      ...state,
      players: state.players.map((player, index) => (
        index === 0
          ? { ...player, x: 3, y: 3 }
          : { ...player, alive: false }
      )),
      monsters: [
        shinobiEnemy({
          id: 'anbu',
          name: 'ANBU',
          x: 1,
          y: 1,
          kind: 'fork',
          archetype: 'anbu',
          abilityKind: 'bodyFlicker',
          abilityLabel: 'Body Flicker',
          abilityWarningTicks: 1,
          abilityTarget: { x: 2, y: 3 },
        }),
        shinobiEnemy({
          id: 'mist',
          name: 'Mist Ninja',
          x: 5,
          y: 1,
          kind: 'ghost',
          archetype: 'mistNinja',
          abilityKind: 'waterClone',
          abilityLabel: 'Water Clone',
          abilityWarningTicks: 1,
          abilityTarget: { x: 4, y: 3 },
        }),
        shinobiEnemy({
          id: 'zetsu',
          name: 'White Zetsu',
          x: 1,
          y: 5,
          kind: 'ghost',
          archetype: 'whiteZetsu',
          abilityKind: 'zetsuMelee',
          abilityLabel: 'Zetsu Ambush',
          abilityWarningTicks: 1,
          abilityTarget: { x: 3, y: 3 },
        }),
      ],
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 10 })!;

    expect(state.monsters.find((monster) => monster.id === 'anbu')).toMatchObject({
      abilityWarningTicks: 0,
      abilityTarget: null,
    });
    expect(state.monsters.some((monster) => monster.clone && monster.name === 'Water Clone'))
      .toBe(true);
    expect(state.players[0].alive).toBe(false);
  });

  it('rescues villagers, clears Iruka gate, and spawns Kurama', () => {
    let state = createInitialState(hiddenLeafCampaignConfig);

    state = {
      ...state,
      players: state.players.map((player) => ({ ...player, x: 3, y: 1 })),
    };
    state = gameReducer(state, { type: 'TICK', deltaMs: 0 })!;
    expect(state.campaign?.objectives[0]).toMatchObject({
      current: 1,
      status: 'active',
    });
    expect(state.campaign?.missionStep).toBe('rescue');
    expect(state.boss).toBeNull();

    state = {
      ...state,
      players: state.players.map((player) => ({ ...player, x: 10, y: 6 })),
    };
    state = gameReducer(state, { type: 'TICK', deltaMs: 0 })!;
    expect(state.campaign?.objectives[0].status).toBe('complete');
    expect(state.campaign?.objectives[1].status).toBe('active');
    expect(state.campaign?.missionStep).toBe('defense');
    expect(state.boss).toBeNull();

    state = gameReducer(state, { type: 'TICK', deltaMs: 20000 })!;

    expect(state.campaign?.objectives[1].status).toBe('complete');
    expect(state.campaign?.objectives[2].status).toBe('active');
    expect(state.campaign?.missionStep).toBe('miniBoss');
    expect(state.campaign?.bossUnlocked).toBe(false);
    expect(state.boss).toBeNull();
    expect(state.monsters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'confrontIruka-guard',
        name: 'Iruka',
        elite: true,
      }),
    ]));

    state = {
      ...state,
      players: state.players.map((player) => ({ ...player, x: 29, y: 29 })),
    };
    state = gameReducer(state, { type: 'TICK', deltaMs: 0 })!;

    expect(state.campaign?.objectives[2].status).toBe('active');
    expect(state.campaign?.bossUnlocked).toBe(false);
    expect(state.boss).toBeNull();

    state = {
      ...state,
      monsters: state.monsters.filter((monster) => monster.id !== 'confrontIruka-guard'),
    };
    state = gameReducer(state, { type: 'TICK', deltaMs: 0 })!;

    expect(state.campaign?.objectives[2].status).toBe('complete');
    expect(state.campaign?.missionStep).toBe('boss');
    expect(state.campaign?.bossArena.unlocked).toBe(true);
    expect(state.campaign?.bossUnlocked).toBe(true);
    expect(state.boss?.name).toBe('Kurama');
    expect(state.boss).toMatchObject({ x: 17, y: 17 });
  });

  it('fails the Hidden Leaf mission when Hokage Building is destroyed', () => {
    let state = createInitialState(hiddenLeafCampaignConfig);
    state = {
      ...state,
      players: state.players.map((player) => ({ ...player, x: 3, y: 1 })),
    };
    state = gameReducer(state, { type: 'TICK', deltaMs: 0 })!;
    state = {
      ...state,
      players: state.players.map((player) => ({ ...player, x: 10, y: 6 })),
    };
    state = gameReducer(state, { type: 'TICK', deltaMs: 0 })!;

    state = {
      ...state,
      explosions: [{ x: 17, y: 16, ticksRemaining: 300 }],
      campaign: state.campaign
        ? {
          ...state.campaign,
          objectives: state.campaign.objectives.map((objective) => (
            objective.id === 'protectHokageBuilding'
              ? { ...objective, structureHp: 40 }
              : objective
          )),
        }
        : state.campaign,
    };
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.campaign?.missionResult).toBe('failed');
    expect(state.campaign?.missionStep).toBe('failed');
    expect(state.phase).toBe('game_over');
    expect(state.resultMessage).toContain('mission failed');
    expect(state.boss).toBeNull();
  });

  it('keeps explored campaign cells in memory after moving out of sight', () => {
    let state = createInitialState({
      ...soloConfig,
      selectedCharacters: ['naruto'],
    });
    const rememberedCell = cellKey(1, 4);

    for (let step = 0; step < 20; step += 1) {
      state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    }

    expect(state.fogOfWar.visible).not.toContain(rememberedCell);
    expect(state.fogOfWar.explored).toContain(rememberedCell);
  });

  it('moves player within bounds', () => {
    let state = createInitialState(baseConfig);
    const startX = state.players[0].x;
    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    expect(state.players[0].x).toBeGreaterThanOrEqual(startX);
  });

  it('keeps local players inside shared-screen movement bounds', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedMap: 'hiddenLeaf',
      map: hiddenLeafCampaignMap,
    });
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, x: 8, y: 10 }
          : { ...player, x: 20, y: 10 }
      )),
    };

    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'left' })!;

    expect(state.players[0].x).toBeCloseTo(8);

    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;

    expect(state.players[0].x).toBeCloseTo(8.1);
  });

  it('moves players in tenth-cell increments while bombs stay grid-snapped', () => {
    let state = createInitialState(baseConfig);

    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    expect(state.players[0].x).toBeCloseTo(1.1);

    for (let step = 0; step < 9; step += 1) {
      state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    }

    expect(state.players[0].x).toBeCloseTo(2);
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    expect(state.bombs[0]).toMatchObject({ x: 2, y: 1 });
  });

  it('recenters players into lanes while moving with decimal positions', () => {
    let state = createInitialState(baseConfig);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, x: 1, y: 1.3 }
          : player
      )),
    };

    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;

    expect(state.players[0].x).toBeCloseTo(1.1);
    expect(state.players[0].y).toBeCloseTo(1.2);
  });

  it('clears spawn lanes so player two Minato can move from Akatsuki start', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedMap: 'akatsukiHideout',
      stageId: 'akatsukiHideout',
      map: akatsukiMap,
      selectedCharacters: ['itachi', 'minato'],
    });

    expect(state.map[8][13]).toBe('Empty');
    expect(state.map[8][12]).toBe('Empty');
    expect(state.players[1].characterId).toBe('minato');
    expect(state.players[1].powerUps).toContain('RollerSkate');

    state = gameReducer(state, { type: 'MOVE', playerId: 'player2', direction: 'left' })!;

    expect(state.players[1].x).toBeCloseTo(12.9);
  });

  it('places bomb on empty cell', () => {
    let state = createInitialState(baseConfig);
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    expect(state.bombs).toHaveLength(1);
    expect(state.players[0].activeBombs).toBe(1);
  });

  it('lets players walk out of their placed bomb before it becomes solid', () => {
    let state = createInitialState(baseConfig);

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    expect(state.players[0].x).toBeCloseTo(1.1);

    for (let step = 0; step < 7; step += 1) {
      state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    }

    expect(state.players[0].x).toBeCloseTo(1.8);
    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'left' })!;
    expect(state.players[0].x).toBeCloseTo(1.8);
  });

  it('drops a Naruto shadow clone charge beside the first bomb', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['naruto', 'sasuke'],
    });

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;

    expect(state.bombs).toHaveLength(2);
    expect(state.bombs.every((bomb) => bomb.kind === 'shadowClone')).toBe(true);
    expect(state.bombs.map((bomb) => `${bomb.x},${bomb.y}`)).toEqual(['1,1', '2,1']);
  });

  it('lets Sasuke Chidori mines pierce boxes', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['sasuke', 'naruto'],
    });
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, x: 5, y: 1 }
          : player
      )),
    };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 1750 })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.explosions).toEqual(expect.arrayContaining([
      expect.objectContaining({ x: 7, y: 1, kind: 'chidoriMine' }),
    ]));
  });

  it('uses Gaara sand bombs to trap beasts instead of removing them', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['gaara', 'itachi'],
    });
    state = {
      ...state,
      monsters: [{
        id: 'sand-target',
        name: 'Shukaku Cub',
        x: 2,
        y: 1,
        kind: 'basic',
        moveCooldown: 14000,
      }],
    };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3250 })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.monsters).toHaveLength(1);
    expect(state.monsters[0].moveCooldown).toBeGreaterThan(9000);
  });

  it('uses Minato thunder marks with a quick fuse', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['minato', 'itachi'],
    });

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;

    expect(state.bombs[0].kind).toBe('thunderMark');
    expect(state.bombs[0].ticksRemaining).toBe(1500);
  });

  it('lets Gaara spend his sand shield to survive his first blast hit', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['gaara', 'itachi'],
    });

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3250 })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.players[0].alive).toBe(true);
    expect(state.players[0].passiveState).toBe('Sand Shield Spent');
  });

  it('lets Itachi spend illusion dodge to survive first monster contact', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['itachi', 'gaara'],
    });
    state = {
      ...state,
      monsters: [{
        id: 'itachi-contact',
        name: 'Akatsuki Cultist',
        x: 1,
        y: 1,
        kind: 'smart',
        moveCooldown: 1000,
      }],
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.players[0].alive).toBe(true);
    expect(state.players[0].passiveState).toBe('Illusion Dodge Spent');
  });

  it('does not seal players from a clear lane without monster contact', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['naruto', 'sasuke'],
    });
    state = {
      ...state,
      monsters: [{
        id: 'sand-line',
        name: 'Sand Ninja',
        x: 3,
        y: 1,
        kind: 'smart',
        moveCooldown: 1000,
      }],
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.players[0].alive).toBe(true);
  });

  it('keeps detonator bombs from exploding on the timer', () => {
    let state = createInitialState(baseConfig);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, powerUps: ['Detonator'] }
          : player
      )),
    };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3000 })!;

    expect(state.bombs).toHaveLength(1);
    expect(state.bombs[0].manualDetonation).toBe(true);
  });

  it('detonates active detonator bombs with the detonate action', () => {
    let state = createInitialState(baseConfig);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, powerUps: ['Detonator'] }
          : player
      )),
    };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    expect(state.bombs).toHaveLength(1);

    state = gameReducer(state, { type: 'DETONATE_BOMBS', playerId: 'player1' })!;

    expect(state.bombs).toHaveLength(0);
    expect(state.players[0].activeBombs).toBe(0);
    expect(state.players[0].powerUps).not.toContain('Detonator');
  });

  it('applies the profile power-up effects to player state', () => {
    let state = createInitialState(baseConfig);
    const initial = state.players[0];

    state = applyPowerUp(state, 'player1', 'AddBomb');
    expect(state.players[0].maxBombs).toBe(initial.maxBombs + 1);
    expect(state.pickupMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: 'player1', power: 'AddBomb' }),
    ]));

    state = applyPowerUp(state, 'player1', 'BlastRangeUp');
    expect(state.players[0].bombRange).toBe(initial.bombRange + 1);

    state = applyPowerUp(state, 'player1', 'Detonator');
    expect(state.players[0].powerUps).toContain('Detonator');

    state = applyPowerUp(state, 'player1', 'RollerSkate');
    expect(state.players[0].powerUps).toContain('RollerSkate');

    state = applyPowerUp(createInitialState(baseConfig), 'player1', 'Invincibility');
    expect(state.players[0].powerUps).toContain('Invincibility');
    expect(state.timedPowerUps.player1).toEqual(expect.arrayContaining([
      expect.objectContaining({ power: 'Invincibility' }),
    ]));

    state = applyPowerUp(createInitialState(baseConfig), 'player1', 'Ghost');
    expect(state.players[0].powerUps).toContain('Ghost');
    expect(state.timedPowerUps.player1).toEqual(expect.arrayContaining([
      expect.objectContaining({ power: 'Ghost' }),
    ]));

    state = applyPowerUp(createInitialState(baseConfig), 'player1', 'Obstacle');
    expect(state.players[0].obstacles).toBe(3);
    expect(state.players[0].powerUps).toContain('Obstacle');

    state = applyPowerUp(state, 'player1', 'Obstacle');
    expect(state.players[0].obstacles).toBe(6);
    expect(state.players[0].powerUps.filter((power) => power === 'Obstacle')).toHaveLength(1);
  });

  it('spends cover charges with the cover action', () => {
    let state = createInitialState(baseConfig);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? {
            ...player,
            facing: 'right',
            obstacles: 1,
            powerUps: ['Obstacle'],
          }
          : player
      )),
    };

    state = gameReducer(state, { type: 'PLACE_OBSTACLE', playerId: 'player1' })!;

    expect(isObstacle(state.map[1][2])).toBe(true);
    expect(state.map[1][2]).toMatchObject({
      ownerId: 'player1',
      coords: { x: 2, y: 1 },
    });
    expect(state.players[0].obstacles).toBe(0);
    expect(state.players[0].powerUps).not.toContain('Obstacle');
    expect(state.bombs).toHaveLength(0);
  });

  it('does not place cover into a decimal cell occupied by the player', () => {
    let state = createInitialState(baseConfig);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? {
            ...player,
            x: 1.3,
            y: 1,
            facing: 'right',
            obstacles: 1,
            powerUps: ['Obstacle'],
          }
          : player
      )),
    };

    state = gameReducer(state, { type: 'PLACE_OBSTACLE', playerId: 'player1' })!;

    expect(state.map[1][2]).toBe('Empty');
    expect(state.players[0].obstacles).toBe(1);
    expect(state.players[0].powerUps).toContain('Obstacle');
  });

  it('does not let cover close the only adjacent escape cell', () => {
    let state = createInitialState(baseConfig);
    const map = parseMapRows([
      'WWWWW',
      'WWWWW',
      'WW  W',
      'WWWWW',
      'WWWWW',
    ].map((row) => row.split('')));
    state = {
      ...state,
      map,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? {
            ...player,
            x: 2,
            y: 2,
            facing: 'right',
            obstacles: 1,
            powerUps: ['Obstacle'],
          }
          : { ...player, alive: false }
      )),
      monsters: [],
    };

    state = gameReducer(state, { type: 'PLACE_OBSTACLE', playerId: 'player1' })!;

    expect(state.map[2][3]).toBe('Empty');
    expect(state.players[0].obstacles).toBe(1);
    expect(state.players[0].powerUps).toContain('Obstacle');
  });

  it('lets Ghost phase through player cover but punishes ending inside it', () => {
    let state = createInitialState(baseConfig);
    const map = state.map.map((row) => [...row]);
    map[1][2] = {
      ownerId: 'player2',
      coords: { x: 2, y: 1 },
    };
    state = {
      ...state,
      map,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? {
            ...player, x: 1.6, y: 1, powerUps: ['Ghost'],
          }
          : player
      )),
      timedPowerUps: {
        player1: [{
          power: 'Ghost',
          ticksRemaining: 1000,
          flashTicksRemaining: 0,
        }],
      },
    };

    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    expect(state.players[0].x).toBeCloseTo(1.7);

    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, x: 2, y: 1 }
          : player
      )),
      timedPowerUps: {
        player1: [{ power: 'Ghost', ticksRemaining: 10, flashTicksRemaining: 0 }],
      },
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.players[0].alive).toBe(false);
    expect(state.players[0].powerUps).not.toContain('Ghost');
  });

  it('lets Ghost phase through walls, boxes, and bombs', () => {
    const blockers = [
      { cell: 'Wall' as const },
      { cell: 'Box' as const },
      {
        cell: {
          range: 2,
          coords: { x: 2, y: 1 },
          ownerId: 'player2',
        },
      },
    ];

    blockers.forEach(({ cell }) => {
      let state = createInitialState(baseConfig);
      const map = state.map.map((row) => [...row]);
      map[1][2] = cell;
      state = {
        ...state,
        map,
        players: state.players.map((player) => (
          player.id === 'player1'
            ? {
              ...player, x: 1.6, y: 1, powerUps: ['Ghost'],
            }
            : player
        )),
        timedPowerUps: {
          player1: [{
            power: 'Ghost',
            ticksRemaining: 1000,
            flashTicksRemaining: 0,
          }],
        },
      };

      state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;

      expect(state.players[0].x).toBeCloseTo(1.7);
      expect(state.players[0].powerUps).toContain('Ghost');
    });
  });

  it('lets blasts destroy player-placed cover', () => {
    let state = createInitialState(baseConfig);
    const map = state.map.map((row) => [...row]);
    map[1][2] = { ownerId: 'player2', coords: { x: 2, y: 1 } };
    state = { ...state, map, monsters: [] };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3000 })!;

    expect(state.map[1][2]).toBe('Empty');
  });

  it('lets Guard protect players from blasts and monster contact', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['naruto', 'sasuke'],
    });
    state = {
      ...state,
      monsters: [{
        id: 'guard-contact',
        name: 'Guard Contact',
        x: 1,
        y: 1,
        kind: 'basic',
        moveCooldown: 1000,
      }],
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, powerUps: ['Invincibility'] }
          : player
      )),
      timedPowerUps: {
        player1: [{ power: 'Ghost', ticksRemaining: 5000, flashTicksRemaining: 0 }],
      },
    };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3000 })!;

    expect(state.players[0].alive).toBe(true);
  });

  it('removes monsters caught by bomb explosions', () => {
    let state = createInitialState(baseConfig);
    state = {
      ...state,
      monsters: [{
        id: 'test-monster',
        name: 'Test Monster',
        x: 2,
        y: 1,
        kind: 'basic',
        moveCooldown: 1000,
      }],
    };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3000 })!;

    expect(state.monsters).toHaveLength(0);
  });

  it('does not render explosion cells through indestructible walls', () => {
    let state = createInitialState(baseConfig);
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3000 })!;

    expect(state.explosions).not.toContainEqual({ x: 0, y: 1, ticksRemaining: 500 });
  });

  it('pauses and resumes', () => {
    let state = createInitialState(baseConfig);
    state = gameReducer(state, { type: 'PAUSE' })!;
    expect(state.paused).toBe(true);
    state = gameReducer(state, { type: 'RESUME' })!;
    expect(state.paused).toBe(false);
  });

  it('advances tick without crashing', () => {
    let state = createInitialState(baseConfig);
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;
    expect(state.tick).toBe(1);
  });

  it('gates campaign stage bosses behind village objectives', () => {
    const state = createInitialState(soloConfig);
    expect(state.boss).toBeNull();
    expect(state.campaign?.stageId).toBe('hiddenSand');
    expect(state.campaign?.bossUnlocked).toBe(false);
    expect(state.monsters.length).toBeGreaterThan(0);
    expect(state.players[0].characterId).toBe('deidara');
  });

  it('uses the character ultimate to place a giant clay bomb', () => {
    let state = createInitialState(soloConfig);
    state = gameReducer(state, { type: 'USE_ULTIMATE', playerId: 'player1' })!;
    expect(state.bombs[0].kind).toBe('giantClay');
    expect(state.bombs[0].ticksRemaining).toBe(2600);
    expect(state.players[0].ultimateCooldownRemaining).toBeGreaterThan(0);
  });

  it('temporarily reveals campaign cells around Deidara explosions', () => {
    const openMap = parseMapRows([
      'WWWWWWWWWWWWWWW',
      'W             W',
      'W             W',
      'W             W',
      'W             W',
      'W             W',
      'W             W',
      'W             W',
      'W             W',
      'WWWWWWWWWWWWWWW',
    ].map((row) => row.split('')));
    let state = createInitialState({
      ...soloConfig,
      map: openMap,
    });
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? {
            ...player,
            x: 7,
            y: 5,
            ultimateCharge: 100,
          }
          : player
      )),
    };
    state = gameReducer(state, { type: 'USE_ULTIMATE', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 2550 })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.explosions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'giantClay' }),
    ]));
    expect(state.fogOfWar.visible).toContain(cellKey(13, 5));
    expect(state.fogOfWar.explored).toContain(cellKey(13, 5));
  });

  it('gives ultimate bombs enough fuse time to escape after decimal movement', () => {
    let state = createInitialState({
      ...soloConfig,
      selectedCharacters: ['sasuke'],
    });

    state = gameReducer(state, { type: 'USE_ULTIMATE', playerId: 'player1' })!;

    expect(state.bombs[0].kind).toBe('kirin');
    expect(state.bombs[0].ticksRemaining).toBeGreaterThanOrEqual(2000);
  });

  it('snaps ultimate bombs to grid cells from decimal positions near walls', () => {
    let state = createInitialState(soloConfig);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, x: 1.2, y: 0.8 }
          : player
      )),
    };

    state = gameReducer(state, { type: 'USE_ULTIMATE', playerId: 'player1' })!;

    expect(state.bombs[0]).toMatchObject({ x: 1, y: 1, kind: 'giantClay' });
    expect(state.map[1][1]).toMatchObject({ coords: { x: 1, y: 1 } });
  });

  it('moves solo bosses and casts telegraphed hazards', () => {
    let state = unlockBossForTest(createInitialState(soloConfig));
    const start = { x: state.boss!.x, y: state.boss!.y };

    state = gameReducer(state, { type: 'TICK', deltaMs: 2000 })!;

    expect({ x: state.boss!.x, y: state.boss!.y }).not.toEqual(start);
    expect(state.boss!.currentAbility).toBeTruthy();
    expect(state.hazards.length).toBeGreaterThan(0);
  });

  it('lets Guard protect players from active boss hazards', () => {
    let state = createInitialState(soloConfig);
    state = {
      ...state,
      boss: state.boss
        ? { ...state.boss, attackCooldown: 99999, moveCooldown: 99999 }
        : state.boss,
      hazards: [{
        id: 'guard-test-hazard',
        kind: 'sandTornado',
        x: state.players[0].x,
        y: state.players[0].y,
        ticksRemaining: 100,
        warningTicks: 1500,
        color: '#f59e0b',
        damage: 1,
      }],
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, powerUps: ['Invincibility'] }
          : player
      )),
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.players[0].alive).toBe(true);
  });

  it('counts final match winners by player id instead of character name', () => {
    let state = createInitialState({
      ...baseConfig,
      totalRounds: 2,
      selectedCharacters: ['deidara', 'naruto'],
    });
    state = {
      ...state,
      round: 2,
      roundWinners: ['player1'],
      monsters: [],
      players: state.players.map((player) => (
        player.id === 'player2'
          ? { ...player, alive: false }
          : player
      )),
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.phase).toBe('game_over');
    expect(state.roundWinners).toEqual(['player1', 'player1']);
    expect(state.resultMessage).toBe('Deidara wins the match!');
  });

  it('declares a final draw when trial wins are tied', () => {
    let state = createInitialState({
      ...baseConfig,
      totalRounds: 2,
      selectedCharacters: ['deidara', 'naruto'],
    });
    state = {
      ...state,
      round: 2,
      roundWinners: ['player1'],
      monsters: [],
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, alive: false }
          : player
      )),
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.phase).toBe('game_over');
    expect(state.roundWinners).toEqual(['player1', 'player2']);
    expect(state.resultMessage).toBe('The match ends in a draw!');
  });
});
