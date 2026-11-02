import { createTheme } from '@mui/material/styles';
import { radius, textStyles } from './tokens';

// The legacy player status panel's theme, on the house text styles: Manrope
// body text, Heading 6 for the name, ninja orange for the primary colour
// and the square-cornered (2 px) shape.
const theme = createTheme({
  palette: {
    primary: {
      main: '#f5821f',
      contrastText: '#17120f',
    },
  },
  typography: {
    fontFamily: '"Manrope", "Trebuchet MS", system-ui, sans-serif',
    h6: textStyles.heading6,
    body1: textStyles.body3,
  },
  shape: {
    borderRadius: radius.sm,
  },
});

export default theme;
