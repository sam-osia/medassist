import { createTheme } from '@mui/material/styles';

// Define gradient backgrounds (can't be in MUI theme due to augmentColor limitations)
export const pageGradient = 'linear-gradient(135deg, #f0f0f0 0%, #ffffff 50%, #e0e0e0 100%)';

// Helper function to get gradient based on theme mode (for future dark mode support)
export const getPageGradient = (themeMode) => {
  // For now, always return light gradient
  // When dark mode is added: return themeMode === 'dark' ? pageGradientDark : pageGradient;
  return pageGradient;
};

// Create MUI theme (UHN branding)
export const theme = createTheme({
    palette: {
        primary: {
            main: '#002244', // Midnight blue
        },
        secondary: {
            main: '#f94900' // UHN Orange
        },
        info: {
            main: '#1D1C1D' // UHN Dark Gray
        },
        icon: {
            main: '#f94900', // UHN Dark Gray
            light: '#4A484A',
            dark: '#000000',
        },
        page: {
            main: '#f0f0f0', // Light gray for solid backgrounds
        },
        surface: {
            main: '#f5f5f5', // Light gray for tab panels and containers
            tab: 'rgba(0, 34, 68, 0.1)', // Light midnight blue for tabs
        },
    },
    typography: {
        h4: {
            fontWeight: 600,
        },
        h5: {
            fontWeight: 600,
        },
        h6: {
            fontWeight: 600,
        },
    },
});

// Make custom colors available to MUI components
theme.palette.icon = theme.palette.augmentColor({
  color: theme.palette.icon,
  name: 'icon',
});
theme.palette.page = theme.palette.augmentColor({
  color: theme.palette.page,
  name: 'page',
});
theme.palette.surface = theme.palette.augmentColor({
  color: theme.palette.surface,
  name: 'surface',
});