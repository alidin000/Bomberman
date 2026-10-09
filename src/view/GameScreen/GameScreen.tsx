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
import SkipNextIcon from '@mui/icons-material/SkipNext';
import TouchAppIcon from '@mui/icons-material/TouchApp';
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
import { PauseMissionDetails } from './GameHUD';
import { MatchAnnouncer, MatchHud, MatchScene } from './MatchLeaves';
import { selectMatchView } from './matchView';
import { useGameEngineStore } from '../../hooks/useGameEngine';
import { EngineStore, useEngineSelector } from '../../hooks/engineStore';
import { GameConfig, GameEngineState, loadMapFromStorage } from '../../engine';
import {
  DEFAULT_CHARACTER_ID, DEFAULT_STAGE_ID, GameMode, getCharacterDefinition,
} from '../../content';
import {
  LastMissionReport,
  completeCampaignStage,
  recordCampaignDiscoveries,
} from '../../story/progress';
import { settleCampaignMission } from '../../story/hubEconomy';
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
} from './GameScreen.styles';
import {
  applyDocumentPreferences,
  loadGamePreferences,
  saveGamePreferences,
} from './gamePreferences';
import { useEngineFeedback } from './useGameFeedback';
import { playerSlotColor, playerSlotLabel, playerSlotTextColor } from './playerSlots';
import { loadCampaignDifficulty } from '../ConfigScreen/campaignDifficulty';
import { isCpuSlot, normalizeControllers } from '../../ai/controllers';
import { usePadGameSurface } from '../../input/MenuPad';
import { PAD_START_EVENT } from '../../input/padNavigator';
import { getPlayerBindings } from '../../input/humanController';
import { useTouchMode } from '../../input/touchMode';
import { useTouchPreferences } from '../../input/touchPreferences';
import { useScreenWakeLock } from '../../input/touchWakeLock';
import { TouchControls, TouchGuide } from './TouchControls';
import {
  isVersus, lastRoundWinnerSlot, matchWinnerSlot, roundOverBanner,
} from './matchCopy';
import { clearDeployedConsumables } from '../ConfigScreen/launchGame';
import { getHubReturn, getMissionSettlement, hubPath } from '../HubScreen/missionSettlement';

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

// The arena holds on the deciding moment (the engine already froze it) this
// long before the result dialog covers it.
export const RESULT_HOLD_MS = 1200;

type GameTopControlsProps = {
  isPaused: boolean;
  /** Touch controls are up: the guide button shows the touch guide. */
  touch: boolean;
  /** A menu is up: the bar is inert, so only that menu takes input. */
  locked: boolean;
  showHud: boolean;
  onPauseToggle: () => void;
  onOpenSettings: () => void;
  onShowControls: () => void;
  onToggleHud: () => void;
};

