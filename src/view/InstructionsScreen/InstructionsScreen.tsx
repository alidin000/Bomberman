/* eslint-disable object-curly-newline, max-len */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import {
  InstructionsBackground,
  StyledDialog,
  StyledDialogTitle,
  StyledDialogContent,
  DialogActions,
  BackButton,
  ManualIntro,
  ManualGrid,
  ManualSection,
  ManualSectionTitle,
  ManualList,
  ManualItem,
  ManualBadge,
  CharacterManualGrid,
  CharacterManualCard,
} from './InstructionsScreen.styles';
import {
  CHARACTER_DEFINITIONS,
  CAMPAIGN_FLOW_STEPS,
  CAMPAIGN_VILLAGES,
  STAGE_DEFINITIONS,
  getBossDefinition,
} from '../../content';
import { getCharacterPowerLoadout } from '../../content/characterPowerups';

const LOCAL_BEASTS = [
  'Leaf: Rogue Genin, Rogue Chunin, Training Clone.',
  'Sand: Puppet Scout, Scorpion Puppet, Sand Ninja.',
  'Mist: Mist Ninja, Water Clone, Hunter Ninja.',
  'Cloud: Lightning Ninja, Thunder Hawk, Cloud Samurai.',
  'Akatsuki: White Zetsu, Crow Swarm, Akatsuki Cultist.',
];

