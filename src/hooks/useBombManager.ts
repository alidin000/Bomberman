/* eslint-disable no-plusplus */
import { useCallback } from 'react';
import { Player } from '../model/player';
import { Bomb, GameMap, randomPowerUpGenerator } from '../model/gameItem';

export const useBombManager = (
  playerID: number,
  playersRef: React.MutableRefObject<Player[]>,
  setPlayers: ((player: Player) => void)[],
  map: GameMap,
  setMap: (m: GameMap) => void
) => {
  const explodeBomb = useCallback((y: number, x: number, bomb: Bomb): void => {
    const blastRange = bomb.range;
    const newMap: GameMap = [];
    map.map((row) => newMap.push([...row]));
    const positionsToCheck = [];
    const mapHeight = map.length;
    const mapWidth = map[0].length;

    // Vertical - up and down from the bomb
    for (let dy = -blastRange; dy <= blastRange; dy += 1) {
      const tempY = y + dy;
      if (tempY >= 0 && tempY <= mapHeight) {
        positionsToCheck.push({ newY: tempY, newX: x });
      }
    }

    // Horizontal - left and right from the bomb
    for (let dx = -blastRange; dx <= blastRange; dx += 1) {
      const tempX = x + dx;
      if (tempX >= 0 && tempX <= mapWidth) {
        positionsToCheck.push({ newY: y, newX: x + dx });
      }
    }
    positionsToCheck.forEach(({ newY, newX }) => {
      const affectedItem = map[newY][newX];

      // TODO: Trigger other bombs
      // if (typeof affectedItem !== 'string' && 'range' in affectedItem) {
      //   explodeBomb(newY, newX, affectedItem);
      // }

      // Destroy boxes and potentially drop power-ups
      if (affectedItem === 'Box') {
        newMap[newY][newX] = randomPowerUpGenerator(); // Replace with a power-up or empty
      }

      playersRef.current.forEach((player, index) => {
        if (player.getX() === newX && player.getY() === newY && player.isAlive()) {
          if (player.isInvincible()) return; // Skip invincible players
          player.killPlayer();
          setPlayers[index](Player.fromPlayer(player));
        }
      });
    });

    // Update the map with changes
    setMap(newMap);

    // Check and update players' positions if they are in the blast range
  }, [map, setMap, playersRef, setPlayers]);

  const dropBomb = useCallback((y: number, x: number): void => {
    if (map[y][x] !== 'Empty') return; // Ensure the cell is empty before placing a bomb

    const player = playersRef.current[playerID];
    if (player.getBombs() <= 0) return; // Ensure the player has bombs left
    player.decrementBombs();
    const bomb: Bomb = {
      ownerId: player.getId(),
      coords: { x, y },
      range: player.getBombRange(), // Assuming getBombRange is a method of Player
    };

    // Place the bomb in the map
    const newMap = map.map((row) => [...row]);
    newMap[y][x] = bomb;
    setMap(newMap);

    setPlayers[playerID](Player.fromPlayer(player));

    // Set a timer for the bomb to explode
    setTimeout(() => {
      explodeBomb(y, x, bomb);
    }, 3000); // Explodes after 3 seconds
  }, [map, setMap, playersRef, explodeBomb]);

  return { dropBomb };
};
