import { vi, type Mock } from 'vitest';
import { GameMap } from './gameItem';
import { Player } from './player';

describe('Player', () => {
  let player: Player;
  let map: GameMap;
  let otherPlayers: Player[];
  let setMap: Mock;

  const addPowerUp = vi.fn();
  const removePowerUp = vi.fn();
  const isPowerUpActive = vi.fn();

  beforeEach(() => {
    // Initialize map with empty spaces
    map = Array.from({ length: 10 }, () => Array(10).fill('Empty'));

    // Mock function for setting the map
    setMap = vi.fn();

    // Other players in the game
    const playerImages = {
      original: 'path_to_original_image',
      ghost: 'path_to_ghost_image',
      invincible: 'path_to_invincible_image',
    };
    otherPlayers = [new Player('2', 'player2', 5, 5, true, 4, 2, [], 0, playerImages.original, playerImages.ghost, playerImages.invincible)];

    // Create a player with initial position (1,1)
    player = new Player('1', 'player1', 1, 1, true, 4, 2, [], 0, playerImages.original, playerImages.ghost, playerImages.invincible);
  });

  it('should move up correctly', () => {
    player.move('up', map, otherPlayers, setMap, addPowerUp, removePowerUp, isPowerUpActive);
    expect(player.getY()).toBe(0); // Expect the player to have moved up
  });

  it('should move down correctly', () => {
    player.move('down', map, otherPlayers, setMap, addPowerUp, removePowerUp, isPowerUpActive);
    expect(player.getY()).toBe(2); // Expect the player to have moved down
  });

  it('should not move into a wall', () => {
    map[2][1] = 'Wall';
    player.move('down', map, otherPlayers, setMap, addPowerUp, removePowerUp, isPowerUpActive);
    expect(player.getY()).toBe(1); // Y should not change because there's a wall
  });

  it('should not move into a bomb', () => {
    map[2][1] = { range: 2, coords: { x: 2, y: 1 }, ownerId: '3' };
    player.move('down', map, otherPlayers, setMap, addPowerUp, removePowerUp, isPowerUpActive);
    expect(player.getY()).toBe(1); // Y should not change because there's a bomb
  });

  it('should not collide with another player', () => {
    player = new Player('1', 'player1', 4, 5, true, 4, 2, [], 0, 'path_to_original_image', 'path_to_ghost_image', 'path_to_invincible_image');
    player.move('right', map, otherPlayers, setMap, addPowerUp, removePowerUp, isPowerUpActive);
    expect(player.getX()).toBe(4); // X should not change because another player is at (5, 5)
  });

  it('can move freely in open space', () => {
    player = new Player('1', 'player1', 3, 3, true, 4, 2, [], 0, 'path_to_original_image', 'path_to_ghost_image', 'path_to_invincible_image');
    player.move('right', map, otherPlayers, setMap, addPowerUp, removePowerUp, isPowerUpActive);
    expect(player.getX()).toBe(4); // X should change to 4
  });
});
