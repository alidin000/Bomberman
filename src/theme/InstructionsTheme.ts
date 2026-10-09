import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#bd3f32',
      light: '#d86a56',
      dark: '#832b24',
    },
    secondary: {
      main: '#356f6b',
      light: '#789a91',
      dark: '#244d4a',
    },
    // Destructive actions (Quit, Leave, Restart in a confirm). MUI's default
    // orange read 2.94:1 on the paper panels; --anime-vermilion-deep reads
    // 6.7:1 on paper-light and 5.6:1 on paper.
    warning: {
      main: '#9e3328',
      light: '#bd3f32',
      dark: '#832b24',
      contrastText: '#fff8e7',
    },
    background: {
      default: '#272b35',
      paper: '#efe3c4',
    },
    text: {
      primary: '#211d1a',
      secondary: '#5e574d',
    },
  },
  typography: {
    fontFamily: '"Trebuchet MS", "Arial Narrow", Arial, sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: 0,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 3,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          padding: '10px 24px',
          border: '2px solid #211d1a',
          // Keyboard focus is a teal ring (index.css --focus-ring).
          '&.Mui-focusVisible': {
            outline: 'var(--focus-ring)',
            outlineOffset: 2,
          },
        },
        contained: {
          boxShadow: '3px 3px 0 #211d1a',
          // MUI swaps in soft elevation shadows on hover, press and keyboard
          // focus; keep the one hard ink shadow instead.
          '&:hover, &:active, &.Mui-focusVisible': {
            boxShadow: '3px 3px 0 #211d1a',
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
          backgroundImage: 'none',
          backgroundColor: '#efe3c4',
          border: '2px solid #211d1a',
        },
      },
    },
  },
});

export default theme;
