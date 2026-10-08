/* eslint-disable max-len */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import SettingsIcon from '@mui/icons-material/Settings';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Tooltip } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { StyledBackground } from '../WelcomeScreen/WelcomeScreen.styles';
import {
  KeyBindings,
  DEFAULT_KEY_BINDINGS,
  arrowKeySymbols,
  normalizeKeyBindings,
} from '../../constants/props';
import { RoundResultDialog } from './RoundResultDialog';
import { ResultTone } from './RoundResultDialog.styles';
import SettingsScreen from './SettingsScreen/SettingsScreen';
import ModifyControlsDialog from './SettingsScreen/ModifyControlsDialog';
import { GameScene3D } from './GameScene3D';
import { GameHUD } from './GameHUD';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useRenderState } from '../../hooks/useRenderState';
import { GameConfig, GameEngineState, loadMapFromStorage } from '../../engine';
import {
  DEFAULT_CHARACTER_ID, DEFAULT_STAGE_ID, GameMode, getCharacterDefinition,
} from '../../content';
import { CharacterId } from '../../content/types';
import { completeCampaignStage, recordCampaignDiscoveries } from '../../story/progress';
import {
  GameSceneContainer,
  TopControls,
  LoadingMessage,
  GameBackground,
  ControlButton,
  PauseOverlay,
  PauseMenuCard,
  PauseMenuTitle,
  PauseMenuActions,
  PauseMenuButton,
  ControlsGuide,
  ControlsGuideHeader,
  ControlsDismissButton,
  ControlTable,
  ControlSlot,
  PlayerKits,
  CountdownOverlay,
  GoOverlay,
  FeedbackCaption,
  CaptionLiveRegion,
} from './GameScreen.styles';
import {
  loadGamePreferences,
  saveGamePreferences,
} from './gamePreferences';
import { useGameFeedback } from './useGameFeedback';
import { playerSlotColor, playerSlotLabel, playerSlotTextColor } from './playerSlots';
import { loadCampaignDifficulty } from '../ConfigScreen/campaignDifficulty';

const CONTROLS_GUIDE_SEEN_KEY = 'shinobiControlsGuideSeen';

function loadStoredKeyBindings(): KeyBindings {
  try {
    const stored = localStorage.getItem('playerKeyBindings');
    return normalizeKeyBindings(stored ? JSON.parse(stored) : DEFAULT_KEY_BINDINGS);
  } catch {
    return normalizeKeyBindings(DEFAULT_KEY_BINDINGS);
  }
}

function hasSeenControlsGuide(): boolean {
  try {
    return localStorage.getItem(CONTROLS_GUIDE_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadStoredGameSetup(): Partial<GameConfig> {
  try {
    const storedSetup = localStorage.getItem('gameSetup');
    return storedSetup ? JSON.parse(storedSetup) : {};
  } catch {
    return {};
  }
}

function formatKeyLabel(key: string): string {
  return arrowKeySymbols[key] ?? key.toUpperCase();
}

function formatMovementKeys(bindings: string[]): string {
  return [
    bindings[0],
    bindings[1],
    bindings[2],
    bindings[3],
  ].map(formatKeyLabel).join(' ');
}

type ControlsRow = {
  slot: number;
  name: string;
  keys: { move: string; bomb: string; detonate: string; ultimate: string; cover: string };
};

// One row per player and one column per action: the old list of ten to
// fifteen "P1 move / P1 bomb ..." pairs had to be read item by item.
const ControlsTable = ({ rows, label }: { rows: ControlsRow[]; label: string }) => (
  <ControlTable aria-label={label}>
    <thead>
      <tr>
        <th scope="col">Shinobi</th>
        <th scope="col">Move</th>
        <th scope="col">Bomb</th>
        <th scope="col">
          <abbr title="Detonate">Det</abbr>
        </th>
        <th scope="col">
          <abbr title="Ultimate">Ult</abbr>
        </th>
        <th scope="col">Cover</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.slot}>
          <th scope="row">
            <ControlSlot
              slotColor={playerSlotColor(row.slot)}
              textColor={playerSlotTextColor(row.slot)}
            >
              {playerSlotLabel(row.slot)}
            </ControlSlot>
            <span>{row.name}</span>
          </th>
          <td><kbd>{row.keys.move}</kbd></td>
          <td><kbd>{row.keys.bomb}</kbd></td>
          <td><kbd>{row.keys.detonate}</kbd></td>
          <td><kbd>{row.keys.ultimate}</kbd></td>
          <td><kbd>{row.keys.cover}</kbd></td>
        </tr>
      ))}
    </tbody>
  </ControlTable>
);

