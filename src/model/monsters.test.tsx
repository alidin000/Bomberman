import { vi, type Mock } from 'vitest';
/* eslint-disable no-shadow */
/* eslint-disable max-len */
import { Monster } from './monster';
import { GhostMonster } from './ghostMonster';
import { SmartMonster } from './smartMonster';
import { ForkMonster } from './forkMonster';
import { GameMap } from './gameItem';
import { Player } from './player';

describe('Monster Tests', () => {
  let map: GameMap;
  let player: Player;
  let otherMonsters: Monster[];

  beforeEach(() => {
    map = [
      ['Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Wall', 'Box', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty']
    ] as GameMap;
    player = new Player('1', 'Player One', 1, 1, true, 4, 2, [], 0, 'original.png', 'ghost.png', 'invincible.png');
    otherMonsters = [new Monster('2', 'Other Monster', 0, 0)];
  });

  type MonsterConstructor = new (id: string, name: string, x: number, y: number) => Monster;

  const testMonsterMovement = (MonsterClass: MonsterConstructor, monster: Monster) => {
    it('should move to a valid position', () => {
      // Test if the monster moves to a valid position on the map
      const newMonster = monster.move(map, [player], otherMonsters);
      const validMove = newMonster.getX() !== monster.getX() || newMonster.getY() !== monster.getY();
      expect(validMove).toBe(true);
    });

    it('should not collide with other monsters', () => {
      // Test if the monster avoids colliding with other monsters
      const monster = new Monster('1', 'Monster', 0, 1);
      otherMonsters = [new Monster('2', 'Other Monster', 0, 0)];
      const newMonster = monster.move(map, [player], otherMonsters);
      const collided = newMonster.getX() === 0 && newMonster.getY() === 0;
      expect(collided).toBe(false);
    });

    it('should not move if surrounded by obstacles', () => {
      // Test if the monster stays in place when surrounded by obstacles
      const surroundedMap = [
        ['Wall', 'Wall', 'Wall'],
        ['Wall', 'Empty', 'Wall'],
        ['Wall', 'Wall', 'Wall']
      ] as GameMap;
      const surroundedMonster = new MonsterClass('1', 'Monster', 1, 1);
      const newMonster = surroundedMonster.move(surroundedMap, [player], otherMonsters);
      expect(newMonster.getX()).toBe(1);
      expect(newMonster.getY()).toBe(1);
    });
  };

  describe('General Monster tests', () => {
    testMonsterMovement(Monster, new Monster('1', 'Monster', 2, 2));
  });

  describe('GhostMonster Specific Tests', () => {
    beforeEach(() => {
      otherMonsters = [new GhostMonster('2', 'Other GhostMonster', 0, 0)];
    });

    testMonsterMovement(GhostMonster, new GhostMonster('1', 'GhostMonster', 2, 2));

    it('should move through walls', () => {
      // Test if the GhostMonster can move through walls
      const ghostMonster = new GhostMonster('1', 'GhostMonster', 1, 1);
      const newMonster = ghostMonster.move(map);
      const movedThroughWall = newMonster.getX() !== 1 || newMonster.getY() !== 1;
      expect(movedThroughWall).toBe(true);
    });

    it('should move randomly if no obstacles are present', () => {
      // Test if the GhostMonster moves randomly when no obstacles are present
      const emptyMap = [
        ['Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty']
      ] as GameMap;
      const ghostMonster = new GhostMonster('1', 'GhostMonster', 1, 1);
      const newMonster = ghostMonster.move(emptyMap);
      const moved = newMonster.getX() !== 1 || newMonster.getY() !== 1;
      expect(moved).toBe(true);
    });
  });

  describe('SmartMonster Specific Tests', () => {
    beforeEach(() => {
      otherMonsters = [new SmartMonster('2', 'Other SmartMonster', 0, 0)];
    });

    testMonsterMovement(SmartMonster, new SmartMonster('1', 'SmartMonster', 2, 2));

    it('should use A* pathfinding', () => {
      // Test if the SmartMonster uses A* pathfinding algorithm
      const smartMonster = new SmartMonster('1', 'SmartMonster', 1, 1);
      const path = smartMonster.aStarSearch(map, { x: 1, y: 1 }, { x: 2, y: 2 });
      expect(path.length).toBeGreaterThan(1);
    });
    it('should correctly calculate heuristic distance', () => {
      const smartMonster = new SmartMonster('1', 'SmartMonster', 1, 1);
      const distance = smartMonster.heuristic({ x: 1, y: 1 }, { x: 4, y: 5 });
      expect(distance).toBe(7); // 3 (x) + 4 (y) = 7
    });
  });

  describe('ForkMonster Specific Tests', () => {
    beforeEach(() => {
      otherMonsters = [new ForkMonster('2', 'Other ForkMonster', 0, 0)];
    });

    testMonsterMovement(ForkMonster, new ForkMonster('1', 'ForkMonster', 2, 2));

    it('should find closest player', () => {
      // Test if the ForkMonster can find the closest player
      const forkMonster = new ForkMonster('1', 'ForkMonster', 1, 1);
      const closestPlayer = forkMonster.findClosestPlayer([player]);
      expect(closestPlayer).toBe(player);
    });

    it('should pathfind to player correctly', () => {
      // Test if the ForkMonster pathfinds to the player correctly
      const forkMonster = new ForkMonster('1', 'ForkMonster', 1, 1);
      const path = forkMonster.pathfindToPlayer(player, [{ x: 2, y: 2 }]);
      expect(path).toEqual({ x: 2, y: 2 });
    });

    it('should randomly change direction', () => {
      // Test if the ForkMonster can randomly change direction
      vi.spyOn(global.Math, 'random').mockReturnValue(0.1); // Ensure random path chosen
      const forkMonster = new ForkMonster('1', 'ForkMonster', 1, 1);
      const direction = forkMonster.chooseDirection([{ x: 2, y: 1 }], [player]);
      expect(direction).toEqual({ x: 2, y: 1 });
      (global.Math.random as Mock).mockRestore();
    });

    it('should avoid obstacles while moving towards player', () => {
      // Test if the SmartMonster avoids obstacles while moving towards the player
      map[1][2] = 'Wall';
      const smartMonster = new SmartMonster('1', 'SmartMonster', 1, 1);
      const newMonster = smartMonster.move(map, [player], otherMonsters);
      const movedCorrectly = newMonster.getX() !== 1 || newMonster.getY() !== 1;
      expect(movedCorrectly).toBe(true);
    });
  });
});
