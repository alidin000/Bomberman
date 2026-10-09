/* eslint-disable max-len */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import FocusTrap from '@mui/material/Unstable_TrapFocus';
import { useNavigate, useParams } from 'react-router-dom';
import { StyledBackground } from '../WelcomeScreen/WelcomeScreen.styles';
import {
  KeyBindings,
  DEFAULT_KEY_BINDINGS,
  arrowKeySymbols,
  normalizeKeyBindings,
} from '../../constants/props';
import { RESULT_INPUT_LOCK_MS, RoundResultDialog } from './RoundResultDialog';
import { ResultTone } from './RoundResultDialog.styles';
import SettingsScreen from './SettingsScreen/SettingsScreen';
import ModifyControlsDialog from './SettingsScreen/ModifyControlsDialog';
import { MatchConfirmDialog, MatchConfirmKind } from './SettingsScreen/MatchConfirmDialog';
import { GameScene3D } from './GameScene3D';
import { GameHUD, PauseMissionDetails } from './GameHUD';
import { MatchBeatOverlay } from './MatchBeatOverlay';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useHudState, useRenderState, useSceneState } from '../../hooks/useRenderState';
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
  FeedbackCaption,
  CaptionLiveRegion,
} from './GameScreen.styles';
import {
  applyDocumentPreferences,
  loadGamePreferences,
  saveGamePreferences,
} from './gamePreferences';
import { useGameFeedback } from './useGameFeedback';
import { playerSlotColor, playerSlotLabel, playerSlotTextColor } from './playerSlots';
import { loadCampaignDifficulty } from '../ConfigScreen/campaignDifficulty';
import { isCpuSlot, normalizeControllers } from '../../ai/controllers';
import { usePadGameSurface } from '../../input/MenuPad';
import { PAD_START_EVENT } from '../../input/padNavigator';
import {
  isVersus, lastRoundWinnerSlot, matchWinnerSlot, roundOverBanner, roundStartLine,
} from './matchCopy';

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

// The arena holds on the deciding moment (the engine already froze it) this
// long before the result dialog covers it.
export const RESULT_HOLD_MS = 1200;

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
  /** A menu is up: the bar is inert, so only that menu takes input. */
  locked: boolean;
  showHud: boolean;
  onPauseToggle: () => void;
  onOpenSettings: () => void;
  onShowControls: () => void;
  onToggleHud: () => void;
};

