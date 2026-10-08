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
        },
        contained: {
          boxShadow: '3px 3px 0 #211d1a',
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
