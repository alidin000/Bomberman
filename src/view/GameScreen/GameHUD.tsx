/* eslint-disable object-curly-newline, comma-dangle */
import React from 'react';
import { Chip, Typography } from '@mui/material';
import { GameEngineState } from '../../engine/types';
import { Power } from '../../model/gameItem';
import { isPowerUpActive } from '../../engine/players';
import {
  HudRoot,
  PlayerCards,
  PlayerCardPaper,
  RoundPaper,
  PowerChips,
  RoundProgress,
  PlayerHeader,
  PlayerAvatar,
  PlayerStats,
  StatPill,
  HudRight,
  MonsterPaper,
  MonsterChips,
  UltimateProgress,
  BossPaper,
  AbilityPanel,
  AbilityRow,
} from './GameHUD.styles';
import { getCharacterDefinition } from '../../content';

const POWER_LABELS: Record<Power, string> = {
  AddBomb: 'Clay Scroll',
  BlastRangeUp: 'Blast Scroll',
  Detonator: 'Command Seal',
  RollerSkate: 'Flicker Tag',
  Invincibility: 'Guard Charm',
  Ghost: 'Phase Seal',
  Obstacle: 'Earth Seal',
};

type GameHUDProps = {
  state: GameEngineState;
};

function PlayerCard({
  player,
  state,
}: {
  player: GameEngineState['players'][0];
  state: GameEngineState;
}) {
  const activePowers = player.powerUps.filter(
    (p) => isPowerUpActive(state, player.id, p)
      || !['Ghost', 'Invincibility'].includes(p),
  );
  const character = getCharacterDefinition(player.characterId);

  return (
    <PlayerCardPaper alive={player.alive} color={player.color}>
      <PlayerHeader>
        <PlayerAvatar color={player.color} />
        <div>
          <Typography variant="subtitle1" fontWeight="bold" color="#f8fafc">
            {character.name || player.name}
          </Typography>
          <Typography variant="caption" color={player.alive ? '#86efac' : '#fca5a5'}>
            {player.alive ? character.title : 'Sealed'}
          </Typography>
        </div>
      </PlayerHeader>
      <PlayerStats>
        <StatPill>
          Clay
          {' '}
          {player.maxBombs - player.activeBombs}
          /
          {player.maxBombs}
        </StatPill>
        <StatPill>
          Blast
          {' '}
          {player.bombRange}
        </StatPill>
      </PlayerStats>
      <PowerChips>
        {activePowers.map((power) => (
          <Chip
            key={power}
            label={POWER_LABELS[power]}
            size="small"
          />
        ))}
      </PowerChips>
      <AbilityPanel color={character.secondaryColor}>
        <AbilityRow>
          <strong>Bomb</strong>
          <span>{character.basicBomb}</span>
        </AbilityRow>
        <AbilityRow>
          <strong>Ult</strong>
          <span>{character.ultimate}</span>
        </AbilityRow>
      </AbilityPanel>
      <UltimateProgress variant="determinate" value={player.ultimateCharge} />
    </PlayerCardPaper>
  );
}

function BossSummary({ state }: GameHUDProps) {
  if (!state.boss) return null;
  const health = (state.boss.health / state.boss.maxHealth) * 100;

  return (
    <BossPaper elevation={4} color={state.boss.color}>
      <Typography variant="subtitle2" fontWeight="bold">
        Boss:
        {' '}
        {state.boss.name}
      </Typography>
      <Typography variant="caption" display="block">
        Phase
        {' '}
        {state.boss.phase}
        {' '}
        ·
        {' '}
        {state.boss.tails}
        {' '}
        tail chakra
      </Typography>
      <Typography variant="caption" display="block" color="warning.light">
        Casting:
        {' '}
        {state.boss.currentAbility}
      </Typography>
      <Typography variant="caption" display="block">
        Active danger zones:
        {' '}
        {state.hazards.length}
      </Typography>
      <UltimateProgress variant="determinate" value={health} />
      <Typography variant="caption">
        {state.boss.health}
        /
        {state.boss.maxHealth}
        {' '}
        HP
      </Typography>
    </BossPaper>
  );
}

function MonsterSummary({ state }: GameHUDProps) {
  const counts = state.monsters.reduce<Record<string, number>>((acc, monster) => ({
    ...acc,
    [monster.name]: (acc[monster.name] ?? 0) + 1,
  }), {});

  return (
    <MonsterPaper elevation={4}>
      <Typography variant="subtitle2" fontWeight="bold">
        Chakra Beasts
        {' '}
        ·
        {' '}
        {state.monsters.length}
        {' '}
        roaming
      </Typography>
      <MonsterChips>
        {Object.entries(counts).map(([name, count]) => (
          <Chip
            key={name}
            label={`${name} x${count}`}
            size="small"
            variant="outlined"
          />
        ))}
      </MonsterChips>
    </MonsterPaper>
  );
}

function formatTrialWinner(state: GameEngineState, winner: string): string {
  if (winner === 'draw') return 'Draw';
  return state.players.find((player) => player.id === winner)?.name ?? winner;
}

export function GameHUD({ state }: GameHUDProps) {
  const roundProgress = (state.round / state.totalRounds) * 100;

  return (
    <HudRoot>
      <PlayerCards>
        {state.players.map((player) => (
          <PlayerCard key={player.id} player={player} state={state} />
        ))}
      </PlayerCards>
      <HudRight>
        <RoundPaper elevation={4}>
          <Typography variant="subtitle2" fontWeight="bold">
            Round
            {' '}
            {Math.min(state.round, state.totalRounds)}
            /
            {state.totalRounds}
          </Typography>
          <RoundProgress variant="determinate" value={roundProgress} />
          {state.roundWinners.length > 0 && (
            <Typography variant="caption" color="text.secondary" display="block">
              Trial wins:
              {' '}
              {state.roundWinners.map((winner) => formatTrialWinner(state, winner)).join(', ')}
            </Typography>
          )}
        </RoundPaper>
        <BossSummary state={state} />
        <MonsterSummary state={state} />
      </HudRight>
    </HudRoot>
  );
}