// "GO!" stays up for the first 700 ms of play. Counted in engine ticks, so
// it pauses with the game and needs no timer or extra render: GameScreen
// already renders on every engine publish.
const GO_BEAT_TICKS = 14;

function useRoundStartBeat(state: GameEngineState | null): { countdown: string; go: boolean } {
  const beatRef = useRef<{ armed: boolean; liveTick: number | null }>({ armed: false, liveTick: null });
  if (!state || state.phase !== 'playing') return { countdown: '', go: false };
  const beat = beatRef.current;
  if (state.roundStartTicksRemaining > 0) {
    beat.armed = true;
    beat.liveTick = null;
    return { countdown: String(Math.ceil(state.roundStartTicksRemaining / 1000)), go: false };
  }
  if (beat.armed && beat.liveTick === null) beat.liveTick = state.tick;
  const go = beat.liveTick !== null && state.tick - beat.liveTick < GO_BEAT_TICKS;
  if (!go) beat.armed = false;
  return { countdown: '', go };
}

type GameTopControlsProps = {
  isPaused: boolean;
  showHud: boolean;
  onPauseToggle: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onShowControls: () => void;
  onToggleHud: () => void;
};

// Memoised so the five tooltips and icon buttons do not re-render on every
// engine tick. An open MUI Tooltip rebuilds its popper.js instance on each
// render (its default PopperProps object is new every time), which forces a
// style recalc and layout per tick while the pointer rests on a button.
const GameTopControls = React.memo(({
  isPaused,
  showHud,
  onPauseToggle,
  onRestart,
  onOpenSettings,
  onShowControls,
  onToggleHud,
}: GameTopControlsProps) => (
  <TopControls>
    <Tooltip title={isPaused ? 'Resume' : 'Pause'}>
      <ControlButton
        aria-label={isPaused ? 'resume game' : 'pause game'}
        onClick={onPauseToggle}
      >
        {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
      </ControlButton>
    </Tooltip>
    <Tooltip title="Restart same setup">
      <ControlButton aria-label="restart same setup" onClick={onRestart}>
        <RestartAltIcon />
      </ControlButton>
    </Tooltip>
    <Tooltip title="Settings">
      <ControlButton
        aria-label="open settings"
        onClick={onOpenSettings}
      >
        <SettingsIcon />
      </ControlButton>
    </Tooltip>
    <Tooltip title="Controls">
      <ControlButton
        aria-label="show controls"
        onClick={onShowControls}
      >
        <KeyboardIcon />
      </ControlButton>
    </Tooltip>
    <Tooltip title={showHud ? 'Hide HUD' : 'Show HUD'}>
      <ControlButton
        aria-label={showHud ? 'hide HUD' : 'show HUD'}
        onClick={onToggleHud}
      >
        {showHud ? <VisibilityOffIcon /> : <VisibilityIcon />}
      </ControlButton>
    </Tooltip>
  </TopControls>
));
GameTopControls.displayName = 'GameTopControls';

// Closed dialogs still ran their render (and the result dialog its match
// breakdown) on every tick. Skip parent re-renders while they stay closed;
// opening one always re-renders it with fresh props.
const MemoRoundResultDialog = React.memo(
  RoundResultDialog,
  (prev, next) => !prev.open && !next.open
);
const MemoSettingsScreen = React.memo(
  SettingsScreen,
  (prev, next) => !prev.open && !next.open
);
const MemoModifyControlsDialog = React.memo(
  ModifyControlsDialog,
  (prev, next) => !prev.isOpen && !next.isOpen
);
// Fed the render state (see useRenderState), so a held-movement frame skips
// the whole HUD and 3D scene re-render; the scene draws those steps itself.
const MemoGameHUD = React.memo(GameHUD);
const MemoGameScene3D = React.memo(GameScene3D);

export const GameScreen = () => {
  const { numOfPlayers, numOfRounds, selectedMap } = useParams();
  const navigate = useNavigate();
  const [keyBindings, setKeyBindings] = useState<KeyBindings>(loadStoredKeyBindings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModifyingControls, setIsModifyingControls] = useState(false);
  const [showControlsGuide, setShowControlsGuide] = useState(() => !hasSeenControlsGuide());
  const [showHud, setShowHud] = useState(true);
  const [preferences, setPreferences] = useState(loadGamePreferences);
  const controlsGuidePausedGame = useRef(false);
  // Settings (and the controls editor reached from it) give play back only
  // when they were opened mid-play; opened from the pause menu, closing them
  // returns there instead of un-pausing under the player.
  const resumeAfterMenu = useRef(true);

  const config = useMemo<GameConfig | null>(() => {
    if (!numOfPlayers || !numOfRounds || !selectedMap) return null;
    const setup = loadStoredGameSetup();
    const players = parseInt(numOfPlayers, 10);
    return {
      mode: (setup.mode as GameMode | undefined) ?? 'local',
      numPlayers: players,
      totalRounds: parseInt(numOfRounds, 10),
      selectedMap,
      map: loadMapFromStorage(),
      stageId: setup.stageId ?? DEFAULT_STAGE_ID,
      selectedCharacters: setup.selectedCharacters
        ?? Array.from({ length: players }, () => DEFAULT_CHARACTER_ID),
      selectedUpgrade: setup.selectedUpgrade,
      difficulty: loadCampaignDifficulty(),
    };
  }, [numOfPlayers, numOfRounds, selectedMap]);

  const {
    state,
    motion,
    advanceFrame,
    pause,
    resume,
    restart,
    dismissDialog,
  } = useGameEngine(config, keyBindings);
  const renderState = useRenderState(state);
  const feedback = useGameFeedback(renderState, preferences);

  const handlePreferencesChange = useCallback((nextPreferences: typeof preferences) => {
    setPreferences(nextPreferences);
    saveGamePreferences(nextPreferences);
  }, []);

  const bossHealth = state?.boss?.health;
  const bossId = state?.boss?.id;
  const gamePhase = state?.phase;
  const gameMode = state?.config.mode;
  const stageId = state?.config.stageId;
  const campaignStageId = state?.campaign?.stageId;
  const campaignSecretsKey = state?.campaign?.discoveredSecrets.join('|') ?? '';
  const leadCharacterId = state?.players[0]?.characterId;
  const rewardedStages = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (
      gameMode === 'solo'
      && gamePhase === 'game_over'
      && bossId
      && stageId
      && typeof bossHealth === 'number'
      && bossHealth <= 0
    ) {
      const rewardKey = `${stageId}:${bossId}`;
      if (!rewardedStages.current.has(rewardKey)) {
        rewardedStages.current.add(rewardKey);
        completeCampaignStage(stageId, bossId);
      }
    }
  }, [bossHealth, bossId, gameMode, gamePhase, stageId]);

  useEffect(() => {
    if (
      gameMode === 'solo'
      && campaignStageId
      && leadCharacterId
      && campaignSecretsKey.length > 0
    ) {
      recordCampaignDiscoveries(
        campaignStageId,
        leadCharacterId,
        campaignSecretsKey.split('|')
      );
    }
  }, [campaignSecretsKey, campaignStageId, gameMode, leadCharacterId]);

  const isPaused = state?.paused ?? false;
  const dialogOpen = state?.phase === 'round_end' || state?.phase === 'game_over';
  const resultTone = useMemo<ResultTone>(() => {
    if (!state || state.phase !== 'game_over' || state.config.mode !== 'solo') {
      return 'neutral';
    }
    const bossSealed = state.boss ? state.boss.health <= 0 : false;
    if (bossSealed || state.campaign?.missionResult === 'success') {
      return 'victory';
    }
    return 'defeat';
  }, [state]);
  const roundStart = useRoundStartBeat(state);
  const parsedPlayerCount = Number(numOfPlayers ?? 1);
  const activePlayerCount = Number.isFinite(parsedPlayerCount)
    ? Math.max(1, parsedPlayerCount)
    : 1;
  const characterIdsKey = state?.players.map((player) => player.characterId).join('|') ?? '';
  const controlRows = useMemo<ControlsRow[]>(() => {
    const characterIds = characterIdsKey ? characterIdsKey.split('|') as CharacterId[] : [];
    // The match's own roster when it is loaded; the route's count before that.
    return Array.from({ length: characterIds.length || activePlayerCount }, (_, index) => {
      const playerNumber = String(index + 1);
      const bindings = keyBindings[playerNumber] ?? DEFAULT_KEY_BINDINGS[playerNumber];
      const characterId = characterIds[index];
      return {
        slot: index,
        name: characterId ? getCharacterDefinition(characterId).name : `Player ${playerNumber}`,
        keys: {
          move: formatMovementKeys(bindings),
          bomb: formatKeyLabel(bindings[4]),
          detonate: formatKeyLabel(bindings[5]),
          ultimate: formatKeyLabel(bindings[6]),
          cover: formatKeyLabel(bindings[7]),
        },
      };
    });
  }, [activePlayerCount, characterIdsKey, keyBindings]);
  // The static kit text the old HUD cards carried, kept for the pause menu.
  const playerKits = useMemo(() => (
    (characterIdsKey ? characterIdsKey.split('|') as CharacterId[] : []).map((characterId, index) => {
      const character = getCharacterDefinition(characterId);
      return {
        slot: index,
        name: character.name,
        title: character.title,
        detail: `Bomb: ${character.basicBomb} · Ult: ${character.ultimate} · Vision ${character.visionRadius}`,
      };
    })
  ), [characterIdsKey]);

  const handleTogglePause = useCallback(() => {
    if (isPaused) resume();
    else pause();
  }, [isPaused, pause, resume]);

  const handleOpenSettings = useCallback(() => {
    resumeAfterMenu.current = !isPaused;
    setIsSettingsOpen(true);
    pause();
  }, [isPaused, pause]);

  const handleCloseMenus = useCallback(() => {
    setIsSettingsOpen(false);
    setIsModifyingControls(false);
    if (resumeAfterMenu.current) resume();
  }, [resume]);

  const handleResumeFromSettings = useCallback(() => {
    setIsSettingsOpen(false);
    resume();
  }, [resume]);

  const handleDismissControlsGuide = useCallback(() => {
    setShowControlsGuide(false);
    try {
      localStorage.setItem(CONTROLS_GUIDE_SEEN_KEY, 'true');
    } catch {
      // The guide can still close if storage is unavailable.
    }
    if (controlsGuidePausedGame.current) {
      controlsGuidePausedGame.current = false;
      resume();
    }
  }, [resume]);

  const handleShowControlsGuide = useCallback(() => {
    // Already open: the guide paused the game itself, so keep its resume flag.
    if (showControlsGuide) return;
    controlsGuidePausedGame.current = !isPaused;
    setShowControlsGuide(true);
    if (!isPaused) pause();
  }, [isPaused, pause, showControlsGuide]);

  useEffect(() => {
    if (
      showControlsGuide
      && !isPaused
      && !dialogOpen
      && !isSettingsOpen
      && !isModifyingControls
    ) {
      controlsGuidePausedGame.current = true;
      pause();
    }
  }, [
    dialogOpen,
    isModifyingControls,
    isPaused,
    isSettingsOpen,
    pause,
    showControlsGuide,
  ]);

  const handleToggleHud = useCallback(() => {
    setShowHud((visible) => !visible);
  }, []);

  const handleQuitGame = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleCloseDialog = () => {
    dismissDialog();
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (dialogOpen) return;
      event.preventDefault();

      if (showControlsGuide) {
        handleDismissControlsGuide();
        return;
      }

      if (isModifyingControls || isSettingsOpen) {
        handleCloseMenus();
        return;
      }

      handleTogglePause();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [
    dialogOpen,
    handleCloseMenus,
    handleTogglePause,
    handleDismissControlsGuide,
    isModifyingControls,
    isSettingsOpen,
    showControlsGuide,
  ]);

  // The countdown overlay is visual only; the live region reads "3, 2, 1,
  // Go!" (nothing else happens while the arena is frozen) and then captions.
  const countdownVisible = !!roundStart.countdown && !isPaused && !dialogOpen;
  const goVisible = roundStart.go && !isPaused && !dialogOpen;
  let liveAnnouncement = feedback.caption;
  if (countdownVisible) liveAnnouncement = roundStart.countdown;
  else if (goVisible) liveAnnouncement = 'Go!';

  if (!state || !renderState) {
    return (
      <StyledBackground>
        <LoadingMessage>Loading game...</LoadingMessage>
      </StyledBackground>
    );
  }

  return (
    <GameBackground>
      {showHud && <MemoGameHUD state={renderState} scale={preferences.hudScale} />}
      <GameTopControls
        isPaused={isPaused}
        showHud={showHud}
        onPauseToggle={showControlsGuide ? handleDismissControlsGuide : handleTogglePause}
        onRestart={restart}
        onOpenSettings={handleOpenSettings}
        onShowControls={handleShowControlsGuide}
        onToggleHud={handleToggleHud}
      />
      <GameSceneContainer>
        <MemoGameScene3D
          state={renderState}
          preferences={preferences}
          impact={feedback.impact}
          motion={motion}
          advanceFrame={advanceFrame}
        />
      </GameSceneContainer>
      <CaptionLiveRegion role="status" aria-atomic="true">
        {liveAnnouncement}
      </CaptionLiveRegion>
      {feedback.caption && (
        <FeedbackCaption key={feedback.eventId} aria-hidden="true">
          {feedback.caption}
        </FeedbackCaption>
      )}
      {countdownVisible && (
        <CountdownOverlay aria-label="round countdown">
          <strong>{roundStart.countdown}</strong>
        </CountdownOverlay>
      )}
      {goVisible && (
        <GoOverlay aria-hidden="true">
          <strong>GO!</strong>
        </GoOverlay>
      )}
      {showControlsGuide && !dialogOpen && !isSettingsOpen && !isModifyingControls && (
        <ControlsGuide aria-label="controls guide">
          <ControlsGuideHeader>
            <strong>Controls</strong>
            <ControlsDismissButton
              aria-label="hide controls guide"
              onClick={handleDismissControlsGuide}
            >
              <CloseIcon fontSize="small" />
            </ControlsDismissButton>
          </ControlsGuideHeader>
          <ControlsTable rows={controlRows} label="controls" />
        </ControlsGuide>
      )}
      {isPaused && !showControlsGuide && !dialogOpen && !isSettingsOpen && !isModifyingControls && (
        <PauseOverlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-menu-title"
        >
          <PauseMenuCard>
            <PauseMenuTitle id="pause-menu-title">
              <strong>Paused</strong>
              <span>Esc resumes</span>
            </PauseMenuTitle>
            <PauseMenuActions>
              <PauseMenuButton
                autoFocus
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={resume}
              >
                Resume
              </PauseMenuButton>
              <PauseMenuButton
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={restart}
              >
                Restart
              </PauseMenuButton>
              <PauseMenuButton
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={handleOpenSettings}
              >
                Settings
              </PauseMenuButton>
              <PauseMenuButton
                variant="outlined"
                color="warning"
                startIcon={<ExitToAppIcon />}
                onClick={handleQuitGame}
              >
                Quit Game
              </PauseMenuButton>
            </PauseMenuActions>
            <ControlsTable rows={controlRows} label="controls" />
            <PlayerKits aria-label="shinobi kits">
              {playerKits.map((kit) => (
                <li key={kit.slot}>
                  <ControlSlot
                    slotColor={playerSlotColor(kit.slot)}
                    textColor={playerSlotTextColor(kit.slot)}
                  >
                    {playerSlotLabel(kit.slot)}
                  </ControlSlot>
                  <span>
                    <strong>{`${kit.name} · ${kit.title}`}</strong>
                    {kit.detail}
                  </span>
                </li>
              ))}
            </PlayerKits>
          </PauseMenuCard>
        </PauseOverlay>
      )}
      <MemoRoundResultDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onRestart={restart}
        resultMessage={state.resultMessage}
        isGameOver={state.phase === 'game_over'}
        tone={resultTone}
        state={state}
      />
      <MemoSettingsScreen
        open={isSettingsOpen}
        onClose={handleCloseMenus}
        onResume={handleResumeFromSettings}
        onRestart={() => {
          restart();
          setIsSettingsOpen(false);
          resume();
        }}
        onModifyControls={() => {
          setIsSettingsOpen(false);
          setIsModifyingControls(true);
          pause();
        }}
        preferences={preferences}
        onPreferencesChange={handlePreferencesChange}
      />
      <MemoModifyControlsDialog
        isOpen={isModifyingControls}
        onClose={handleCloseMenus}
        onSave={(nextBindings) => {
          const normalized = normalizeKeyBindings(nextBindings);
          setKeyBindings(normalized);
          try {
            localStorage.setItem('playerKeyBindings', JSON.stringify(normalized));
          } catch {
            // The new keys still apply to this match when storage is unavailable.
          }
          handleCloseMenus();
        }}
        keyBindings={keyBindings}
        numOfPlayers={String(numOfPlayers)}
      />
    </GameBackground>
  );
};
