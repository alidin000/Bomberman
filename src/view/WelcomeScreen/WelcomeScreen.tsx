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
  ActionButtons,
  HeroSubtitle,
  HeroCopy,
  HeroBadge,
  HeroScene,
  HeroMeta,
} from './WelcomeScreen.styles';
import StageAtlas from '../../assets/ninja-bomber-stage-atlas.png';

export const WelcomeScreen = () => {
  const navigate = useNavigate();

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
      </HeroSection>
    </WelcomeContainer>
  );
};
