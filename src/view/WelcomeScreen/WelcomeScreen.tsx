import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Typography,
} from '@mui/material';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  WelcomeContainer,
  HeroSection,
  ActionButtons,
  HeroSubtitle,
  HeroCopy,
  HeroBadge,
  HeroScene,
  HeroMeta,
  QuickPlayPanel,
  QuickPlaySummary,
} from './WelcomeScreen.styles';
import StageAtlas from '../../assets/ninja-bomber-stage-atlas.webp';
import { loadStoryProgress } from '../../story/progress';
import {
  getQuickPlayPlan,
  launchGame,
  loadStoredKeyBindings,
} from '../ConfigScreen/launchGame';
import { moveFocusWithArrows } from '../ConfigScreen/menuNavigation';

export const WelcomeScreen = () => {
  const navigate = useNavigate();
  const storyProgress = useMemo(() => loadStoryProgress(), []);
  const quickPlay = useMemo(() => getQuickPlayPlan(storyProgress), [storyProgress]);
  const [launching, setLaunching] = useState(false);

  const handleQuickPlay = async () => {
    if (launching) return;
    setLaunching(true);
    try {
      await launchGame({
        ...quickPlay,
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
        <HeroScene image={StageAtlas} role="img" aria-label="Hidden Leaf arena" />
        <HeroCopy>
          <HeroBadge>Shinobi Trial 01</HeroBadge>
          <Typography variant="h2" component="h1" gutterBottom fontWeight={900}>
            Explosive Shinobi Arena
          </Typography>
          <HeroSubtitle variant="h6">
            Clear the village. Outsmart the beasts. Survive your own blast.
          </HeroSubtitle>
          <HeroMeta>Solo campaign · Local battle · Seven villages</HeroMeta>
          {/* Arrow keys move between the menu buttons, as in the Mission Deck. */}
          <QuickPlayPanel onKeyDown={moveFocusWithArrows}>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={handleQuickPlay}
              disabled={launching}
              disableFocusRipple
              aria-describedby="quick-play-summary"
              // The main action is focused on arrival so Enter starts a match.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            >
              Quick Play
            </Button>
            <QuickPlaySummary id="quick-play-summary">{quickPlay.summary}</QuickPlaySummary>
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
          </QuickPlayPanel>
        </HeroCopy>
      </HeroSection>
    </WelcomeContainer>
  );
};
