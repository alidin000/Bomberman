/* eslint-disable no-shadow */
import React from 'react';
import { Typography } from '@mui/material';
import {
  PlayerStatusContainer, PlayerName, PowerUpsList, PowerUpItem, ObstaclesCount
} from './PlayerStatusScreen.styles';
import theme from '../../../theme/PlayerStatusTheme';
import { PlayerStatusProps } from '../../../constants/props';
import { Power } from '../../../model/gameItem';

export const PlayerStatus = ({
  player,
  index
}: PlayerStatusProps) => {
  const getPowerIcon = (power: Power): React.ReactNode => {
    switch (power) {
      case 'Detonator':
        return <span>🧨</span>;
      case 'RollerSkate':
        return <span>👟</span>;
      case 'Invincibility':
        return <span>💪</span>;
      case 'Ghost':
        return <span>👻</span>;
      case 'Obstacle':
        return <span>🚧</span>;
      default:
        return null;
    }
  };

  return (
    <PlayerStatusContainer theme={theme} index={index}>
      <PlayerName variant="h6">{player.getName()}</PlayerName>
      <Typography variant="body1">
        Clay Charges:
        {player.getBombs()}
      </Typography>
      <PowerUpsList>
        {player.getPowerUps().map((power, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <PowerUpItem key={index}>{getPowerIcon(power)}</PowerUpItem>
        ))}
      </PowerUpsList>
      <ObstaclesCount variant="body1">
        Earth Seals:
        {player.getObstacles()}
      </ObstaclesCount>
    </PlayerStatusContainer>
  );
};
