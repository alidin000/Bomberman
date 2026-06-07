/* eslint-disable react/no-array-index-key */
import React, { useEffect, useMemo, useState } from 'react';
import {
  DialogTitle,
  DialogContent,
  Typography,
  Stepper,
  Step,
  StepLabel,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Divider,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Info from '@mui/icons-material/Info';
import {
  StyledDialog,
  StepContent,
  Row,
  CenteredButtonContainer,
  KeyConfigInput,
  PlayerControlsRow,
  ControlsLabel,
  KeyGroup,
  KeyRow,
  ExtraKeys,
  ConfigIntro,
  SectionTitle,
  SelectionGrid,
  SelectionCard,
  CardHeader,
  ColorOrb,
  CardMeta,
  ModeGrid,
  StagePreview,
  StagePreviewImage,
  AbilityLine,
  CharacterPortrait,
  CharacterPortraitImage,
  LoadoutGrid,
  LoadoutKey,
  LoadoutRow,
} from './ConfigScreen.styles';
import { WelcomeContainer } from '../WelcomeScreen/WelcomeScreen.styles';
import { KeyBindings, arrowKeySymbols, DEFAULT_KEY_BINDINGS } from '../../constants/props';
import RosterBoard from '../../assets/ninja-bomber-roster-board.png';
import StageAtlas from '../../assets/ninja-bomber-stage-atlas.png';
import {
  CHARACTER_DEFINITIONS,
  CharacterId,
  DEFAULT_CHARACTER_ID,
  DEFAULT_STAGE_ID,
  GameMode,
  STAGE_DEFINITIONS,
  StageId,
  getBossDefinition,
} from '../../content';
import {
  loadStoryProgress,
  selectStoryLoadout,
  STORY_UPGRADES,
  StoryUpgradeId,
} from '../../story/progress';

type KeyErrors = {
  [key: string]: boolean;
};

const GAME_MODES: {
  id: GameMode;
  title: string;
  description: string;
  disabled?: boolean;
}[] = [
  {
    id: 'solo',
    title: 'Solo Boss',
    description: 'Face the first tailed beast in a focused arena trial.',
  },
  {
    id: 'local',
    title: 'Local Arena',
    description: 'Couch battle for two or three shinobi loadouts.',
  },
  {
    id: 'onlinePreview',
    title: 'Online Rooms',
    description: 'Planned multiplayer flow, not enabled yet.',
    disabled: true,
  },
];

const STAGE_PREVIEW_POSITIONS: Record<StageId, string> = {
  hiddenLeaf: '0% 0%',
  hiddenSand: '50% 0%',
  hiddenMist: '100% 0%',
  hiddenCloud: '0% 100%',
  hiddenStone: '50% 100%',
  akatsukiHideout: '100% 100%',
};

const CHARACTER_POSITIONS: Record<CharacterId, string> = {
  deidara: '0% 0%',
  naruto: '20% 0%',
  sasuke: '40% 0%',
  gaara: '60% 0%',
  minato: '80% 0%',
  itachi: '100% 0%',
};

export const ConfigScreen = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [rounds, setRounds] = useState('1');
  const [mode, setMode] = useState<GameMode>('solo');
  const [numOfPlayers, setNumOfPlayers] = useState('1');
  const [selectedStage, setSelectedStage] = useState<StageId>(DEFAULT_STAGE_ID);
  const [selectedCharacters, setSelectedCharacters] = useState<CharacterId[]>([
    DEFAULT_CHARACTER_ID,
  ]);
  const [selectedUpgrade, setSelectedUpgrade] = useState<StoryUpgradeId>('extraClay');
  const [playerKeyBindings, setPlayerKeyBindings] = useState<KeyBindings>(DEFAULT_KEY_BINDINGS);
  const navigate = useNavigate();
  const [keyErrors, setKeyErrors] = useState<KeyErrors>({});
  const [storyProgress, setStoryProgress] = useState(loadStoryProgress);

  const activePlayerCount = parseInt(numOfPlayers, 10);
  const stage = useMemo(
    () => STAGE_DEFINITIONS.find((item) => item.id === selectedStage) ?? STAGE_DEFINITIONS[0],
    [selectedStage]
  );

  const handleModeSelect = (nextMode: GameMode) => {
    setMode(nextMode);
    if (nextMode === 'solo') {
      setNumOfPlayers('1');
      setRounds('1');
      setSelectedCharacters((current) => [current[0] ?? DEFAULT_CHARACTER_ID]);
    } else {
      setNumOfPlayers('2');
      setSelectedCharacters((current) => [
        current[0] ?? DEFAULT_CHARACTER_ID,
        current[1] ?? 'naruto',
      ]);
    }
  };

  const handlePlayerCountChange = (newNumOfPlayers: string) => {
    if (!newNumOfPlayers) return;
    const count = parseInt(newNumOfPlayers, 10);
    setNumOfPlayers(newNumOfPlayers);
    setSelectedCharacters((current) => Array.from(
      { length: count },
      (_, index) => current[index] ?? CHARACTER_DEFINITIONS[index].id
    ));
  };

  const handleCharacterSelect = (playerIndex: number, characterId: CharacterId) => {
    setSelectedCharacters((current) => current.map((id, index) => (
      index === playerIndex ? characterId : id
    )));
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleStoryNext = () => {
    handleNext();
  };

  const handleCancel = () => {
    setRounds('1');
    setNumOfPlayers('2');
    navigate('/');
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setPlayerKeyBindings({ ...DEFAULT_KEY_BINDINGS });
    setKeyErrors({});
  };

  const fetchMap = async (mapName: string) => {
    const response = await fetch(`/maps/${mapName}.txt`);
    const mapText = await response.text();
    return mapText.split(/\r?\n/).map((row) => row.trim().split('').slice(0, 15));
  };

  const handlePlay = async () => {
    const mapData = await fetchMap(stage.mapId);
    const characterId = selectedCharacters[0] ?? DEFAULT_CHARACTER_ID;
    if (mode === 'solo') {
      const progress = selectStoryLoadout(
        characterId,
        selectedStage,
        selectedUpgrade
      );
      setStoryProgress(progress);
    }
    localStorage.setItem('selectedMap', JSON.stringify(mapData));
    localStorage.setItem('playerKeyBindings', JSON.stringify(playerKeyBindings));
    localStorage.setItem('gameSetup', JSON.stringify({
      mode,
      stageId: selectedStage,
      selectedCharacters,
      selectedUpgrade,
    }));
    navigate(`/game/${numOfPlayers}/${rounds}/${stage.mapId}`);
  };

  const handleKeyDown = (
    player: number,
    keyIndex: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    event.preventDefault();
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'Backspace' || key === 'Delete' || (key.length > 1 && !key.includes('Arrow'))) return;

    setPlayerKeyBindings((prevBindings) => ({
      ...prevBindings,
      [player]: prevBindings[player].map((k, idx) => (idx === keyIndex ? key : k)),
    }));
  };

  const validateInputs = () => {
    const newErrors: KeyErrors = {};
    const keyMap = new Map<string, string>();

    Object.values(playerKeyBindings)
      .slice(0, activePlayerCount).forEach((keys, playerIndex) => {
        keys.forEach((key, keyIndex) => {
          const keyId = `player${playerIndex + 1}-${keyIndex}`;
          if (keyMap.has(key)) {
            newErrors[keyId] = true;
            newErrors[keyMap.get(key)!] = true;
          } else {
            keyMap.set(key, keyId);
          }
        });
      });
    setKeyErrors(newErrors);
  };

  useEffect(() => {
    validateInputs();
  }, [activePlayerCount, playerKeyBindings]);

  const renderKeyConfig = (player: number) => (
    <>
      <PlayerControlsRow numOfPlayers={numOfPlayers}>
        <ControlsLabel>
          Player
          {player}
          {' '}
          Controls:
        </ControlsLabel>
        <KeyGroup>
          <KeyConfigInput
            key={`player-${player}-key-0`}
            value={arrowKeySymbols[playerKeyBindings[player][0]]
            || playerKeyBindings[player][0].toUpperCase()}
            onKeyDown={(e) => handleKeyDown(player, 0, e)}
            readOnly
            style={{ borderColor: keyErrors[`player${player}-0`] ? 'red' : 'black' }}
          />
          <KeyRow>
            {playerKeyBindings[player].slice(1, 4).map((key, index) => (
              <KeyConfigInput
                key={`player-${player}-key-${index + 1}`}
                value={arrowKeySymbols[key] || key.toUpperCase()}
                onKeyDown={(e) => handleKeyDown(player, index + 1, e)}
                readOnly
                style={{ borderColor: keyErrors[`player${player}-${index + 1}`] ? 'red' : 'black' }}
              />
            ))}
          </KeyRow>
        </KeyGroup>
        <ExtraKeys>
          {playerKeyBindings[player].slice(4, 6).map((key, index) => (
            <KeyConfigInput
              key={`player-${player}-key-${index + 4}`}
              aria-label={index === 0 ? `player ${player} bomb key` : `player ${player} ultimate key`}
              value={arrowKeySymbols[key] || key.toUpperCase()}
              onKeyDown={(e) => handleKeyDown(player, index + 4, e)}
              readOnly
              style={{ borderColor: keyErrors[`player${player}-${index + 4}`] ? 'red' : 'black' }}
            />
          ))}
        </ExtraKeys>
      </PlayerControlsRow>
      {player < activePlayerCount && <Divider style={{ margin: `${numOfPlayers === '2' ? '60px' : '20px'} 0` }} />}
    </>
  );

  useEffect(() => {
    setStoryProgress(loadStoryProgress());
  }, []);

  const steps = mode === 'solo'
    ? ['Character', 'Upgrade', 'Controls']
    : ['Arena Setup', 'Controls'];

  return (
    <WelcomeContainer>
      <StyledDialog open aria-labelledby="config-dialog-title">
        <DialogTitle id="config-dialog-title">
          {activeStep === 0 && 'Story Mode Setup'}
          {activeStep === 1 && mode === 'solo' && 'Upgrade Screen'}
          {((activeStep === 1 && mode === 'local') || activeStep === 2)
            && 'Keyboard Configuration'}
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          {activeStep === 0 && (
            <StepContent>
              <ConfigIntro>
                <Typography variant="h5" fontWeight="bold">
                  Choose your fighter, village, and challenge.
                </Typography>
                <CardMeta variant="body2">
                  Pick a real loadout: each ninja now has a different bomb,
                  blast shape, and ultimate effect.
                </CardMeta>
              </ConfigIntro>

              <SectionTitle variant="subtitle2">Mode</SectionTitle>
              <ModeGrid>
                {GAME_MODES.map((item) => (
                  <SelectionCard
                    key={item.id}
                    type="button"
                    selected={mode === item.id}
                    accent={item.id === 'solo' ? '#f59e0b' : '#60a5fa'}
                    disabled={item.disabled}
                    onClick={() => !item.disabled && handleModeSelect(item.id)}
                  >
                    <Typography variant="subtitle1" fontWeight="bold">{item.title}</Typography>
                    <CardMeta variant="caption">{item.description}</CardMeta>
                    {item.disabled && <Chip size="small" label="Future" />}
                  </SelectionCard>
                ))}
              </ModeGrid>

              <SectionTitle variant="subtitle2">Stage</SectionTitle>
              <SelectionGrid>
                {STAGE_DEFINITIONS.map((item) => (
                  <SelectionCard
                    key={item.id}
                    type="button"
                    selected={selectedStage === item.id}
                    accent={item.palette.accent}
                    disabled={mode === 'solo' && !storyProgress.unlockedStages.includes(item.id)}
                    onClick={() => setSelectedStage(item.id)}
                    aria-label={item.name}
                  >
                    <StagePreview>
                      <StagePreviewImage
                        image={StageAtlas}
                        aria-label={`${item.name} arena preview`}
                        backgroundPosition={STAGE_PREVIEW_POSITIONS[item.id]}
                      />
                    </StagePreview>
                    <CardHeader>
                      <ColorOrb color={item.palette.accent} />
                      <div>
                        <Typography variant="subtitle2" fontWeight="bold">{item.name}</Typography>
                        <CardMeta variant="caption">{item.mechanic}</CardMeta>
                      </div>
                    </CardHeader>
                    {item.bossId && (
                      <AbilityLine color={item.palette.accent}>
                        Boss:
                        {' '}
                        {getBossDefinition(item.bossId).name}
                        {' '}
                        ·
                        {' '}
                        {getBossDefinition(item.bossId).attacks.join(' / ')}
                      </AbilityLine>
                    )}
                    {mode === 'solo' && !storyProgress.unlockedStages.includes(item.id) && (
                      <Chip size="small" label="Locked" />
                    )}
                  </SelectionCard>
                ))}
              </SelectionGrid>

              <SectionTitle variant="subtitle2">Character Select</SectionTitle>
              {Array.from({ length: activePlayerCount }, (_, playerIndex) => (
                <div key={`player-select-${playerIndex}`}>
                  <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>
                    Player
                    {' '}
                    {playerIndex + 1}
                  </Typography>
                  <SelectionGrid>
                    {CHARACTER_DEFINITIONS.map((character) => (
                      <SelectionCard
                        key={`${playerIndex}-${character.id}`}
                        type="button"
                        selected={selectedCharacters[playerIndex] === character.id}
                        accent={character.secondaryColor}
                        disabled={mode === 'solo'
                          && !storyProgress.unlockedCharacters.includes(character.id)}
                        onClick={() => handleCharacterSelect(playerIndex, character.id)}
                        aria-label={`${character.name} player ${playerIndex + 1}`}
                      >
                        <CharacterPortrait>
                          <CharacterPortraitImage
                            image={RosterBoard}
                            aria-label={`${character.name} portrait`}
                            backgroundPosition={CHARACTER_POSITIONS[character.id]}
                          />
                        </CharacterPortrait>
                        <CardHeader>
                          <ColorOrb color={character.primaryColor} />
                          <div>
                            <Typography variant="subtitle2" fontWeight="bold">{character.name}</Typography>
                            <CardMeta variant="caption">{character.title}</CardMeta>
                          </div>
                        </CardHeader>
                        <LoadoutGrid>
                          <LoadoutRow color={character.secondaryColor}>
                            <LoadoutKey>Bomb</LoadoutKey>
                            <span>{character.basicBomb}</span>
                          </LoadoutRow>
                          <LoadoutRow color={character.secondaryColor}>
                            <LoadoutKey>Ult</LoadoutKey>
                            <span>{character.ultimate}</span>
                          </LoadoutRow>
                          <LoadoutRow color={character.secondaryColor}>
                            <LoadoutKey>Role</LoadoutKey>
                            <span>{character.passive}</span>
                          </LoadoutRow>
                        </LoadoutGrid>
                        <AbilityLine color={character.secondaryColor}>
                          {character.description}
                        </AbilityLine>
                        {mode === 'solo'
                          && !storyProgress.unlockedCharacters.includes(character.id)
                          && <Chip size="small" label="Locked" />}
                      </SelectionCard>
                    ))}
                  </SelectionGrid>
                </div>
              ))}

              {mode === 'local' && (
                <>
                  <Divider style={{ margin: '20px 0' }} />
                  <Row>
                    <Typography variant="h6">Victory Seals:</Typography>
                    <ToggleButtonGroup
                      size="large"
                      value={rounds}
                      exclusive
                      onChange={(_e, newRounds) => newRounds && setRounds(newRounds)}
                      aria-label="number of victory seals"
                    >
                      <ToggleButton value="1">1</ToggleButton>
                      <ToggleButton value="2">2</ToggleButton>
                      <ToggleButton value="3">3</ToggleButton>
                    </ToggleButtonGroup>
                  </Row>
                  <Row>
                    <Typography variant="h6">Shinobi Count:</Typography>
                    <ToggleButtonGroup
                      size="large"
                      value={numOfPlayers}
                      exclusive
                      onChange={(_e, newNumOfPlayers) => handlePlayerCountChange(newNumOfPlayers)}
                      aria-label="number of shinobi"
                    >
                      <ToggleButton value="2">2</ToggleButton>
                      <ToggleButton value="3">3</ToggleButton>
                    </ToggleButtonGroup>
                  </Row>
                </>
              )}

              <CenteredButtonContainer>
                <Button variant="contained" size="large" onClick={handleCancel}>Cancel</Button>
                <Button variant="contained" size="large" style={{ marginLeft: '10px' }} onClick={handleStoryNext}>Next</Button>
              </CenteredButtonContainer>
            </StepContent>
          )}
          {activeStep === 1 && mode === 'solo' && (
            <StepContent>
              <SectionTitle variant="subtitle2">Upgrade Screen</SectionTitle>
              <Typography variant="body2" color="text.secondary">
                Choose one story upgrade before entering the stage.
              </Typography>
              <SelectionGrid>
                {STORY_UPGRADES.map((upgrade) => {
                  const unlocked = storyProgress.unlockedUpgrades.includes(upgrade.id);
                  return (
                    <SelectionCard
                      key={upgrade.id}
                      type="button"
                      selected={selectedUpgrade === upgrade.id}
                      accent="#f59e0b"
                      disabled={!unlocked}
                      onClick={() => unlocked && setSelectedUpgrade(upgrade.id)}
                      aria-label={upgrade.name}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        {upgrade.name}
                      </Typography>
                      <CardMeta variant="caption">{upgrade.description}</CardMeta>
                      <AbilityLine color="#f59e0b">{upgrade.effectLabel}</AbilityLine>
                      {!unlocked && <Chip size="small" label="Locked" />}
                    </SelectionCard>
                  );
                })}
              </SelectionGrid>
              <CenteredButtonContainer>
                <Button variant="contained" size="large" onClick={handleBack}>Back</Button>
                <Button variant="contained" size="large" onClick={handleNext}>Next</Button>
              </CenteredButtonContainer>
            </StepContent>
          )}
          {((activeStep === 1 && mode === 'local') || activeStep === 2) && (
            <StepContent>
              <Typography variant="body2" color="text.secondary">
                The first extra key drops bombs. The second extra key fires your ultimate.
              </Typography>
              <div>
                {Array.from({ length: activePlayerCount }, (_, i) => renderKeyConfig(i + 1))}
              </div>
              {Object.keys(keyErrors).length > 0 && (
                <Typography variant="body2" color="error" sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                  <Info sx={{ mr: 1, fontSize: 'inherit' }} />
                  Please correct the highlighted key conflicts before proceeding.
                </Typography>
              )}
              <CenteredButtonContainer>
                <Button variant="contained" size="large" onClick={handleBack}>Back</Button>
                <Button variant="contained" size="large" onClick={handlePlay} disabled={Object.keys(keyErrors).length > 0} style={{ marginLeft: '10px' }}>
                  Play
                </Button>
              </CenteredButtonContainer>
            </StepContent>
          )}
        </DialogContent>
      </StyledDialog>
    </WelcomeContainer>
  );
};