// Memoised so the tooltips and icon buttons do not re-render with the rest
// of the screen. An open MUI Tooltip rebuilds its popper.js instance on each
// render (its default PopperProps object is new every time), which forces a
// style recalc and layout per render while the pointer rests on a button.
// Restart is not here: it wipes the match, so it lives behind the pause
// menu's confirm instead of one stray click away from Pause.
const GameTopControls = React.memo(({
  isPaused,
  touch,
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
          {touch ? <TouchAppIcon /> : <KeyboardIcon />}
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
// breakdown) whenever the screen did. Skip parent re-renders while they stay
// closed; opening one always re-renders it with fresh props.
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

export type MatchOverlayProps = {
  store: EngineStore;
  keyBindings: KeyBindings;
  hudScale: number;
  showHud: boolean;
};

export type MatchResultProps = {
  /** After the hold on the deciding moment, like the round result dialog. */
  open: boolean;
  state: GameEngineState;
  restart: () => void;
};

/**
 * A match its caller sets up (the Training Dojo) instead of the route and
 * the stored setup, with the parts of the screen it replaces. Keep the
 * object stable: a new config starts a new match.
 */
export type GameScreenMatch = {
  config: GameConfig;
  /** Where Quit Game leaves to. */
  exitTo: string;
  /** More pause-menu buttons, after Restart. */
  pauseActions?: readonly { label: string; onSelect: () => void }[];
  /** Drawn over the arena, beside the HUD. */
  renderOverlay?: (props: MatchOverlayProps) => React.ReactNode;
  /** Shown in place of the round result dialog; it also takes Start. */
  renderResult?: (props: MatchResultProps) => React.ReactNode;
};

type GameScreenProps = {
  // eslint-disable-next-line react/require-default-props -- absent for routed matches
  match?: GameScreenMatch;
};

export const GameScreen = ({ match }: GameScreenProps = {}) => {
  const { numOfPlayers, numOfRounds, selectedMap } = useParams();
  const navigate = useNavigate();
  const [keyBindings, setKeyBindings] = useState<KeyBindings>(loadStoredKeyBindings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModifyingControls, setIsModifyingControls] = useState(false);
  // A caller's match teaches its own controls (the dojo prompts them).
  const [showControlsGuide, setShowControlsGuide] = useState(
    () => !match && !hasSeenControlsGuide()
  );
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

  const matchConfig = match?.config;
  const config = useMemo<GameConfig | null>(() => {
    if (matchConfig) return matchConfig;
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
      // The hub pack and upgrades this campaign mission deployed with.
      loadout: mode === 'solo' ? setup.loadout : undefined,
    };
  }, [matchConfig, numOfPlayers, numOfRounds, selectedMap]);

  // The pack is spent on this mission: a reload must not bring it back.
  useEffect(() => {
    clearDeployedConsumables();
  }, []);

  const {
    store,
    motion,
    getState,
    advanceFrame,
    pause,
    resume,
    restart,
    dismissDialog,
  } = useGameEngineStore(config, keyBindings);
  // Only what changes with menus, pauses and round ends: the HUD, the
  // countdown and the scene subscribe to their own slices (MatchLeaves).
  const view = useEngineSelector(store, selectMatchView);
  const { menuState } = view;
  const feedback = useEngineFeedback(store, preferences);
  // A phone is one player: the touch controls play the first human seat.
  const touchMode = useTouchMode();
  const { leftHanded } = useTouchPreferences();
  const touchSlot = useMemo(() => {
    if (!config) return null;
    for (let slot = 0; slot < config.numPlayers; slot += 1) {
      if (!isCpuSlot(config, slot)) return slot;
    }
    return null;
  }, [config]);
  const touchKeys = touchSlot === null ? undefined : getPlayerBindings(keyBindings, touchSlot);

  // High contrast and reduced motion reach the page as well as the canvas.
  useEffect(() => {
    applyDocumentPreferences(preferences);
  }, [preferences]);

  const handlePreferencesChange = useCallback((nextPreferences: typeof preferences) => {
    setPreferences(nextPreferences);
    saveGamePreferences(nextPreferences);
  }, []);

  const rewardedStages = useRef<Set<string>>(new Set());

  // A sealed boss ends the match, so the game-over state is the menu state.
  useEffect(() => {
    const ended = menuState;
    if (
      ended
      && ended.config.mode === 'solo'
      && ended.phase === 'game_over'
      && ended.boss
      && ended.config.stageId
      && ended.boss.health <= 0
    ) {
      const { stageId } = ended.config;
      const bossId = ended.boss.id;
      const rewardKey = `${stageId}:${bossId}`;
      if (!rewardedStages.current.has(rewardKey)) {
        rewardedStages.current.add(rewardKey);
        completeCampaignStage(stageId, bossId);
      }
    }
  }, [menuState]);

  // A finished campaign mission pays out once (win or loss), and its result
  // offers the way back to the village hub.
  const [missionReport, setMissionReport] = useState<LastMissionReport | null>(null);
  useEffect(() => {
    const settlement = menuState ? getMissionSettlement(menuState) : null;
    if (!settlement) {
      setMissionReport(null);
      return;
    }
    setMissionReport(settleCampaignMission(settlement).report);
    // The hub is the next screen: fetch its chunk while the result shows.
    import('../HubScreen/HubScreen').catch(() => undefined);
  }, [menuState]);
  const hubReturn = useMemo(() => (menuState ? getHubReturn(menuState) : null), [menuState]);
  const goToHub = useMemo(() => (
    hubReturn ? () => navigate(hubPath(hubReturn.stageId)) : undefined
  ), [hubReturn, navigate]);

  const { discoveries } = view;
  useEffect(() => {
    if (discoveries && discoveries.secrets.length > 0) {
      recordCampaignDiscoveries(
        discoveries.stageId,
        discoveries.leadCharacterId,
        [...discoveries.secrets]
      );
    }
  }, [discoveries]);

  const isPaused = view.paused;
  // The round is over (and the engine paused) from the deciding tick; the
  // result dialog itself opens RESULT_HOLD_MS later.
  const dialogOpen = view.phase === 'round_end' || view.phase === 'game_over';
  const roundOverKey = menuState && dialogOpen
    ? `${menuState.phase}:${menuState.round}:${menuState.roundWinners.length}:${menuState.tick}`
    : '';
  const [heldRoundOverKey, setHeldRoundOverKey] = useState('');
  useEffect(() => {
    // Back in play: forget the last hold, so a later round end with the same
    // key (a rematch decided on the same tick) is held again.
    if (!roundOverKey) {
      setHeldRoundOverKey('');
      return undefined;
    }
    const timer = window.setTimeout(() => setHeldRoundOverKey(roundOverKey), RESULT_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [roundOverKey]);
  const resultVisible = dialogOpen && heldRoundOverKey === roundOverKey;
  const resultTone = useMemo<ResultTone>(() => {
    if (!menuState || menuState.phase !== 'game_over' || menuState.config.mode !== 'solo') {
      return 'neutral';
    }
    const bossSealed = menuState.boss ? menuState.boss.health <= 0 : false;
    if (bossSealed || menuState.campaign?.missionResult === 'success') {
      return 'victory';
    }
    return 'defeat';
  }, [menuState]);
  const parsedPlayerCount = Number(numOfPlayers ?? 1);
  const activePlayerCount = Number.isFinite(parsedPlayerCount)
    ? Math.max(1, parsedPlayerCount)
    : 1;
  const { characterIds } = view;
  // The match's own roster when it is loaded; the route's count before that.
  // CPU slots take no keys, so they get no row.
  const controlRows = useMemo<ControlsRow[]>(() => (
    Array.from({ length: characterIds.length || activePlayerCount }, (_, index) => {
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
    }).filter((row) => !isCpuSlot(config, row.slot))
  ), [activePlayerCount, characterIds, keyBindings, config]);
  // The static kit text the old HUD cards carried, kept for the pause menu.
  const playerKits = useMemo(() => (
    characterIds.map((characterId, index) => {
      const character = getCharacterDefinition(characterId);
      return {
        slot: index,
        name: character.name,
        title: character.title,
        detail: `Bomb: ${character.basicBomb} · Ult: ${character.ultimate} · Vision ${character.visionRadius}`,
      };
    })
  ), [characterIds]);

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

  const exitTo = match?.exitTo ?? '/';
  const handleQuitGame = useCallback(() => {
    navigate(exitTo);
  }, [exitTo, navigate]);

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
  const padMenuActive = !view.loaded
    || view.phase !== 'playing'
    || isPaused
    || showControlsGuide
    || isSettingsOpen
    || isModifyingControls
    || pendingConfirm !== null;
  usePadGameSurface(padMenuActive);
  // The screen stays on while a round is in play (the engine pauses at a round end).
  useScreenWakeLock(view.loaded && view.phase === 'playing' && !isPaused);

  // Start on the round result continues, like its focused main button. It
  // waits for the dialog itself (not the hold before it) and, like a click,
  // ignores the first RESULT_INPUT_LOCK_MS so a mashed button skips nothing.
  const isGameOver = view.phase === 'game_over';
  const customResult = !!match?.renderResult;
  useEffect(() => {
    if (!dialogOpen || customResult) return undefined;
    const shownAt = resultVisible ? Date.now() : null;
    const handlePadStart = (event: Event) => {
      event.preventDefault();
      if (shownAt === null || Date.now() - shownAt < RESULT_INPUT_LOCK_MS) return;
      // A won mission's main button heads on to the village hub.
      if (isGameOver && resultTone === 'victory' && goToHub) goToHub();
      else if (isGameOver) restart();
      else dismissDialog();
    };
    window.addEventListener(PAD_START_EVENT, handlePadStart);
    return () => window.removeEventListener(PAD_START_EVENT, handlePadStart);
  }, [customResult, dialogOpen, resultVisible, dismissDialog, isGameOver, restart, resultTone, goToHub]);

  // The banner over the deciding moment, until the result dialog covers it.
  const roundOver = useMemo(() => {
    if (!menuState || !dialogOpen || resultVisible) return null;
    let winner: number | null = null;
    if (isVersus(menuState)) {
      winner = menuState.phase === 'game_over'
        ? matchWinnerSlot(menuState)
        : lastRoundWinnerSlot(menuState);
    }
    return {
      text: roundOverBanner(menuState),
      accent: winner !== null ? playerSlotColor(winner) : 'var(--anime-mustard)',
    };
  }, [dialogOpen, menuState, resultVisible]);

  if (!view.loaded) {
    return (
      <StyledBackground>
        <LoadingMessage>Loading game...</LoadingMessage>
      </StyledBackground>
    );
  }

  return (
    <GameBackground>
      {showHud && <MatchHud store={store} scale={preferences.hudScale} />}
      {match?.renderOverlay?.({
        store, keyBindings, hudScale: preferences.hudScale, showHud,
      })}
      <GameTopControls
        isPaused={isPaused}
        touch={touchMode}
        locked={isPaused && !showControlsGuide}
        showHud={showHud}
        onPauseToggle={showControlsGuide ? handleDismissControlsGuide : handleTogglePause}
        onOpenSettings={handleOpenSettings}
        onShowControls={handleShowControlsGuide}
        onToggleHud={handleToggleHud}
      />
      <GameSceneContainer>
        <MatchScene
          store={store}
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
      <MatchAnnouncer
        store={store}
        caption={feedback.caption}
        eventId={feedback.eventId}
        roundOver={roundOver}
        held={isPaused || dialogOpen}
        hudScale={preferences.hudScale}
        campaign={view.campaign}
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
          {touchMode
            ? <TouchGuide leftHanded={leftHanded} />
            : <ControlsTable rows={controlRows} label="controls" />}
        </ControlsGuide>
      )}
      {isPaused && menuState && !showControlsGuide && !dialogOpen && !isSettingsOpen && !isModifyingControls && (
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
                <span>{touchMode ? 'Tap Resume to play on' : 'Esc or Start resumes'}</span>
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
                {match?.pauseActions?.map((action) => (
                  <PauseMenuButton
                    key={action.label}
                    variant="outlined"
                    startIcon={<SkipNextIcon />}
                    onClick={action.onSelect}
                  >
                    {action.label}
                  </PauseMenuButton>
                ))}
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
              <PauseMissionDetails state={menuState} />
              {touchMode
                ? <TouchGuide leftHanded={leftHanded} />
                : <ControlsTable rows={controlRows} label="controls" />}
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
      {touchMode && touchSlot !== null && touchKeys && (
        <TouchControls
          store={store}
          slot={touchSlot}
          keys={touchKeys}
          enabled={!padMenuActive}
        />
      )}
      <MemoMatchConfirmDialog
        kind={pendingConfirm}
        onCancel={handleCancelConfirm}
        onConfirm={handleConfirm}
      />
      {menuState && match?.renderResult?.({ open: resultVisible, state: menuState, restart })}
      {menuState && !match?.renderResult && (
        // Shown from the state the round ended on, which it keeps while it
        // fades out under the next round.
        <MemoRoundResultDialog
          open={resultVisible}
          onClose={handleCloseDialog}
          onRestart={restart}
          resultMessage={menuState.resultMessage}
          isGameOver={menuState.phase === 'game_over'}
          tone={resultTone}
          state={menuState}
          earnings={missionReport?.earnings}
          hubLabel={hubReturn?.label}
          onVillageHub={goToHub}
        />
      )}
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