export const InstructionsScreen = () => {
  const navigate = useNavigate();
  const handleClose = () => navigate('/');
  const stages = STAGE_DEFINITIONS.filter((stage) => stage.implemented);
  const bosses = stages
    .map((stage) => (stage.bossId ? getBossDefinition(stage.bossId) : null))
    .filter((boss): boss is ReturnType<typeof getBossDefinition> => Boolean(boss));

  return (
    <InstructionsBackground>
      <StyledDialog
        open
        onClose={handleClose}
        aria-labelledby="customized-dialog-title"
      >
        <StyledDialogTitle id="customized-dialog-title">
          Shinobi Arena Manual
        </StyledDialogTitle>
        <StyledDialogContent dividers>
          <ManualIntro>
            Explore villages under fog of war, plant character-specific bombs, and defeat the village boss in campaign mode or outlast rival shinobi in local arena mode.
          </ManualIntro>

          <ManualGrid>
            <ManualSection wide>
              <ManualSectionTitle>Playable Shinobi</ManualSectionTitle>
              <CharacterManualGrid>
                {CHARACTER_DEFINITIONS.filter((character) => character.implemented).map((character) => (
                  <CharacterManualCard key={character.id} color={character.secondaryColor}>
                    <strong>{character.name}</strong>
                    <span>{character.basicBomb}</span>
                    <span>{character.ultimate}</span>
                    <small>{character.passive}</small>
                    <p>{character.description}</p>
                  </CharacterManualCard>
                ))}
              </CharacterManualGrid>
            </ManualSection>

            <ManualSection>
              <ManualSectionTitle>Modes</ManualSectionTitle>
              <ManualList>
                <ManualItem>
                  <ManualBadge>Campaign</ManualBadge>
                  Continue Campaign resumes the saved village, unlocks the next village after boss victory, and preserves story rewards.
                </ManualItem>
                <ManualItem>
                  <ManualBadge>Local</ManualBadge>
                  Two or three players fight for the selected number of victory seals.
                </ManualItem>
                <ManualItem>
                  <ManualBadge>Online</ManualBadge>
                  Rooms are visible as a future mode and are not playable yet.
                </ManualItem>
              </ManualList>
            </ManualSection>

            <ManualSection>
              <ManualSectionTitle>Controls</ManualSectionTitle>
              <ManualList>
                <ManualItem>
                  <ManualBadge>Move</ManualBadge>
                  Use the four configured movement keys.
                </ManualItem>
                <ManualItem>
                  <ManualBadge>Bomb</ManualBadge>
                  Plants your basic bomb.
                </ManualItem>
                <ManualItem>
                  <ManualBadge>Det</ManualBadge>
                  Triggers manual bombs after picking up a release/tag power-up.
                </ManualItem>
                <ManualItem>
                  <ManualBadge>Ult</ManualBadge>
                  Spends the charged ultimate.
                </ManualItem>
                <ManualItem>
                  <ManualBadge>Cover</ManualBadge>
                  Places a cover tile ahead after picking up a barrier power-up.
                </ManualItem>
                <ManualItem>
                  <ManualBadge>Pause</ManualBadge>
                  Use the top-right controls for pause, restart, and key edits.
                </ManualItem>
              </ManualList>
            </ManualSection>

            <ManualSection>
              <ManualSectionTitle>Story Bosses</ManualSectionTitle>
              <ManualList>
                {bosses.map((boss) => (
                  <ManualItem key={boss.id}>
                    <ManualBadge>
                      {boss.tails}
                      {' '}
                      tail
                    </ManualBadge>
                    {boss.name}
                    {' '}
                    casts
                    {' '}
                    {boss.attacks.join(' / ')}
                    .
                  </ManualItem>
                ))}
              </ManualList>
            </ManualSection>

            <ManualSection wide>
              <ManualSectionTitle>Campaign Route</ManualSectionTitle>
              <ManualList compact>
                <ManualItem>
                  <ManualBadge>Flow</ManualBadge>
                  {CAMPAIGN_FLOW_STEPS.map((step) => step.label).join(' -> ')}
                </ManualItem>
                {CAMPAIGN_VILLAGES.map((village) => (
                  <ManualItem key={village.stageId}>
                    <ManualBadge>
                      {village.order}
                      {' '}
                      {village.villageName}
                    </ManualBadge>
                    Mini:
                    {' '}
                    {village.miniBoss}
                    {' '}
                    · Boss:
                    {' '}
                    {village.villageBoss}
                    {' '}
                    · Reward:
                    {' '}
                    {village.reward}
                  </ManualItem>
                ))}
              </ManualList>
            </ManualSection>

            <ManualSection>
              <ManualSectionTitle>Local Beasts</ManualSectionTitle>
              <ManualList>
                {LOCAL_BEASTS.map((beast) => (
                  <ManualItem key={beast}>{beast}</ManualItem>
                ))}
              </ManualList>
            </ManualSection>

            <ManualSection>
              <ManualSectionTitle>Fog of War</ManualSectionTitle>
              <ManualList>
                {CHARACTER_DEFINITIONS.filter((character) => character.implemented).map((character) => (
                  <ManualItem key={`${character.id}-vision`}>
                    <ManualBadge>
                      Vision
                      {' '}
                      {character.visionRadius}
                    </ManualBadge>
                    {character.name}
                    {' '}
                    reveals nearby campaign tiles; visited cells stay mapped in shadow.
                  </ManualItem>
                ))}
              </ManualList>
            </ManualSection>

            <ManualSection wide>
              <ManualSectionTitle>Character Power-Ups</ManualSectionTitle>
              <ManualList compact>
                {CHARACTER_DEFINITIONS.filter((character) => character.implemented).map((character) => (
                  <ManualItem key={`${character.id}-powerups`}>
                    <ManualBadge>{character.name}</ManualBadge>
                    {getCharacterPowerLoadout(character.id).map((powerUp) => (
                      <span key={powerUp.power}>
                        <strong>{powerUp.label}</strong>
                        {': '}
                        {powerUp.effect}
                        {' '}
                      </span>
                    ))}
                  </ManualItem>
                ))}
              </ManualList>
            </ManualSection>

            <ManualSection wide>
              <ManualSectionTitle>Arena Flow</ManualSectionTitle>
              <ManualList compact>
                <ManualItem>Destructible boxes can reveal power-ups after they break.</ManualItem>
                <ManualItem>Boss warning seals appear before hazards become active; leave the marked cell, then punish.</ManualItem>
                <ManualItem>Bombs can chain-trigger nearby bombs, so delayed setups can cover routes that a single blast misses.</ManualItem>
                <ManualItem>Gaara and Itachi each have one passive survival save; after it triggers, the passive is spent.</ManualItem>
              </ManualList>
            </ManualSection>
          </ManualGrid>
        </StyledDialogContent>
        <DialogActions>
          <BackButton type="button" onClick={handleClose}>
            <SportsEsportsIcon fontSize="small" />
            Back to Arena
          </BackButton>
        </DialogActions>
      </StyledDialog>
    </InstructionsBackground>
  );
};
