import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Typography,
} from '@mui/material';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import {
  WelcomeContainer,
  HeroSection,
  ActionButtons,
  HeroSubtitle,
  HeroCopy,
  HeroScene,
  HeroMeta,
  QuickPlayPanel,
  QuickPlayDoors,
  QuickPlaySummary,
} from './WelcomeScreen.styles';
import { loadStoryProgress } from '../../story/progress';
import {
  QuickPlayPlan,
  getCpuBattlePlan,
  getQuickPlayPlan,
  launchGame,
  loadStoredKeyBindings,
} from '../ConfigScreen/launchGame';
import { moveFocusWithArrows } from '../ConfigScreen/menuNavigation';
import { DojoSuggestion } from '../DojoScreen/DojoSuggestion';
import { useTouchMode } from '../../input/touchMode';
import { useTouchPreferences } from '../../input/touchPreferences';

type Door = {
  id: 'quick' | 'cpu';
  label: string;
  icon: React.ReactNode;
  plan: QuickPlayPlan;
};

export const WelcomeScreen = () => {
  const navigate = useNavigate();
  const storyProgress = useMemo(() => loadStoryProgress(), []);
  const quickPlay = useMemo(() => getQuickPlayPlan(storyProgress), [storyProgress]);
  const cpuBattle = useMemo(() => getCpuBattlePlan(storyProgress), [storyProgress]);
  const [launching, setLaunching] = useState(false);
  // A phone is one player, so on a touch screen the CPU battle is the
  // first door (focused, and the one the summary describes).
  const touch = useTouchMode();
  const { leftHanded } = useTouchPreferences();
  const quickDoor: Door = {
    id: 'quick', label: 'Quick Play', icon: <PlayArrowIcon />, plan: quickPlay,
  };
  const cpuDoor: Door = {
    id: 'cpu', label: 'Battle a CPU', icon: <SmartToyOutlinedIcon />, plan: cpuBattle,
  };
  const [primary, secondary] = touch ? [cpuDoor, quickDoor] : [quickDoor, cpuDoor];

  // Both doors start a match straight away, the same way the Mission Deck does.
  const launch = async (plan: QuickPlayPlan) => {
    if (launching) return;
    setLaunching(true);
    try {
      await launchGame({
        ...plan,
        keyBindings: loadStoredKeyBindings(),
        storyProgress,
      }, navigate);
    } catch {
      setLaunching(false);
    }
  };

  return (
    <WelcomeContainer>
      <HeroSection>
        <HeroScene role="img" aria-label="Hidden Leaf arena" />
        <HeroCopy>
          <Typography variant="h2" component="h1" gutterBottom fontWeight={900}>
            Explosive Shinobi Arena
          </Typography>
          <HeroSubtitle variant="h6">
            Clear the village. Outsmart the beasts. Survive your own blast.
          </HeroSubtitle>
          <HeroMeta>Solo campaign · Local battle · Seven villages</HeroMeta>
          {/* Arrow keys move between the menu buttons, as in the Mission Deck. */}
          <QuickPlayPanel onKeyDown={moveFocusWithArrows}>
            {/* Two doors: the last setup again, or straight into a fight with a CPU. */}
            <QuickPlayDoors>
              <Button
                key={primary.id}
                variant="contained"
                size="large"
                startIcon={primary.icon}
                onClick={() => launch(primary.plan)}
                disabled={launching}
                disableFocusRipple
                aria-describedby="quick-play-summary"
                // The main action is focused on arrival so Enter starts a match.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              >
                {primary.label}
              </Button>
              <Button
                key={secondary.id}
                variant="outlined"
                size="large"
                startIcon={secondary.icon}
                onClick={() => launch(secondary.plan)}
                disabled={launching}
                disableFocusRipple
                title={secondary.plan.summary}
              >
                {secondary.label}
              </Button>
            </QuickPlayDoors>
            <QuickPlaySummary id="quick-play-summary">{primary.plan.summary}</QuickPlaySummary>
            {touch && (
              <QuickPlaySummary>
                {`Touch controls: slide a thumb low on the ${leftHanded ? 'right' : 'left'} to move, `
                  + `tap Bomb on the ${leftHanded ? 'left' : 'right'}.`}
              </QuickPlaySummary>
            )}
            <ActionButtons>
              <Button
                variant="outlined"
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
            {/* First visit only, below the doors: never in the way of Quick Play. */}
            <DojoSuggestion onOpen={() => navigate('/dojo')} />
          </QuickPlayPanel>
        </HeroCopy>
      </HeroSection>
    </WelcomeContainer>
  );
};
