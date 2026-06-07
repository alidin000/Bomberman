import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff8a00',
      light: '#ffb347',
      dark: '#c45f00',
    },
    secondary: {
      main: '#7c3aed',
      light: '#a78bfa',
      dark: '#4c1d95',
    },
    background: {
      default: '#120b0a',
      paper: 'rgba(32, 19, 16, 0.94)',
    },
    text: {
      primary: '#f5f6fa',
      secondary: '#b2bec3',
    },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
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
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 24px',
        },
        contained: {
          boxShadow: '0 4px 18px rgba(255, 138, 0, 0.45)',
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
          backgroundImage: 'linear-gradient(145deg, #1e1e3f 0%, #2d2d5a 100%)',
          border: '1px solid rgba(255, 138, 0, 0.28)',
        },
      },
    },
  },
});

export default theme;
