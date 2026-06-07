import {
  randomPowerUpGenerator, isPower, isBomb, isObstacle, Power, Bomb, gameItem
} from './gameItem';

describe('Game Utilities', () => {
  describe('randomPowerUpGenerator', () => {
    it('should return a valid power up', () => {
      const power = randomPowerUpGenerator();
      expect(power).toBeDefined();
      expect(typeof power).toBe('string');
      expect(['AddBomb', 'BlastRangeUp', 'Detonator', 'RollerSkate', 'Invincibility', 'Ghost', 'Obstacle']).toContain(power);
    });
  });

  describe('isPower', () => {
    it('should correctly identify power ups', () => {
      const power: Power = 'AddBomb';
      const nonPower: gameItem = 'Wall';

      expect(isPower(power)).toBeTruthy();
      expect(isPower(nonPower)).toBeFalsy();
    });
  });

  describe('isBomb', () => {
    it('should correctly identify bombs', () => {
      const bomb: Bomb = { range: 3, coords: { x: 1, y: 2 } };
      const nonBomb: gameItem = 'Empty';

      expect(isBomb(bomb)).toBeTruthy();
      expect(isBomb(nonBomb)).toBeFalsy();
    });
  });

  describe('isObstacle', () => {
    it('does not mistake owned bombs for player cover', () => {
      const bomb: Bomb = { ownerId: 'player1', range: 3, coords: { x: 1, y: 2 } };
      const obstacle: gameItem = { ownerId: 'player1', coords: { x: 2, y: 2 } };

      expect(isObstacle(bomb)).toBeFalsy();
      expect(isObstacle(obstacle)).toBeTruthy();
    });
  });
});
