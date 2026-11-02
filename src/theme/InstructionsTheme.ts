import { createTheme } from '@mui/material/styles';
import {
  DURATION, EASE_OUT, PRESSED, radius, textStyles, transition,
} from './tokens';

// The menus' MUI theme: scroll paper, ink keylines, ninja-orange actions and
// a heavy comic display face for titles and buttons (index.css holds the
// colour tokens and the @font-face rules). Every variant is one of the named
// text styles, and every transition runs on the house curve (theme/tokens).
const BODY = '"Manrope", "Trebuchet MS", system-ui, sans-serif';

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
    h1: textStyles.heading1,
    h2: textStyles.heading2,
    h3: textStyles.heading3,
    h4: textStyles.heading4,
    h5: textStyles.heading5,
    h6: textStyles.heading6,
    subtitle1: textStyles.title3,
    subtitle2: textStyles.title4,
    body1: textStyles.body3,
    body2: textStyles.body6,
    button: textStyles.buttonMd,
    caption: textStyles.caption5,
    overline: { ...textStyles.caption3, letterSpacing: '0.08em', textTransform: 'uppercase' },
  },
  shape: {
    borderRadius: radius.sm,
  },
  // MUI's own transitions (dialogs, switches, ripples) on the house curve.
  transitions: {
    easing: {
      easeInOut: EASE_OUT,
      easeOut: EASE_OUT,
      easeIn: EASE_OUT,
      sharp: EASE_OUT,
    },
    duration: {
      shortest: DURATION.min,
      shorter: DURATION.min,
      short: DURATION.fade,
      standard: DURATION.fade,
      complex: DURATION.move,
      enteringScreen: DURATION.fade,
      leavingScreen: DURATION.min,
    },
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
          borderRadius: radius.sm,
          // Main buttons: 8 px by 12 px around the label.
          padding: '8px 12px',
          border: '2px solid #17120f',
          transition: transition(['transform'], ['background-color', 'border-color', 'color', 'box-shadow']),
          '&:active': PRESSED,
          // Keyboard focus is a chakra-blue ring with an aura (index.css).
          '&.Mui-focusVisible': {
            outline: 'var(--focus-ring)',
            outlineOffset: 2,
          },
        },
        sizeLarge: {
          ...textStyles.buttonLg,
          padding: '8px 16px',
        },
        sizeSmall: {
          ...textStyles.buttonSm,
          padding: '4px 8px',
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
