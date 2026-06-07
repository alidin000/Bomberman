/* eslint-disable object-curly-newline, max-len */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Typography,
} from '@mui/material';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import {
  WelcomeContainer,
  HeroSection,
  ActionPanel,
  ActionCard,
  ActionButtons,
  HeroSubtitle,
  HeroCopy,
  HeroBadge,
  BoardFrame,
  BoardTitleStrip,
  BoardSurface,
  BoardSection,
  BoardSectionTitle,
  CharacterGrid,
  CharacterCard,
  CharacterArt,
  CharacterName,
  AbilityStack,
  AbilityTag,
  CharacterNote,
  BossGrid,
  BossCard,
  BossEmblem,
  BossMeta,
  StageGrid,
  StageCard,
  StageArt,
  StageLabel,
  PowerGrid,
  PowerTile,
  MonsterGrid,
  MonsterTile,
  MonsterIcon,
} from './WelcomeScreen.styles';
import RosterBoard from '../../assets/ninja-bomber-roster-board.png';
import StageAtlas from '../../assets/ninja-bomber-stage-atlas.png';
import {
  CHARACTER_DEFINITIONS,
  STAGE_DEFINITIONS,
  getBossDefinition,
} from '../../content';
import { BossDefinition, CharacterId, StageId } from '../../content/types';

const CHARACTER_POSITIONS: Record<CharacterId, string> = {
  deidara: '0% 0%',
  naruto: '20% 0%',
  sasuke: '40% 0%',
  gaara: '60% 0%',
  minato: '80% 0%',
  itachi: '100% 0%',
};

const STAGE_PREVIEW_POSITIONS: Record<StageId, string> = {
  hiddenLeaf: '0% 0%',
  hiddenSand: '50% 0%',
  hiddenMist: '100% 0%',
  hiddenCloud: '0% 100%',
  hiddenStone: '50% 100%',
  akatsukiHideout: '100% 100%',
};

const POWER_ITEMS = [
  { name: 'Clone Training', color: '#f97316' },
  { name: 'Rasengan Mastery', color: '#38bdf8' },
  { name: 'FTG Kunai', color: '#facc15' },
  { name: 'Yellow Flash', color: '#fde047' },
  { name: 'Sharingan Timing', color: '#ef4444' },
  { name: 'Sand Armor', color: '#c48a4a' },
  { name: 'Yata Mirror', color: '#f97316' },
];

const LOCAL_BEASTS = [
  { name: 'Rogue Genin', kind: 'fox', color: '#f97316' },
  { name: 'Sand Ninja', kind: 'sand', color: '#c48a4a' },
  { name: 'Mist Ninja', kind: 'flame', color: '#38bdf8' },
  { name: 'White Zetsu', kind: 'horn', color: '#7c3aed' },
];

export const WelcomeScreen = () => {
  const navigate = useNavigate();
  const activeStages = STAGE_DEFINITIONS.filter((stage) => stage.implemented);
  const activeBosses = activeStages
    .map((stage) => (stage.bossId ? getBossDefinition(stage.bossId) : null))
    .filter((boss): boss is BossDefinition => Boolean(boss));

  return (
    <WelcomeContainer>
      <HeroSection>
        <HeroCopy>
          <HeroBadge>Ninja Bomber Arena</HeroBadge>
          <Typography variant="h2" component="h1" gutterBottom fontWeight={900}>
            Explosive Shinobi Arena
          </Typography>
          <HeroSubtitle variant="h6">
            Character bombs, tailed-beast bosses, power-ups, and village arenas.
          </HeroSubtitle>
          <ActionButtons>
            <Button
              variant="contained"
              size="large"
              startIcon={<SportsEsportsIcon />}
              onClick={() => navigate('/config')}
            >
              Enter the Arena
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<MenuBookIcon />}
              onClick={() => navigate('/instructions')}
            >
              Shinobi Manual
            </Button>
          </ActionButtons>
        </HeroCopy>
        <BoardFrame>
          <BoardTitleStrip>Current Arena Roster</BoardTitleStrip>
          <BoardSurface>
            <BoardSection wide>
              <BoardSectionTitle>Playable Characters</BoardSectionTitle>
              <CharacterGrid>
                {CHARACTER_DEFINITIONS.filter((character) => character.implemented).map((character) => (
                  <CharacterCard key={character.id} accent={character.secondaryColor}>
                    <CharacterArt
                      image={RosterBoard}
                      position={CHARACTER_POSITIONS[character.id]}
                      aria-label={`${character.name} portrait`}
                    />
                    <CharacterName color={character.secondaryColor}>{character.name}</CharacterName>
                    <AbilityStack>
                      <AbilityTag color={character.secondaryColor}>{character.basicBomb}</AbilityTag>
                      <AbilityTag color={character.secondaryColor}>{character.ultimate}</AbilityTag>
                    </AbilityStack>
                    <CharacterNote>{character.description}</CharacterNote>
                  </CharacterCard>
                ))}
              </CharacterGrid>
            </BoardSection>

            <BoardSection>
              <BoardSectionTitle>Local Beasts</BoardSectionTitle>
              <MonsterGrid>
                {LOCAL_BEASTS.map((beast) => (
                  <MonsterTile key={beast.name} color={beast.color}>
                    <MonsterIcon beast={beast.kind} color={beast.color} />
                    <span>{beast.name}</span>
                  </MonsterTile>
                ))}
              </MonsterGrid>
            </BoardSection>

            <BoardSection>
              <BoardSectionTitle>Story Bosses</BoardSectionTitle>
              <BossGrid>
                {activeBosses.map((boss) => (
                  <BossCard key={boss.id} color={boss.color}>
                    <BossEmblem color={boss.color}>{boss.tails}</BossEmblem>
                    <div>
                      <strong>{boss.name}</strong>
                      <BossMeta>{boss.attacks.join(' / ')}</BossMeta>
                    </div>
                  </BossCard>
                ))}
              </BossGrid>
            </BoardSection>

            <BoardSection wide>
              <BoardSectionTitle>Village Arenas</BoardSectionTitle>
              <StageGrid>
                {activeStages.map((stage) => (
                  <StageCard key={stage.id} color={stage.palette.accent}>
                    <StageArt
                      image={StageAtlas}
                      position={STAGE_PREVIEW_POSITIONS[stage.id]}
                    />
                    <StageLabel>{stage.name.replace(' Village', '')}</StageLabel>
                  </StageCard>
                ))}
              </StageGrid>
            </BoardSection>

            <BoardSection wide>
              <BoardSectionTitle>Power-Ups</BoardSectionTitle>
              <PowerGrid>
                {POWER_ITEMS.map((item) => (
                  <PowerTile key={item.name} color={item.color}>{item.name}</PowerTile>
                ))}
              </PowerGrid>
            </BoardSection>
          </BoardSurface>
        </BoardFrame>
      </HeroSection>
      <ActionPanel>
        <ActionCard elevation={6}>
          <PowerGrid>
            {activeStages.slice(0, 3).map((stage) => (
              <PowerTile key={`route-${stage.id}`} color={stage.palette.accent}>{stage.mechanic}</PowerTile>
            ))}
          </PowerGrid>
        </ActionCard>
      </ActionPanel>
    </WelcomeContainer>
  );
};
