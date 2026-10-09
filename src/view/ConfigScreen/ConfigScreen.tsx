/* eslint-disable react/no-array-index-key */
import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  DialogTitle,
  DialogContent,
  Typography,
  Stepper,
  Step,
  StepButton,
  StepLabel,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Info from '@mui/icons-material/Info';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import {
  StyledDialog,
  StepContent,
  DeckFooter,
  FooterActions,
  FooterHint,
  ModeToggleText,
  KeyConfigInput,
  PlayerControlsRow,
  ControlsLabel,
  MovementKeysGrid,
  MovementKeyCell,
  KeyHint,
  SummaryStrip,
  SummaryItem,
  ActionKeysGrid,
  ActionKeyCell,
  ActionKeyName,
  SectionTitle,
  SelectionGrid,
  SelectionCard,
  CardHeader,
  CardMeta,
  LockBadge,
  SelectedMark,
  StagePreviewImage,
  StageStrip,
  StageThumb,
  StageThumbArt,
  StageCaption,
  RoundsRow,
  CharacterPortrait,
  CharacterPortraitImage,
  CampaignRoute,
  CampaignRouteCard,
  RouteStatusBadge,
  MissionBriefing,
  MissionBriefingPreview,
  MissionBriefingDetails,
  MissionObjectiveList,
  MissionObjectiveItem,
  MissionActionRow,
} from './ConfigScreen.styles';
import { WelcomeContainer } from '../WelcomeScreen/WelcomeScreen.styles';
import {
  ACTION_BINDING_LABELS,
  MOVEMENT_BINDING_LABELS,
  KeyBindings,
  arrowKeySymbols,
  DEFAULT_KEY_BINDINGS,
  normalizeKeyBindings,
} from '../../constants/props';
import {
  MatchRounds, launchGame, loadStoredKeyBindings, readLastLocalSetup,
} from './launchGame';
import {
  RovingTabStops,
  keepRovingStopOnFocus,
  moveFocusWithArrows,
} from './menuNavigation';
import { KEY_REBIND_HINT, MAIN_MENU_LABEL, MENU_KEYS_HINT } from './menuCopy';
import RosterBoard from '../../assets/ninja-bomber-roster-board.png';
import StageAtlas from '../../assets/ninja-bomber-stage-atlas.webp';
import GreatWarStage from '../../assets/great-shinobi-war-stage.webp';
import {
  CHARACTER_DEFINITIONS,
  CAMPAIGN_VILLAGES,
  CharacterId,
  DEFAULT_CHARACTER_ID,
  GameMode,
  STAGE_DEFINITIONS,
  StageId,
  getBossDefinition,
  getCampaignMission,
  getStageDefinition,
} from '../../content';
import { DOJO_PATH } from '../../content/dojo';
import {
  loadStoryProgress,
  selectStoryLoadout,
  STORY_UPGRADES,
  StoryUpgradeId,
} from '../../story/progress';
import { hubPath } from '../HubScreen/missionSettlement';
import { DifficultySelector } from './DifficultySelector';
import {
  MAX_LOCAL_PLAYERS,
  MIN_LOCAL_PLAYERS,
  PlayerSlotsSelector,
} from './PlayerSlotsSelector';
import type { PlayerSlotController } from '../../engine/types';
import { playerSlotLabel } from '../GameScreen/playerSlots';

type KeyErrors = {
  [key: string]: boolean;
};

// Online play is not built yet, so it is not offered as a mode.
const GAME_MODES: {
  id: GameMode;
  title: string;
  description: string;
}[] = [
  {
    id: 'solo',
    title: 'Solo Campaign',
    description: '1 player · missions',
  },
  {
    id: 'local',
    title: 'Local Arena',
    description: '2–3 shinobi · friends or CPU',
  },
];

// Which campaign village unlocks each shinobi, for the locked-card hint.
const UNLOCKED_BY = new Map(CAMPAIGN_VILLAGES
  .filter((village) => village.rewardCharacter)
  .map((village): [CharacterId, string] => [
    village.rewardCharacter as CharacterId,
    village.villageName,
  ]));

const STAGE_PREVIEW_POSITIONS: Record<StageId, string> = {
  hiddenLeaf: '0% 0%',
  hiddenSand: '50% 0%',
  hiddenMist: '100% 0%',
  hiddenCloud: '0% 100%',
  hiddenStone: '50% 100%',
  akatsukiHideout: '100% 100%',
  greatShinobiWar: '50% 100%',
};

