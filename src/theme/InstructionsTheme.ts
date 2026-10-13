import { createTheme } from '@mui/material/styles';

// The menus' MUI theme: scroll paper, ink keylines, ninja-orange actions and
// a heavy comic display face for titles and buttons (index.css holds the
// colour tokens and the @font-face rules).
const DISPLAY = '"Bangers", Impact, "Arial Narrow Bold", "Arial Black", sans-serif';
const BODY = '"Trebuchet MS", "Arial Narrow", Arial, sans-serif';
const display = { fontFamily: DISPLAY, fontWeight: 400, letterSpacing: '0.04em' };

const theme = createTheme({
  palette: {
    mode: 'light',
    // Ninja orange carries ink text (7.2:1), never light text.
    primary: {
      main: '#f5821f',
      light: '#ff9a3c',
      dark: '#e06a0c',
      contrastText: '#17120f',
    },
    // The deep accent (paper-light text 6.3:1, 5.1:1 as text on paper).
    secondary: {
      main: '#a4400a',
      light: '#c4520e',
      dark: '#82320a',
      contrastText: '#fff8e7',
    },
    // Destructive actions (Quit, Leave, Restart in a confirm): vermilion,
    // 7.6:1 under paper-light text and 5.9:1 as text on paper.
    warning: {
      main: '#93201a',
      light: '#b8281d',
      dark: '#741812',
      contrastText: '#fff8e7',
    },
    background: {
      default: '#120d0b',
      paper: '#f2e4c4',
    },
    text: {
      primary: '#17120f',
      secondary: '#574c40',
    },
  },
  typography: {
    fontFamily: BODY,
    h1: display,
    h2: display,
    h3: display,
    h4: display,
    h5: display,
    h6: {
      fontWeight: 600,
    },
    button: {
      fontFamily: DISPLAY,
      textTransform: 'uppercase',
      fontWeight: 400,
      letterSpacing: '0.06em',
    },
  },
  shape: {
    borderRadius: 3,
  },
  components: {
    // State colours must read at 3:1 on paper: the deep accent, not the
    // bright orange (2.2:1), marks a switch, box, radio, slider or bar.
    MuiSwitch: { defaultProps: { color: 'secondary' } },
    MuiCheckbox: { defaultProps: { color: 'secondary' } },
    MuiRadio: { defaultProps: { color: 'secondary' } },
    MuiSlider: { defaultProps: { color: 'secondary' } },
    MuiLinearProgress: { defaultProps: { color: 'secondary' } },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          padding: '10px 24px',
          border: '2px solid #17120f',
          // Keyboard focus is a chakra-blue ring with an aura (index.css).
          '&.Mui-focusVisible': {
            outline: 'var(--focus-ring)',
            outlineOffset: 2,
          },
        },
        contained: {
          color: 'var(--on-action)',
          backgroundColor: 'var(--action)',
          boxShadow: '3px 3px 0 #17120f',
          // MUI swaps in soft elevation shadows on hover, press and keyboard
          // focus; keep the one hard ink shadow instead.
          '&:hover, &:active, &.Mui-focusVisible': {
            backgroundColor: 'var(--action-deep)',
            boxShadow: '3px 3px 0 #17120f',
          },
        },
        // Orange is a fill, never text on paper (2.2:1): outlined and text
        // buttons keep ink type and an ink keyline.
        outlinedPrimary: {
          color: '#17120f',
          borderColor: '#17120f',
          '&:hover': {
            borderColor: '#17120f',
            backgroundColor: 'rgba(245,130,31,0.16)',
          },
        },
        textPrimary: {
          color: '#17120f',
          '&:hover': {
            backgroundColor: 'rgba(245,130,31,0.16)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#f2e4c4',
          backgroundImage: 'var(--scroll-paper)',
          border: '2px solid #17120f',
        },
      },
    },
  },
});

export default theme;
