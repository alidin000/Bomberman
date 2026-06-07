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
  PanelText,
  ShowcaseArt,
  HeroCopy,
  HeroBadge,
  FeatureGrid,
  FeatureCard,
} from './WelcomeScreen.styles';
import ShowcaseReference from '../../assets/ninja-bomber-showcase.png';

export const WelcomeScreen = () => {
  const navigate = useNavigate();

  return (
    <WelcomeContainer>
      <HeroSection>
        <HeroCopy>
          <HeroBadge>3D Story Boss Arena</HeroBadge>
          <Typography variant="h2" component="h1" gutterBottom fontWeight={900}>
            Explosive Shinobi Arena
          </Typography>
          <HeroSubtitle variant="h6">
            Pick a named shinobi loadout, plant character-specific bombs,
            and break tailed-beast pressure inside village arenas.
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
        <ShowcaseArt src={ShowcaseReference} alt="Shinobi arena roster and stage showcase" />
      </HeroSection>
      <ActionPanel>
        <ActionCard elevation={6}>
          <PanelText variant="subtitle1">
            Current build focus: solo boss trials, local arena battles, unlockable story progress,
            and a network-ready engine for future online rooms.
          </PanelText>
          <FeatureGrid>
            <FeatureCard>
              <strong>Character Bombs</strong>
              Deidara clay, Naruto clone bursts, Sasuke lightning, Gaara sand,
              Minato marks, and Itachi illusions.
            </FeatureCard>
            <FeatureCard>
              <strong>Village Arenas</strong>
              Leaf, Sand, Mist, Cloud, Stone, and Hideout stages with unique bosses.
            </FeatureCard>
            <FeatureCard>
              <strong>Boss Pressure</strong>
              Tailed beasts move, warn attacks, cast hazards, and react to special bombs.
            </FeatureCard>
          </FeatureGrid>
        </ActionCard>
      </ActionPanel>
    </WelcomeContainer>
  );
};