// Memoised so the tooltips and icon buttons do not re-render on every
// engine tick. An open MUI Tooltip rebuilds its popper.js instance on each
// render (its default PopperProps object is new every time), which forces a
// style recalc and layout per tick while the pointer rests on a button.
// Restart is not here: it wipes the match, so it lives behind the pause
// menu's confirm instead of one stray click away from Pause.
const GameTopControls = React.memo(({
  isPaused,
  locked,
  showHud,
  onPauseToggle,
  onOpenSettings,
  onShowControls,
  onToggleHud,
}: GameTopControlsProps) => {
  const barRef = useRef<HTMLDivElement>(null);
  // React 18 has no `inert` prop; the attribute is what browsers honour.
  useLayoutEffect(() => {
    barRef.current?.toggleAttribute('inert', locked);
  }, [locked]);
  return (
    <TopControls ref={barRef}>
      <Tooltip title={isPaused ? 'Resume' : 'Pause'}>
        <ControlButton
          aria-label={isPaused ? 'resume game' : 'pause game'}
          onClick={onPauseToggle}
        >
          {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
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
  );
});
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
const MemoMatchConfirmDialog = React.memo(
  MatchConfirmDialog,
  (prev, next) => prev.kind === null && next.kind === null
);
// Fed shared states (see useRenderState) that keep their identity until
// something each one draws changes, so a held-movement frame or a tick that
// only moves clocks skips the HUD and the whole 3D scene; the scene animates
// those itself from the motion store and the live state.
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
  // Restart or quit waiting for "Leave Match" / "Restart Match". The ref
  // tells the pause menu's focus trap, during the same commit, to let focus
  // go to the confirm dialog stacked on top of it.
  const [pendingConfirm, setPendingConfirm] = useState<MatchConfirmKind | null>(null);
  const confirmOpen = useRef(false);

  const config = useMemo<GameConfig | null>(() => {
    if (!numOfPlayers || !numOfRounds || !selectedMap) return null;
    const setup = loadStoredGameSetup();
    const players = parseInt(numOfPlayers, 10);
    const mode = (setup.mode as GameMode | undefined) ?? 'local';
    return {
      mode,
      numPlayers: players,
      totalRounds: parseInt(numOfRounds, 10),
      selectedMap,
      map: loadMapFromStorage(),
      stageId: setup.stageId ?? DEFAULT_STAGE_ID,
      selectedCharacters: setup.selectedCharacters
        ?? Array.from({ length: players }, () => DEFAULT_CHARACTER_ID),
      selectedUpgrade: setup.selectedUpgrade,
      difficulty: loadCampaignDifficulty(),
      controllers: mode === 'local' ? normalizeControllers(setup.controllers, players) : undefined,
    };
  }, [numOfPlayers, numOfRounds, selectedMap]);

  const {
    state,
    motion,
    getState,
    advanceFrame,
    pause,
    resume,
    restart,
    dismissDialog,
  } = useGameEngine(config, keyBindings);
  const renderState = useRenderState(state);
  const sceneState = useSceneState(state, motion);
  const hudState = useHudState(state);
  const feedback = useGameFeedback(renderState, preferences);

  // High contrast and reduced motion reach the page as well as the canvas.
  useEffect(() => {
    applyDocumentPreferences(preferences);
  }, [preferences]);

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
  // The round is over (and the engine paused) from the deciding tick; the
  // result dialog itself opens RESULT_HOLD_MS later.
  const dialogOpen = state?.phase === 'round_end' || state?.phase === 'game_over';
  const roundOverKey = state && dialogOpen
    ? `${state.phase}:${state.round}:${state.roundWinners.length}:${state.tick}`
    : '';
  const [heldRoundOverKey, setHeldRoundOverKey] = useState('');
  useEffect(() => {
    if (!roundOverKey) return undefined;
    const timer = window.setTimeout(() => setHeldRoundOverKey(roundOverKey), RESULT_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [roundOverKey]);
  const resultVisible = dialogOpen && heldRoundOverKey === roundOverKey;
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
    // CPU slots take no keys, so they get no row.
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
    }).filter((row) => !isCpuSlot(config, row.slot));
  }, [activePlayerCount, characterIdsKey, keyBindings, config]);
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

  const requestConfirm = useCallback((kind: MatchConfirmKind) => {
    confirmOpen.current = true;
    setPendingConfirm(kind);
  }, []);

  const handleCancelConfirm = useCallback(() => {
    confirmOpen.current = false;
    setPendingConfirm(null);
  }, []);

  const handleConfirm = useCallback((kind: MatchConfirmKind) => {
    handleCancelConfirm();
    if (kind === 'quit') handleQuitGame();
    else restart();
  }, [handleCancelConfirm, handleQuitGame, restart]);

  const pauseTrapEnabled = useCallback(() => !confirmOpen.current, []);

  const handleCloseDialog = () => {
    dismissDialog();
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // A held Escape repeats: one press closes Settings back to the pause
      // menu, and the repeats must not then resume live play.
      if (event.repeat) return;
      if (dialogOpen) return;
      event.preventDefault();

      if (pendingConfirm) {
        handleCancelConfirm();
        return;
      }

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
    handleCancelConfirm,
    handleCloseMenus,
    handleTogglePause,
    handleDismissControlsGuide,
    isModifyingControls,
    isSettingsOpen,
    pendingConfirm,
    showControlsGuide,
  ]);

  // Pads steer menus whenever no round is live, and play it otherwise.
  const padMenuActive = !state
    || state.phase !== 'playing'
    || isPaused
    || showControlsGuide
    || isSettingsOpen
    || isModifyingControls
    || pendingConfirm !== null;
  usePadGameSurface(padMenuActive);

  // Start on the round result continues, like its focused main button. It
  // waits for the dialog itself (not the hold before it) and, like a click,
  // ignores the first RESULT_INPUT_LOCK_MS so a mashed button skips nothing.
  const isGameOver = state?.phase === 'game_over';
  useEffect(() => {
    if (!dialogOpen) return undefined;
    const shownAt = resultVisible ? Date.now() : null;
    const handlePadStart = (event: Event) => {
      event.preventDefault();
      if (shownAt === null || Date.now() - shownAt < RESULT_INPUT_LOCK_MS) return;
      if (isGameOver) restart();
      else dismissDialog();
    };
    window.addEventListener(PAD_START_EVENT, handlePadStart);
    return () => window.removeEventListener(PAD_START_EVENT, handlePadStart);
  }, [dialogOpen, resultVisible, dismissDialog, isGameOver, restart]);

  // The countdown overlay is visual only; the live region reads the round
  // line with the first number, then "2, 1, Go!" (nothing else happens while
  // the arena is frozen), then captions.
  const countdownVisible = !!roundStart.countdown && !isPaused && !dialogOpen;
  const goVisible = roundStart.go && !isPaused && !dialogOpen;
  const roundLine = countdownVisible && state ? roundStartLine(state) : '';
  const roundOver = useMemo(() => {
    if (!state || !dialogOpen || resultVisible) return null;
    let winner: number | null = null;
    if (isVersus(state)) {
      winner = state.phase === 'game_over' ? matchWinnerSlot(state) : lastRoundWinnerSlot(state);
    }
    return {
      text: roundOverBanner(state),
      accent: winner !== null ? playerSlotColor(winner) : 'var(--anime-mustard)',
    };
  }, [dialogOpen, resultVisible, state]);
  let liveAnnouncement = feedback.caption;
  if (countdownVisible) {
    liveAnnouncement = roundStart.countdown === '3' && roundLine
      ? `${roundLine}. 3`
      : roundStart.countdown;
  } else if (goVisible) liveAnnouncement = 'Go!';
  else if (roundOver) {
    // The knockout that decided it, then who took the round.
    liveAnnouncement = feedback.caption ? `${feedback.caption}. ${roundOver.text}` : roundOver.text;
  }

  if (!state || !renderState || !sceneState || !hudState) {
    return (
      <StyledBackground>
        <LoadingMessage>Loading game...</LoadingMessage>
      </StyledBackground>
    );
  }

  return (
    <GameBackground>
      {showHud && <MemoGameHUD state={hudState} scale={preferences.hudScale} />}
      <GameTopControls
        isPaused={isPaused}
        locked={isPaused && !showControlsGuide}
        showHud={showHud}
        onPauseToggle={showControlsGuide ? handleDismissControlsGuide : handleTogglePause}
        onOpenSettings={handleOpenSettings}
        onShowControls={handleShowControlsGuide}
        onToggleHud={handleToggleHud}
      />
      <GameSceneContainer>
        <MemoGameScene3D
          state={sceneState}
          preferences={preferences}
          impact={feedback.impact}
          motion={motion}
          advanceFrame={advanceFrame}
          liveState={getState}
          // A round end also sets `paused`, but the hold before the result
          // still draws (the deciding blast and the KO pose play out); the
          // scene idles under a real pause or once the dialog covers it.
          idle={(isPaused && !dialogOpen) || resultVisible}
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
      <MatchBeatOverlay
        countdown={countdownVisible ? roundStart.countdown : ''}
        go={goVisible}
        line={roundLine}
        roundOver={roundOver}
        hudScale={preferences.hudScale}
        campaign={!!state.campaign}
      />
      {showControlsGuide && !dialogOpen && !isSettingsOpen && !isModifyingControls && (
        <ControlsGuide aria-label="controls guide" data-pad-layer="">
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
        // Tab stays inside the menu; pads treat it as their menu.
        <FocusTrap open disableRestoreFocus isEnabled={pauseTrapEnabled}>
          <PauseOverlay
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-menu-title"
            tabIndex={-1}
            data-pad-layer=""
          >
            <PauseMenuCard>
              <PauseMenuTitle id="pause-menu-title">
                <strong>Paused</strong>
                <span>Esc or Start resumes</span>
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
                  onClick={() => requestConfirm('restart')}
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
                  onClick={() => requestConfirm('quit')}
                >
                  Quit Game
                </PauseMenuButton>
              </PauseMenuActions>
              <PauseMissionDetails state={state} />
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
        </FocusTrap>
      )}
      <MemoMatchConfirmDialog
        kind={pendingConfirm}
        onCancel={handleCancelConfirm}
        onConfirm={handleConfirm}
      />
      <MemoRoundResultDialog
        open={resultVisible}
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
