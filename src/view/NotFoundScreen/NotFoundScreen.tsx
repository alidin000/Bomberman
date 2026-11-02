import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import { WelcomeContainer } from '../WelcomeScreen/WelcomeScreen.styles';
import { MAIN_MENU_LABEL } from '../ConfigScreen/menuCopy';
import {
  NotFoundCard, NotFoundEyebrow, NotFoundKanji, NotFoundLine, NotFoundPath,
} from './NotFoundScreen.styles';

/**
 * Any path no route matches. The static host serves the app for every URL,
 * so without this screen a mistyped link drew a blank page. The one button
 * goes back to the title screen and has focus on arrival, so Enter, a pad's
 * A or a tap takes it; Escape (a pad's B) goes back too.
 */
export const NotFoundScreen = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const previous = document.title;
    document.title = `Page not found · ${previous}`;
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    const backOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) navigate('/');
    };
    window.addEventListener('keydown', backOnEscape);
    return () => window.removeEventListener('keydown', backOnEscape);
  }, [navigate]);

  return (
    <WelcomeContainer>
      <NotFoundCard aria-labelledby="not-found-title">
        <NotFoundKanji aria-hidden="true">道</NotFoundKanji>
        <NotFoundEyebrow>Error 404</NotFoundEyebrow>
        <h1 id="not-found-title">Page not found</h1>
        <NotFoundLine>
          There is no page at
          {' '}
          <NotFoundPath>{pathname}</NotFoundPath>
          . Go back to the title screen to pick a mode.
        </NotFoundLine>
        <Button
          variant="contained"
          size="large"
          startIcon={<HomeIcon />}
          onClick={() => navigate('/')}
          disableFocusRipple
          // The way back is focused on arrival, so one press leaves.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        >
          {MAIN_MENU_LABEL}
        </Button>
      </NotFoundCard>
    </WelcomeContainer>
  );
};
