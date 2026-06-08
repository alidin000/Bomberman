import { CharacterId } from '../content/types';
import { calculateFogOfWar, cellKey } from './fogOfWar';
import { createInitialState } from './initialState';
import { parseMapRows } from './mapLoader';
import { GameConfig, MonsterState } from './types';

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

const wallSenseMap = parseMapRows([
  'WWWWWWWWWWWWWWW',
  'W      W      W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'WWWWWWWWWWWWWWW',
].map((row) => row.split('')));

function createSoloConfig(characterId: CharacterId): GameConfig {
  return {
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: 'hiddenSand',
    stageId: 'hiddenSand',
    selectedCharacters: [characterId],
    map: openMap,
  };
}

function hiddenMonster(x: number, y: number): MonsterState {
  return {
    id: 'hidden-zetsu',
    name: 'Hidden Zetsu',
    x,
    y,
    kind: 'basic',
    moveCooldown: 0,
  };
}

describe('fogOfWar', () => {
  it.each([
    ['sasuke', 8, 1],
    ['itachi', 8, 1],
    ['minato', 7, 1],
  ] as const)('lets %s sense hidden enemies without revealing terrain', (
    characterId,
    monsterX,
    monsterY
  ) => {
    const monsterCell = cellKey(monsterX, monsterY);
    const state = {
      ...createInitialState(createSoloConfig(characterId)),
      monsters: [hiddenMonster(monsterX, monsterY)],
    };

    const fog = calculateFogOfWar(state);

    expect(fog.visible).not.toContain(monsterCell);
    expect(fog.sensedEnemies).toContain(monsterCell);
    expect(fog.explored).not.toContain(monsterCell);
  });

  it('lets Gaara sense blocked cells outside normal vision', () => {
    const wallCell = cellKey(7, 1);
    const state = createInitialState({
      ...createSoloConfig('gaara'),
      map: wallSenseMap,
    });

    const fog = calculateFogOfWar(state);

    expect(fog.visible).not.toContain(wallCell);
    expect(fog.explored).not.toContain(wallCell);
    expect(fog.sensedWalls).toContain(wallCell);
  });
});
