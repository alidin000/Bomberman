/* eslint-disable object-curly-newline, comma-dangle */
import React from 'react';
import { Typography } from '@mui/material';
import { GameEngineState, MonsterKind } from '../../engine/types';
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
  PowerBadge,
  StatPill,
  HudRight,
  MonsterPaper,
  MonsterChips,
  MonsterBadge,
  UltimateProgress,
  BossPaper,
  AbilityPanel,
  AbilityRow,
} from './GameHUD.styles';
import { getCharacterDefinition } from '../../content';
import { getCharacterPowerTheme } from '../../content/characterPowerups';

const POWER_LABELS: Record<Power, string> = {
  AddBomb: 'Bomb capacity',
  BlastRangeUp: 'Blast radius',
  Detonator: 'Detonation Tag',
  RollerSkate: 'Movement boost',
  Invincibility: 'Shield',
  Ghost: 'Phase survival',
  Obstacle: 'Placeable cover',
};

const MONSTER_BADGE_COLORS: Record<MonsterKind, string> = {
  basic: '#f97316',
  smart: '#d6a45d',
  ghost: '#38bdf8',
  fork: '#a855f7',
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
        {activePowers.map((power) => {
          const theme = getCharacterPowerTheme(player.characterId, power);
          return (
            <PowerBadge
              key={power}
              color={theme.color}
              accent={theme.accent}
              title={`${POWER_LABELS[power]} · ${theme.label}`}
            >
              {theme.shortLabel}
            </PowerBadge>
          );
        })}
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
      <Typography variant="overline" fontWeight="bold" letterSpacing="0.12em" display="block">
        {state.boss.name}
      </Typography>
      <UltimateProgress variant="determinate" value={health} />
      <Typography variant="caption" display="block" color="#e5e7eb">
        Phase
        {' '}
        {state.boss.phase}
        {' '}
        ·
        {' '}
        {state.boss.tails}
        {' '}
        tail chakra
        {' '}
        ·
        {' '}
        {state.boss.health}
        /
        {state.boss.maxHealth}
        {' '}
        HP
      </Typography>
      <Typography variant="caption" display="block" color="warning.light">
        {state.boss.currentAbility}
        {' '}
        ·
        {' '}
        {state.hazards.length}
        {' '}
        danger zones
      </Typography>
    </BossPaper>
  );
}

function MonsterSummary({ state }: GameHUDProps) {
  const counts = state.monsters.reduce<
    Record<string, { count: number; kind: MonsterKind }>
  >((acc, monster) => {
    const current = acc[monster.name] ?? { count: 0, kind: monster.kind };
    acc[monster.name] = { ...current, count: current.count + 1 };
    return acc;
  }, {});

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
        {Object.entries(counts).map(([name, data]) => (
          <MonsterBadge key={name} color={MONSTER_BADGE_COLORS[data.kind]}>
            {name}
            {' '}
            x
            {data.count}
          </MonsterBadge>
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