// 5% down skips the roster board's title band above the busts.
const CHARACTER_POSITIONS: Record<CharacterId, string> = {
  deidara: '0% 5%',
  naruto: '20% 5%',
  sasuke: '40% 5%',
  gaara: '60% 5%',
  minato: '80% 5%',
  itachi: '100% 5%',
};

function formatKeyLabel(key: string): string {
  return arrowKeySymbols[key] || key.toUpperCase();
}

const MOVEMENT_KEY_AREAS = ['up', 'left', 'down', 'right'] as const;
const BOMB_KEY_INDEX = MOVEMENT_BINDING_LABELS.length;

// "Hidden Leaf Village" fits a thumbnail as "Hidden Leaf"; the caption says it in full.
function shortStageName(name: string): string {
  return name.replace(/ Village$/, '');
}

export const ConfigScreen = () => {
  const initialStoryProgress = useMemo(() => loadStoryProgress(), []);
  // Reopen the deck on the last local battle setup, if that was the last match.
  const lastLocalSetup = useMemo(() => readLastLocalSetup(), []);
  const [activeStep, setActiveStep] = useState(0);
  const [mode, setMode] = useState<GameMode>(lastLocalSetup ? 'local' : 'solo');
  const [rounds, setRounds] = useState<MatchRounds>(lastLocalSetup?.rounds ?? '1');
  const [numOfPlayers, setNumOfPlayers] = useState(
    lastLocalSetup ? String(lastLocalSetup.characters.length) : '1'
  );
  const [selectedStage, setSelectedStage] = useState<StageId>(
    lastLocalSetup?.stageId ?? initialStoryProgress.lastStage
  );
  const [selectedCharacters, setSelectedCharacters] = useState<CharacterId[]>(
    lastLocalSetup?.characters ?? [initialStoryProgress.lastCharacter ?? DEFAULT_CHARACTER_ID]
  );
  // Local Arena: human or CPU per slot (missing entries are human).
  const [controllers, setControllers] = useState<PlayerSlotController[]>(
    lastLocalSetup?.controllers ?? []
  );
  const [selectedUpgrade, setSelectedUpgrade] = useState<StoryUpgradeId>(
    initialStoryProgress.selectedUpgrade
  );
  const [playerKeyBindings, setPlayerKeyBindings] = useState<KeyBindings>(
    loadStoredKeyBindings
  );
  const navigate = useNavigate();
  const [keyErrors, setKeyErrors] = useState<KeyErrors>({});
  const [storyProgress, setStoryProgress] = useState(initialStoryProgress);

  const activePlayerCount = parseInt(numOfPlayers, 10);
  const slotControllers = useMemo(() => {
    const slots = Array.from(
      { length: activePlayerCount },
      (_, slot): PlayerSlotController => (mode === 'local' ? controllers[slot] ?? 'human' : 'human')
    );
    // Dropping a player may leave only CPUs: the first slot plays again.
    if (slots.every((controller) => controller !== 'human')) slots[0] = 'human';
    return slots;
  }, [activePlayerCount, controllers, mode]);
  // Only human slots play from the keyboard, so only they need keys.
  const humanPlayerNumbers = useMemo(() => slotControllers
    .map((controller, slot) => (controller === 'human' ? slot + 1 : 0))
    .filter(Boolean), [slotControllers]);
  const humanSlotsKey = humanPlayerNumbers.join(',');
  const selectedStageDefinition = useMemo(
    () => getStageDefinition(selectedStage),
    [selectedStage]
  );
  const selectedMission = useMemo(
    () => getCampaignMission(selectedStage),
    [selectedStage]
  );
  const selectedBoss = useMemo(
    () => (
      selectedStageDefinition.bossId
        ? getBossDefinition(selectedStageDefinition.bossId)
        : null
    ),
    [selectedStageDefinition]
  );

  const handleModeSelect = (nextMode: GameMode) => {
    setMode(nextMode);
    if (nextMode === 'solo') {
      setNumOfPlayers('1');
      setSelectedStage((current) => (
        storyProgress.unlockedStages.includes(current)
          ? current
          : storyProgress.lastStage
      ));
      setSelectedCharacters((current) => {
        const currentCharacter = current[0] ?? DEFAULT_CHARACTER_ID;
        const lastCharacter = storyProgress.lastCharacter ?? DEFAULT_CHARACTER_ID;
        const fallbackCharacter = storyProgress.unlockedCharacters.includes(lastCharacter)
          ? lastCharacter
          : storyProgress.unlockedCharacters[0] ?? DEFAULT_CHARACTER_ID;
        return [storyProgress.unlockedCharacters.includes(currentCharacter)
          ? currentCharacter
          : fallbackCharacter];
      });
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

  const handleAddPlayer = () => {
    if (activePlayerCount >= MAX_LOCAL_PLAYERS) return;
    handlePlayerCountChange(String(activePlayerCount + 1));
  };

  const handleRemovePlayer = () => {
    if (activePlayerCount <= MIN_LOCAL_PLAYERS) return;
    handlePlayerCountChange(String(activePlayerCount - 1));
  };

  const handleCharacterSelect = (playerIndex: number, characterId: CharacterId) => {
    setSelectedCharacters((current) => current.map((id, index) => (
      index === playerIndex ? characterId : id
    )));
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleCancel = () => {
    navigate('/');
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // Escape goes back one step (or home from the first step), like a game menu.
  // Clicks on the backdrop are ignored so a stray click keeps the setup.
  const handleDialogClose = (_event: object, reason: 'backdropClick' | 'escapeKeyDown') => {
    if (reason === 'backdropClick') return;
    if (activeStep > 0) handleBack();
    else handleCancel();
  };

  const handleResetBindings = () => {
    setPlayerKeyBindings(normalizeKeyBindings(DEFAULT_KEY_BINDINGS));
    setKeyErrors({});
  };

  const startGame = async ({
    nextMode = mode,
    stageId = selectedStage,
    characters = selectedCharacters,
    upgrade = selectedUpgrade,
    players = numOfPlayers,
  }: {
    nextMode?: GameMode;
    stageId?: StageId;
    characters?: CharacterId[];
    upgrade?: StoryUpgradeId;
    players?: string;
  } = {}) => {
    const progress = await launchGame({
      mode: nextMode,
      stageId,
      characters,
      upgrade,
      players,
      keyBindings: playerKeyBindings,
      storyProgress,
      rounds,
      controllers: slotControllers,
    }, navigate);
    if (progress) setStoryProgress(progress);
  };

  const handlePlay = async () => {
    await startGame();
  };

  const handleContinueCampaign = async () => {
    const characters = [storyProgress.lastCharacter ?? DEFAULT_CHARACTER_ID];
    setMode('solo');
    setNumOfPlayers('1');
    setSelectedStage(storyProgress.lastStage);
    setSelectedUpgrade(storyProgress.selectedUpgrade);
    setSelectedCharacters(characters);
    await startGame({
      nextMode: 'solo',
      stageId: storyProgress.lastStage,
      characters,
      upgrade: storyProgress.selectedUpgrade,
      players: '1',
    });
  };

  const handleStartSelectedMission = async () => {
    const characters = [selectedCharacters[0] ?? DEFAULT_CHARACTER_ID];
    setMode('solo');
    setNumOfPlayers('1');
    setSelectedCharacters(characters);
    await startGame({
      nextMode: 'solo',
      stageId: selectedStage,
      characters,
      upgrade: selectedUpgrade,
      players: '1',
    });
  };

  // The village hub (people, shop, codex) before deploying: it deploys with
  // the shinobi and upgrade chosen here.
  const handleVisitVillage = () => {
    const characterId = selectedCharacters[0] ?? DEFAULT_CHARACTER_ID;
    setStoryProgress(selectStoryLoadout(
      storyProgress.unlockedCharacters.includes(characterId)
        ? characterId
        : storyProgress.lastCharacter,
      selectedStage,
      selectedUpgrade
    ));
    navigate(hubPath(selectedStage));
  };

  const handleKeyDown = (
    player: number,
    keyIndex: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    if (event.key === 'Tab' || event.key === 'Escape' || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'Backspace' || key === 'Delete' || (key.length > 1 && !key.includes('Arrow'))) return;
    event.preventDefault();

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
        if (!humanPlayerNumbers.includes(playerIndex + 1)) return;
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
  }, [activePlayerCount, playerKeyBindings, humanSlotsKey]);

  const conflictKeyLabels = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(playerKeyBindings)
      .slice(0, activePlayerCount)
      .forEach((keys, playerIndex) => {
        if (!humanPlayerNumbers.includes(playerIndex + 1)) return;
        keys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
      });
    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([key]) => formatKeyLabel(key));
  }, [activePlayerCount, playerKeyBindings, humanPlayerNumbers]);

  // Each seat's keys in one short line, as the slot cards show them.
  const keyLines = useMemo(() => Array.from({ length: activePlayerCount }, (_, slot) => {
    const keys = playerKeyBindings[slot + 1];
    const movement = keys.slice(0, BOMB_KEY_INDEX).map(formatKeyLabel).join(' ');
    return `${movement} · Bomb ${formatKeyLabel(keys[BOMB_KEY_INDEX])}`;
  }), [activePlayerCount, playerKeyBindings]);

  // A human seat that shares a key with another seat says so on its card.
  const keyClashes = useMemo(() => {
    const humanSlots = humanPlayerNumbers.map((player) => player - 1);
    const owners = new Map<string, number[]>();
    humanSlots.forEach((slot) => playerKeyBindings[slot + 1].forEach((key) => {
      owners.set(key, [...(owners.get(key) ?? []), slot]);
    }));
    const clashes: Record<number, string> = {};
    humanSlots.forEach((slot) => {
      const shared = Array.from(new Set(playerKeyBindings[slot + 1]))
        .filter((key) => (owners.get(key) ?? []).length > 1);
      if (shared.length === 0) return;
      const others = Array.from(new Set(shared.flatMap((key) => owners.get(key) ?? [])))
        .filter((other) => other !== slot);
      const keys = shared.map(formatKeyLabel).join(' ');
      clashes[slot] = others.length > 0
        ? `Clashes with ${others.map(playerSlotLabel).join(', ')}: ${keys}`
        : `Used twice: ${keys}`;
    });
    return clashes;
  }, [humanPlayerNumbers, playerKeyBindings]);

  const battleSummary = useMemo(() => {
    const modeTitle = GAME_MODES.find((item) => item.id === mode)?.title ?? mode;
    const squad = selectedCharacters
      .slice(0, activePlayerCount)
      .map((characterId, index) => {
        const character = CHARACTER_DEFINITIONS.find((item) => item.id === characterId);
        const controller = slotControllers[index] ?? 'human';
        return {
          label: controller === 'human' ? `P${index + 1}` : `P${index + 1} · CPU`,
          name: character?.name ?? characterId,
          accent: character?.secondaryColor ?? '#fbbf24',
        };
      });
    const upgrade = mode === 'solo'
      ? STORY_UPGRADES.find((item) => item.id === selectedUpgrade) ?? null
      : null;
    return { modeTitle, squad, upgrade };
  }, [activePlayerCount, mode, selectedCharacters, selectedUpgrade, slotControllers]);

  const renderKeyConfig = (player: number) => (
    <React.Fragment key={`player-config-${player}`}>
      <PlayerControlsRow numOfPlayers={numOfPlayers}>
        <ControlsLabel>
          {`Player ${player} Loadout Keys`}
        </ControlsLabel>
        <MovementKeysGrid>
          {MOVEMENT_BINDING_LABELS.map((label, keyIndex) => (
            <MovementKeyCell
              key={`player-${player}-key-${keyIndex}`}
              area={MOVEMENT_KEY_AREAS[keyIndex]}
            >
              <ActionKeyName>{label}</ActionKeyName>
              <KeyConfigInput
                aria-label={`player ${player} ${label.toLowerCase()} key`}
                value={formatKeyLabel(playerKeyBindings[player][keyIndex])}
                onKeyDown={(e) => handleKeyDown(player, keyIndex, e)}
                readOnly
                data-error={Boolean(keyErrors[`player${player}-${keyIndex}`])}
              />
            </MovementKeyCell>
          ))}
        </MovementKeysGrid>
        <ActionKeysGrid>
          {ACTION_BINDING_LABELS.map((label, index) => {
            const keyIndex = index + MOVEMENT_BINDING_LABELS.length;
            const key = playerKeyBindings[player][keyIndex];
            return (
              <ActionKeyCell key={`player-${player}-key-${keyIndex}`}>
                <ActionKeyName>{label}</ActionKeyName>
                <KeyConfigInput
                  aria-label={`player ${player} ${label.toLowerCase()} key`}
                  value={formatKeyLabel(key)}
                  onKeyDown={(e) => handleKeyDown(player, keyIndex, e)}
                  readOnly
                  data-error={Boolean(keyErrors[`player${player}-${keyIndex}`])}
                />
              </ActionKeyCell>
            );
          })}
        </ActionKeysGrid>
      </PlayerControlsRow>
    </React.Fragment>
  );

  useEffect(() => {
    setStoryProgress(loadStoryProgress());
  }, []);

  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // The deck opens with the selected mode focused, so the arrow keys work at
  // once. Only the first open: later step changes focus the step's heading.
  const deckOpened = useRef(false);
  useEffect(() => {
    deckOpened.current = true;
  }, []);
  const firstStep = useRef(true);
  useEffect(() => {
    // Each step opens at its top, not at the previous step's scroll position.
    if (contentRef.current) contentRef.current.scrollTop = 0;
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [activeStep]);

  const steps = mode === 'solo'
    ? ['Mission', 'Upgrade', 'Controls']
    : ['Setup', 'Controls'];
  const optionalSteps = mode === 'solo' ? ['Upgrade', 'Controls'] : ['Controls'];
  const isKeysStep = activeStep === steps.length - 1;
  const hasKeyConflicts = Object.keys(keyErrors).length > 0;
  // "Continue Campaign" only differs from "Deploy Mission" once the player has
  // picked another village, shinobi or upgrade than the saved run.
  const showContinueCampaign = mode === 'solo' && (
    selectedStage !== storyProgress.lastStage
    || (selectedCharacters[0] ?? DEFAULT_CHARACTER_ID)
      !== (storyProgress.lastCharacter ?? DEFAULT_CHARACTER_ID)
    || selectedUpgrade !== storyProgress.selectedUpgrade
  );
  // One primary action per mode, in the footer on every step.
  const startsMissionFromBriefing = mode === 'solo' && activeStep === 0;
  const primaryLabel = mode === 'solo' ? 'Deploy Mission' : 'Start Battle';
  const handlePrimary = startsMissionFromBriefing ? handleStartSelectedMission : handlePlay;

  return (
    <WelcomeContainer
      sx={{
        backgroundImage: `url(${StageAtlas})`,
        backgroundSize: '300% auto',
        backgroundPosition: '0% 0%',
        backgroundRepeat: 'no-repeat',
        '@media (max-width: 560px)': {
          backgroundSize: 'auto 200%',
        },
      }}
    >
      <StyledDialog
        open
        aria-labelledby="config-dialog-title"
        onClose={handleDialogClose}
        PaperProps={{ onKeyDown: moveFocusWithArrows, onFocus: keepRovingStopOnFocus }}
      >
        <DialogTitle id="config-dialog-title" ref={titleRef} tabIndex={-1}>
          {activeStep === 0 && 'Mission Deck'}
          {activeStep === 1 && mode === 'solo' && 'Upgrade Arsenal'}
          {((activeStep === 1 && mode === 'local') || activeStep === 2)
            && 'Key Bindings'}
        </DialogTitle>
        <Stepper activeStep={activeStep} nonLinear>
          {steps.map((label, index) => {
            const optional = optionalSteps.includes(label)
              ? <Typography variant="caption">Optional</Typography>
              : undefined;
            return (
              <Step key={label} completed={index < activeStep}>
                {index < activeStep ? (
                  <StepButton onClick={() => setActiveStep(index)} optional={optional}>
                    {label}
                  </StepButton>
                ) : (
                  <StepLabel optional={optional}>{label}</StepLabel>
                )}
              </Step>
            );
          })}
        </Stepper>
        <DialogContent ref={contentRef}>
          {activeStep === 0 && (
            <StepContent>
              <ToggleButtonGroup
                value={mode}
                exclusive
                fullWidth
                onChange={(_event, nextMode: GameMode | null) => {
                  if (nextMode) handleModeSelect(nextMode);
                }}
                aria-label="game mode"
                data-roving-group
              >
                {GAME_MODES.map((item) => (
                  <ToggleButton
                    key={item.id}
                    value={item.id}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus={!deckOpened.current && item.id === mode}
                  >
                    <ModeToggleText>
                      <span>{item.title}</span>
                      {' '}
                      <small>{item.description}</small>
                    </ModeToggleText>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              {mode === 'local' && (
                <>
                  <PlayerSlotsSelector
                    characters={selectedCharacters.slice(0, activePlayerCount)}
                    controllers={slotControllers}
                    keyLines={keyLines}
                    keyClashes={keyClashes}
                    onCharacterChange={handleCharacterSelect}
                    onControllersChange={setControllers}
                    onAddPlayer={handleAddPlayer}
                    onRemovePlayer={handleRemovePlayer}
                  />
                  <SectionTitle variant="subtitle2" component="h3" id="stage-label">Stage</SectionTitle>
                  <StageStrip role="group" aria-labelledby="stage-label" data-roving-group>
                    {STAGE_DEFINITIONS.map((item) => {
                      const selected = selectedStage === item.id;
                      return (
                        <StageThumb
                          key={item.id}
                          type="button"
                          chosen={selected}
                          onClick={() => setSelectedStage(item.id)}
                          aria-label={item.name}
                          aria-describedby={selected ? 'stage-mechanic' : undefined}
                          aria-pressed={selected}
                        >
                          {selected && <SelectedMark aria-hidden="true">✓</SelectedMark>}
                          <StageThumbArt>
                            <StagePreviewImage
                              image={item.id === 'greatShinobiWar' ? GreatWarStage : StageAtlas}
                              aria-hidden="true"
                              standalone={item.id === 'greatShinobiWar'}
                              backgroundPosition={item.id === 'greatShinobiWar'
                                ? 'center'
                                : STAGE_PREVIEW_POSITIONS[item.id]}
                            />
                          </StageThumbArt>
                          <span aria-hidden="true">{shortStageName(item.name)}</span>
                        </StageThumb>
                      );
                    })}
                  </StageStrip>
                  <StageCaption id="stage-mechanic">
                    <strong>{selectedStageDefinition.name}</strong>
                    {' · '}
                    {selectedStageDefinition.mechanic}
                  </StageCaption>
                  <RoundsRow>
                    <span id="rounds-label">Rounds</span>
                    <ToggleButtonGroup
                      value={rounds}
                      exclusive
                      onChange={(_e, next: MatchRounds | null) => { if (next) setRounds(next); }}
                      aria-labelledby="rounds-label"
                      data-roving-group
                    >
                      <ToggleButton value="1" aria-label="1 round">1</ToggleButton>
                      <ToggleButton value="3" aria-label="best of 3">Best of 3</ToggleButton>
                      <ToggleButton value="5" aria-label="best of 5">Best of 5</ToggleButton>
                    </ToggleButtonGroup>
                  </RoundsRow>
                </>
              )}

              {mode === 'solo' && selectedMission && (
                <MissionBriefing accent={selectedStageDefinition.palette.accent}>
                  <MissionBriefingPreview>
                    <StagePreviewImage
                      image={StageAtlas}
                      role="img"
                      aria-label={`${selectedStageDefinition.name} mission preview`}
                      backgroundPosition={STAGE_PREVIEW_POSITIONS[selectedStageDefinition.id]}
                    />
                  </MissionBriefingPreview>
                  <MissionBriefingDetails>
                    <Typography variant="overline" fontWeight="bold">
                      {selectedMission.villageName}
                      {' '}
                      Campaign
                    </Typography>
                    <Typography variant="h5" component="h3" fontWeight="bold">
                      {selectedMission.title}
                    </Typography>
                    <CardMeta variant="body2">
                      Gate:
                      {' '}
                      {selectedMission.bossGateLabel}
                      {' '}
                      · Boss:
                      {' '}
                      {selectedBoss?.name ?? 'Village Boss'}
                    </CardMeta>
                    <MissionObjectiveList aria-label="mission goals">
                      {selectedMission.objectives.map((objective) => (
                        <MissionObjectiveItem
                          key={objective.id}
                          accent={selectedStageDefinition.palette.accent}
                        >
                          <strong>{objective.label}</strong>
                        </MissionObjectiveItem>
                      ))}
                    </MissionObjectiveList>
                    <MissionActionRow>
                      <Button
                        variant="outlined"
                        onClick={handleVisitVillage}
                        aria-label={`Visit ${selectedMission.villageName} hub`}
                      >
                        Visit Village
                      </Button>
                      {showContinueCampaign && (
                        <Button variant="outlined" onClick={handleContinueCampaign}>
                          Continue Campaign
                        </Button>
                      )}
                      {/* New to the controls: four short practice rooms first. */}
                      <Button
                        variant="text"
                        startIcon={<SchoolOutlinedIcon />}
                        onClick={() => navigate(DOJO_PATH)}
                      >
                        Training Dojo
                      </Button>
                    </MissionActionRow>
                  </MissionBriefingDetails>
                </MissionBriefing>
              )}

              {mode === 'solo' && (
                <>
                  <SectionTitle variant="subtitle2" component="h3" id="route-label">Campaign Route</SectionTitle>
                  <CampaignRoute role="group" aria-labelledby="route-label" data-roving-group>
                    {CAMPAIGN_VILLAGES.map((village) => {
                      const stageDefinition = STAGE_DEFINITIONS.find(
                        (item) => item.id === village.stageId
                      );
                      const accent = stageDefinition?.palette.accent ?? '#f59e0b';
                      const completed = storyProgress.completedStages.includes(village.stageId);
                      const active = storyProgress.lastStage === village.stageId;
                      const locked = !storyProgress.unlockedStages.includes(village.stageId);
                      let status = 'Unlocked';
                      if (completed) status = 'Cleared';
                      if (active) status = 'Current';
                      if (locked) status = 'Locked';
                      return (
                        <CampaignRouteCard
                          key={village.stageId}
                          type="button"
                          active={selectedStage === village.stageId}
                          completed={completed}
                          locked={locked}
                          accent={accent}
                          disabled={locked}
                          onClick={() => {
                            if (!locked) setSelectedStage(village.stageId);
                          }}
                          aria-label={`${village.villageName} campaign route`}
                          aria-describedby={`route-status-${village.stageId}`}
                          aria-pressed={selectedStage === village.stageId}
                        >
                          <RouteStatusBadge id={`route-status-${village.stageId}`} accent={accent}>
                            {locked && <LockOutlinedIcon aria-hidden="true" />}
                            {village.order}
                            {' '}
                            ·
                            {' '}
                            {status}
                          </RouteStatusBadge>
                          {selectedStage === village.stageId && <SelectedMark aria-hidden="true">✓</SelectedMark>}
                          <Typography component="span" variant="subtitle2" fontWeight="bold" sx={{ mt: 0.5, display: 'block', lineHeight: 1.2 }}>
                            {village.villageName}
                          </Typography>
                        </CampaignRouteCard>
                      );
                    })}
                  </CampaignRoute>
                  <DifficultySelector />
                  <SectionTitle variant="subtitle2" component="h3" id="shinobi-label">Shinobi</SectionTitle>
                  <SelectionGrid className="compact" role="group" aria-labelledby="shinobi-label" data-roving-group>
                    {CHARACTER_DEFINITIONS.map((character) => {
                      const locked = !storyProgress.unlockedCharacters.includes(character.id);
                      const selected = selectedCharacters[0] === character.id;
                      const unlockedBy = UNLOCKED_BY.get(character.id);
                      return (
                        <SelectionCard
                          key={character.id}
                          type="button"
                          selected={selected}
                          accent={character.secondaryColor}
                          disabled={locked}
                          onClick={() => handleCharacterSelect(0, character.id)}
                          aria-label={`${character.name} player 1${locked ? ', locked' : ''}`}
                          aria-pressed={selected}
                        >
                          {selected && <SelectedMark aria-hidden="true">✓</SelectedMark>}
                          <CharacterPortrait className="card-art compact">
                            <CharacterPortraitImage
                              image={RosterBoard}
                              aria-hidden="true"
                              backgroundPosition={CHARACTER_POSITIONS[character.id]}
                            />
                          </CharacterPortrait>
                          <CardHeader>
                            <Typography component="span" variant="subtitle2" fontWeight="bold">{character.name}</Typography>
                          </CardHeader>
                          {locked && (
                            <LockBadge>
                              <LockOutlinedIcon aria-hidden="true" />
                              <span>Locked</span>
                              {unlockedBy && <small>{`Clear ${unlockedBy}`}</small>}
                            </LockBadge>
                          )}
                        </SelectionCard>
                      );
                    })}
                  </SelectionGrid>
                </>
              )}
            </StepContent>
          )}
          {activeStep === 1 && mode === 'solo' && (
            <StepContent>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                Pick one story upgrade for this mission run.
              </Typography>
              <SelectionGrid role="group" aria-label="story upgrade" data-roving-group>
                {STORY_UPGRADES.map((upgrade) => {
                  const unlocked = storyProgress.unlockedUpgrades.includes(upgrade.id);
                  const selected = selectedUpgrade === upgrade.id;
                  return (
                    <SelectionCard
                      key={upgrade.id}
                      type="button"
                      selected={selected}
                      accent="#f59e0b"
                      disabled={!unlocked}
                      onClick={() => unlocked && setSelectedUpgrade(upgrade.id)}
                      aria-label={upgrade.name}
                      aria-describedby={`upgrade-meta-${upgrade.id}${unlocked ? '' : ` upgrade-lock-${upgrade.id}`}`}
                      aria-pressed={selected}
                    >
                      {selected && <SelectedMark aria-hidden="true">✓</SelectedMark>}
                      <Typography component="span" variant="subtitle2" fontWeight="bold">
                        {upgrade.name}
                      </Typography>
                      <CardMeta id={`upgrade-meta-${upgrade.id}`} variant="caption">{upgrade.description}</CardMeta>
                      {!unlocked && (
                        <LockBadge id={`upgrade-lock-${upgrade.id}`}>
                          <LockOutlinedIcon aria-hidden="true" />
                          <span>Locked</span>
                        </LockBadge>
                      )}
                    </SelectionCard>
                  );
                })}
              </SelectionGrid>
            </StepContent>
          )}
          {isKeysStep && (
            <StepContent>
              <SummaryStrip aria-label="battle plan summary">
                <SummaryItem accent="#fbbf24">
                  <span>Mode</span>
                  <strong>{battleSummary.modeTitle}</strong>
                </SummaryItem>
                <SummaryItem accent={selectedStageDefinition.palette.accent}>
                  <span>Stage</span>
                  <strong>{selectedStageDefinition.name}</strong>
                </SummaryItem>
                {battleSummary.squad.map((member) => (
                  <SummaryItem key={member.label} accent={member.accent}>
                    <span>{member.label}</span>
                    <strong>{member.name}</strong>
                  </SummaryItem>
                ))}
                {battleSummary.upgrade && (
                  <SummaryItem accent="#2dd4bf">
                    <span>Upgrade</span>
                    <strong>{battleSummary.upgrade.name}</strong>
                  </SummaryItem>
                )}
              </SummaryStrip>
              <KeyHint>{KEY_REBIND_HINT}</KeyHint>
              <div>
                {humanPlayerNumbers.map((player) => renderKeyConfig(player))}
              </div>
              {hasKeyConflicts && (
                <>
                  <Typography variant="body2" color="error" sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                    <Info sx={{ mr: 1, fontSize: 'inherit' }} />
                    Please correct the highlighted key conflicts before proceeding.
                  </Typography>
                  {conflictKeyLabels.length > 0 && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                      {`Duplicated keys: ${conflictKeyLabels.join(' · ')}`}
                    </Typography>
                  )}
                </>
              )}
            </StepContent>
          )}
        </DialogContent>
        <DeckFooter data-deck-footer>
          <FooterActions>
            {activeStep === 0 ? (
              <Button variant="text" size="large" onClick={handleCancel}>{MAIN_MENU_LABEL}</Button>
            ) : (
              <Button variant="text" size="large" onClick={handleBack}>Back</Button>
            )}
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={handlePrimary}
              disabled={!startsMissionFromBriefing && hasKeyConflicts}
            >
              {primaryLabel}
            </Button>
            {isKeysStep ? (
              <Button variant="outlined" size="large" onClick={handleResetBindings}>Reset Keys</Button>
            ) : (
              <Button variant="outlined" size="large" onClick={handleNext}>Next</Button>
            )}
          </FooterActions>
          {!isKeysStep && <FooterHint>{MENU_KEYS_HINT}</FooterHint>}
        </DeckFooter>
        <RovingTabStops root={contentRef} />
      </StyledDialog>
    </WelcomeContainer>
  );
};
