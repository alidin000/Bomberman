import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography } from '@mui/material';
import {
  InstructionsBackground,
  StyledDialog,
  StyledDialogTitle,
  StyledDialogContent,
  DialogActions,
  BackButton,
} from './InstructionsScreen.styles';

export const InstructionsScreen = () => {
  const navigate = useNavigate();
  const handleClose = () => navigate('/');

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
          <Typography variant="body1">
            Enter a 3D shinobi arena where bombs are character techniques,
            village stages shape the fight, and tailed beasts pressure the board
            with warned hazards.
          </Typography>
          {' '}
          <br />
          <Typography variant="h4">Objective</Typography>
          {' '}
          <br />
          <Typography variant="body1">
            In solo mode, defeat the village boss before it overwhelms the arena.
            In local arena mode, outlast the other shinobi across the chosen
            number of trials.
          </Typography>
          {' '}
          <br />
          <Typography variant="h4">Arena Setup</Typography>
          {' '}
          <br />
          <Typography variant="body1">
            <strong>Villages:</strong>
            {' '}
            Choose Leaf, Sand, Mist, Cloud, Stone, or Hideout stages. Each stage
            uses a different arena layout, palette, boss identity, and hazard theme.
          </Typography>
          <Typography variant="body1">
            <strong>Shinobi:</strong>
            {' '}
            Pick from Deidara, Naruto, Sasuke, Gaara, Minato, and Itachi. Each
            one has a named basic bomb, ultimate, passive style, and blast pattern.
          </Typography>
          <Typography variant="body1">
            <strong>Victory Seals:</strong>
            {' '}
            In local mode, choose how many trial wins are needed to claim the match.
            Solo mode tracks boss rewards and unlocks through story progress.
          </Typography>
          {' '}
          <br />
          <Typography variant="h4">Controls and Movement</Typography>
          {' '}
          <br />
          <Typography variant="body1">
            <strong>Movement:</strong>
            {' '}
            Use your keyboard to move your character up, down, left, or right.
            Read warning seals, bait boss casts, and keep escape paths open.
          </Typography>
          <Typography variant="body1">
            <strong>Bomb Techniques:</strong>
            {' '}
            Place your basic bomb on the current tile. Deidara uses clay spiders,
            Naruto adds clone diagonals, Sasuke pierces with Chidori, Gaara slows
            with sand, Minato marks space, and Itachi delays enemies with crows.
          </Typography>
          <Typography variant="body1">
            <strong>Ultimates:</strong>
            {' '}
            The second action key spends the charged ultimate. These create larger
            signature effects like C3, Rasenshuriken, Kirin, Sand Tsunami, Instant
            Teleport, or Tsukuyomi.
          </Typography>
          {' '}
          <br />
          <Typography variant="h4">Gameplay Elements</Typography>
          {' '}
          <br />
          <Typography variant="body1">
            <strong>Walls and Boxes:</strong>
            {' '}
            Navigate around indestructible walls and destructible boxes.
            Boxes may hide chakra upgrades or arena tools, revealed only when destroyed.
          </Typography>
          <Typography variant="body1">
            <strong>Tailed Beasts and Beasts:</strong>
            {' '}
            Solo bosses move, cast warned abilities, and change pressure by phase.
            Local arena beasts roam as fox, oni, mist, and horned hazards.
          </Typography>
          <Typography variant="body1">
            <strong>Scrolls, Tags, and Charms:</strong>
            {' '}
            Broken boxes can reveal clay storage scrolls, blast formula scrolls,
            body flicker tags, command seals, guard charms, phase seals, and
            earth-style seals.
          </Typography>
          <Typography variant="body1">
            <strong>Hazards:</strong>
            {' '}
            Warning markers appear before boss attacks become active. Step away
            during the warning, then punish after the cast.
          </Typography>
          {' '}
          <br />
          {' '}
          <Typography variant="h4">Advanced Gameplay</Typography>
          {' '}
          <br />
          <Typography variant="body1">
            <strong>Chain Reactions:</strong>
            {' '}
            Bombs can trigger other bombs,
            creating devastating chain reactions. Use this to your advantage,
            setting up traps and strategic strikes.
          </Typography>
          <Typography variant="body1">
            <strong>Boss Control:</strong>
            {' '}
            Sand and illusion bombs delay boss attacks. Lightning and clay hit harder.
            Teleport and clone blasts help reposition and cover unusual angles.
          </Typography>
          <Typography variant="body1">
            <strong>Custom Controls:</strong>
            {' '}
            Configure movement, bomb, and ultimate keys from setup or the settings menu.
            Your last control setup is reused on the next run.
          </Typography>
          {' '}
          <br />
          <Typography variant="h4">End Game</Typography>
          {' '}
          <br />
          <Typography variant="body1">
            A solo trial ends when the boss is defeated or the player is sealed.
            A local match ends when a shinobi reaches the target number of trial wins.
          </Typography>
          {' '}
          <br />
          <Typography variant="h4">Tips for Success</Typography>
          {' '}
          <br />
          <Typography variant="body1">
            <strong>Strategic Bombing:</strong>
            {' '}
            Plan your bomb placements not just to destroy obstacles,
            but to trap opponents, clip boss movement, or force beasts into blast lines.
          </Typography>
          <Typography variant="body1">
            <strong>Watch the HUD:</strong>
            {' '}
            The HUD shows the selected character&apos;s bomb, ultimate, charge, boss
            health, active cast, and danger-zone count.
          </Typography>
          <Typography variant="body1">
            <strong>Adapt and Overcome:</strong>
            {' '}
            Every character has a different blast footprint. Choose the shinobi
            whose bomb shape fits your route through the stage.
          </Typography>
          <Typography variant="body1">
            <strong>Ready, Set, Explode!</strong>
            {' '}
            Master the village map, create space with your signature bomb, and
            time ultimates when the boss or rival shinobi has nowhere to run.
          </Typography>
        </StyledDialogContent>
        <DialogActions>
          <BackButton onClick={handleClose} />
        </DialogActions>
      </StyledDialog>
    </InstructionsBackground>
  );
};
