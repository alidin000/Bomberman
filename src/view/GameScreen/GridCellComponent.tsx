/* eslint-disable consistent-return */
/* eslint-disable no-shadow */
import React, { useState, useEffect } from 'react';
import {
  CharacterContainer,
  GridCell
} from './GameScreen.styles';
import wallImage from '../../assets/wall.jpeg';
import boxImage from '../../assets/box.png';
import bombImage from '../../assets/bomb.png';
import addBombImage from '../../assets/addbomb.png';
import blastRangeUpImage from '../../assets/blastrange.png';
import detonatorImage from '../../assets/detonator.png';
import rollerSkateImage from '../../assets/rollerskate.png';
import invincibilityImage from '../../assets/invincibility.png';
import ghostImage from '../../assets/ghost.png';
import obstacleImage from '../../assets/obstacle.png';
import fireImage from '../../assets/fire.jpeg'; // added this
import destroyedBoxImage from '../../assets/destroyed_box.png'; // Import destroyed box image
import { Player } from '../../model/player';
import { Monster } from '../../model/monster';
import {
  GameMap, isPower, isBomb, Power
} from '../../model/gameItem';

import player1Image from '../../assets/player1.png';
import player1GhostImage from '../../assets/player1ghost.png';
import player1InvincibleImage from '../../assets/player1armor.png';
import player2Image from '../../assets/player2.png';
import player2GhostImage from '../../assets/player2ghost.png';
import player2InvincibleImage from '../../assets/player2armor.png';
import player3Image from '../../assets/player3.png';
import player3GhostImage from '../../assets/player3ghost.png';
import player3InvincibleImage from '../../assets/player3armor.png';

const powerUpImgs: Partial<Record<Power, string>> = {
  AddBomb: addBombImage,
  BlastRangeUp: blastRangeUpImage,
  Detonator: detonatorImage,
  RollerSkate: rollerSkateImage,
  Invincibility: invincibilityImage,
  Ghost: ghostImage,
  Obstacle: obstacleImage,
};

type PlayerImageSet = {
  normal: string;
  ghost: string;
  invincible: string;
};

type PlayerKey = 'player1' | 'player2' | 'player3';

const playerImages: Record<PlayerKey, PlayerImageSet> = {
  player1: {
    normal: player1Image,
    ghost: player1GhostImage,
    invincible: player1InvincibleImage,
  },
  player2: {
    normal: player2Image,
    ghost: player2GhostImage,
    invincible: player2InvincibleImage,
  },
  player3: {
    normal: player3Image,
    ghost: player3GhostImage,
    invincible: player3InvincibleImage,
  }
};

type GridCellComponentProps = {
  row: number;
  column: number;
  players: Player[];
  monsters: Monster[];
  map: GameMap;
  isPowerUpActive: (playerId: string, powerUp: Power) => boolean;
  isPowerUpFlashing: (playerId: string, powerUp: Power) => boolean;
  explosions: { x: number, y: number }[]; // Add explosions prop
  destroyedBoxes: { x: number, y: number }[]; // Add destroyed boxes prop
}

export const GridCellComponent = ({
  row,
  column,
  players,
  monsters,
  map,
  isPowerUpActive,
  isPowerUpFlashing,
  explosions, // Add explosions prop
  destroyedBoxes
}: GridCellComponentProps) => {
  const cellContent = map[row][column];
  const isWallCell = cellContent === 'Wall';
  const isBoxCell = cellContent === 'Box';
  const isPowerUpCell = isPower(cellContent);
  const isBombCell = isBomb(cellContent);
  const player = players.find((p) => p.getX() === column && p.getY() === row);
  const monster = monsters.find((m) => m.getX() === column && m.getY() === row);
  const isEmptyCell = !isWallCell && !isBoxCell;

  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (player && (isPowerUpFlashing(player.getId(), 'Ghost') || isPowerUpFlashing(player.getId(), 'Invincibility'))) {
      setIsFlashing(true);
      const interval = setInterval(() => {
        setIsFlashing((prev) => !prev);
      }, 500);

      return () => clearInterval(interval);
    }
    setIsFlashing(false);
  }, [isPowerUpFlashing, player]);

  const getPlayerImage = (player: Player) => {
    const name = player.getName() as PlayerKey;
    if (isFlashing) {
      return playerImages[name]?.normal || playerImages.player1.normal;
    }
    if (playerImages[name]) {
      if (isPowerUpActive(player.getId(), 'Ghost')) return playerImages[name].ghost;
      if (isPowerUpActive(player.getId(), 'Invincibility')) return playerImages[name].invincible;
      return playerImages[name].normal;
    }
    return playerImages.player1.normal;
  };

  const isExplosion = explosions.some((e) => e.x === column && e.y === row);
  const isDestroyedBox = destroyedBoxes.some((b) => b.x === column && b.y === row);

  return (
    <GridCell isWall={isWallCell} style={{ backgroundColor: isEmptyCell ? 'green' : 'transparent' }}>
      {isWallCell && <img src={wallImage} alt="Wall" style={{ width: '100%', height: '100%' }} />}
      {isBoxCell && !isExplosion && !isDestroyedBox && <img src={boxImage} alt="Box" style={{ width: '100%', height: '100%' }} />}
      {isBoxCell && isDestroyedBox && <img src={destroyedBoxImage} alt="Destroyed Box" style={{ width: '100%', height: '100%' }} />}
      {isPowerUpCell && (
        <img
          src={powerUpImgs[cellContent] ?? invincibilityImage}
          alt="PowerUp"
          style={{ width: '100%', height: '100%' }}
        />
      )}
      {player && player.isAlive() && (
        <CharacterContainer>
          <img
            src={getPlayerImage(player)}
            alt="Player"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </CharacterContainer>
      )}
      {monster && (
        <CharacterContainer>
          <img src={monster.getImg()} alt="Monster" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </CharacterContainer>
      )}
      {isBombCell && <img src={bombImage} alt="Bomb" style={{ width: '100%', height: '100%' }} />}
      {isExplosion && !isBoxCell && <img src={fireImage} alt="Explosion" className="explosion-image" style={{ width: '100%', height: '100%' }} />}
    </GridCell>
  );
};
