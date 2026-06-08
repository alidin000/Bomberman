/* eslint-disable quote-props */
/* eslint-disable consistent-return */
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useCallback, useEffect } from 'react';
import { Power, GameMap, isObstacle } from '../model/gameItem';
import { Player } from '../model/player';

const usePowerUpManager = (mapRef: React.MutableRefObject<GameMap>, playersRef: React.MutableRefObject<Player[]>, setPlayers: ((player: Player) => void)[]) => {
  const [activePowerUps, setActivePowerUps] = useState<Record<string, Set<Power>>>({});
  const [flashingPowerUps, setFlashingPowerUps] = useState<Record<string, Set<Power>>>({});

  const addPowerUp = useCallback((playerId: string, powerUp: Power, duration: number) => {
    const mutuallyExclusivePowerUps: Partial<Record<Power, Power | null>> = {
      'Ghost': 'Invincibility',
      'Invincibility': 'Ghost',
      'CrowFeather': 'Invincibility',
      'SandArmor': 'Ghost',
      'AddBomb': null,
      'BlastRangeUp': null,
      'Detonator': null,
      'RollerSkate': null,
      'Obstacle': null
    };

    const currentActivePowerUps = activePowerUps[playerId] || new Set();
    const exclusivePowerUp = mutuallyExclusivePowerUps[powerUp];
    if (exclusivePowerUp && currentActivePowerUps.has(exclusivePowerUp)) {
      return;
    }
    setActivePowerUps((prev) => ({
      ...prev,
      [playerId]: new Set([...(prev[playerId] || []), powerUp]),
    }));

    const timeout = setTimeout(() => {
      setFlashingPowerUps((prev) => ({
        ...prev,
        [playerId]: new Set([...(prev[playerId] || []), powerUp]),
      }));

      const expireTimeout = setTimeout(() => {
        setActivePowerUps((prev) => {
          const newSet = new Set(prev[playerId]);
          newSet.delete(powerUp);
          return { ...prev, [playerId]: newSet };
        });

        setFlashingPowerUps((prev) => {
          const newSet = new Set(prev[playerId]);
          newSet.delete(powerUp);
          return { ...prev, [playerId]: newSet };
        });

        // Handle the expiration of the Ghost power-up
        if (powerUp === 'Ghost') {
          const player = playersRef.current.find((p) => p.getId() === playerId);
          if (player) {
            const map = mapRef.current;
            const currentCell = map[player.getY()][player.getX()];
            if (currentCell === 'Wall' || currentCell === 'Box' || isObstacle(currentCell)) {
              player.killPlayer();
              const playerIndex = playersRef.current.findIndex((p) => p.getId() === playerId);
              setPlayers[playerIndex](Player.fromPlayer(player));
            }
          }
        }
      }, 3000);

      return () => clearTimeout(expireTimeout);
    }, duration - 3000);

    return () => clearTimeout(timeout);
  }, [activePowerUps, mapRef, playersRef, setPlayers]);

  const removePowerUp = useCallback((playerId: string, powerUp: Power) => {
    setActivePowerUps((prev) => {
      const newSet = new Set(prev[playerId]);
      newSet.delete(powerUp);
      return { ...prev, [playerId]: newSet };
    });

    setFlashingPowerUps((prev) => {
      const newSet = new Set(prev[playerId]);
      newSet.delete(powerUp);
      return { ...prev, [playerId]: newSet };
    });
  }, []);

  const clearPowerUps = useCallback((playerId: string) => {
    setActivePowerUps((prev) => {
      const newSet = new Set<Power>();
      return { ...prev, [playerId]: newSet };
    });

    setFlashingPowerUps((prev) => {
      const newSet = new Set<Power>();
      return { ...prev, [playerId]: newSet };
    });
  }, []);

  const isPowerUpActive = useCallback((playerId: string, powerUp: Power) => activePowerUps[playerId]?.has(powerUp) || false, [activePowerUps]);
  const isPowerUpFlashing = useCallback((playerId: string, powerUp: Power) => flashingPowerUps[playerId]?.has(powerUp) || false, [flashingPowerUps]);

  return {
    addPowerUp,
    removePowerUp,
    clearPowerUps,
    isPowerUpActive,
    isPowerUpFlashing,
  };
};

export default usePowerUpManager;
