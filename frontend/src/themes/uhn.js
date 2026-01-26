import { createTheme } from '@mui/material/styles';

// Define gradient backgrounds
export const pageGradient = 'linear-gradient(135deg, #f0f0f0 0%, #ffffff 50%, #e0e0e0 100%)';
export const pageGradientDark = 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)';

// Helper function to get gradient based on theme mode
export const getPageGradient = (themeMode) => {
  return themeMode === 'dark' ? pageGradientDark : pageGradient;
};

// Create MUI light theme (UHN branding)
export const theme = createTheme({
    palette: {
        mode: 'light',
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
            main: '#f94900', // UHN Orange
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
        highlight: {
            main: '#ffeb3b', // Yellow highlight background
            contrastText: '#000000', // Black text on highlight
        },
        custom: {
            tableRowHover: 'rgba(0, 0, 0, 0.04)',
            subtleBorder: 'rgba(0, 0, 0, 0.08)',
            mediumBorder: 'rgba(0, 0, 0, 0.12)',
            subtleShadow: 'rgba(0, 0, 0, 0.04)',
            hoverShadow: 'rgba(0, 0, 0, 0.1)',
            warningBackground: 'rgba(255, 152, 0, 0.08)',
            warningHover: 'rgba(255, 152, 0, 0.12)',
            neutralBackground: '#fafafa',
            alternateRow: '#eeeeee',
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

// Create MUI dark theme (UHN branding)
export const themeDark = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#4d7ab3', // Lighter midnight blue for dark mode visibility
        },
        secondary: {
            main: '#ff6b35' // Lighter UHN Orange for dark mode
        },
        info: {
            main: '#E0E0E0' // Light Gray for dark mode
        },
        background: {
            default: '#121212', // Standard dark mode background
            paper: '#1e1e1e', // Slightly lighter for cards/surfaces
        },
        text: {
            primary: '#E0E0E0',
            secondary: '#A0A0A0',
        },
        icon: {
            main: '#ff6b35', // Lighter UHN Orange
            light: '#B0B0B0',
            dark: '#FFFFFF',
        },
        page: {
            main: '#1a1a1a', // Dark gray for backgrounds
        },
        surface: {
            main: '#2d2d2d', // Dark surface
            tab: 'rgba(249, 73, 0, 0.15)', // Orange tint for tabs
        },
        highlight: {
            main: '#ffd600', // Slightly darker yellow for dark mode
            contrastText: '#000000', // Black text on highlight
        },
        divider: 'rgba(255, 255, 255, 0.12)',
        custom: {
            tableRowHover: 'rgba(255, 255, 255, 0.04)',
            subtleBorder: 'rgba(255, 255, 255, 0.08)',
            mediumBorder: 'rgba(255, 255, 255, 0.12)',
            subtleShadow: 'rgba(255, 255, 255, 0.02)',
            hoverShadow: 'rgba(255, 255, 255, 0.05)',
            warningBackground: 'rgba(255, 152, 0, 0.15)',
            warningHover: 'rgba(255, 152, 0, 0.25)',
            neutralBackground: '#2d2d2d',
            alternateRow: '#3d3d3d',
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

// Make custom colors available to MUI components (light theme)
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
theme.palette.highlight = theme.palette.augmentColor({
  color: theme.palette.highlight,
  name: 'highlight',
});

// Make custom colors available to MUI components (dark theme)
themeDark.palette.icon = themeDark.palette.augmentColor({
  color: themeDark.palette.icon,
  name: 'icon',
});
themeDark.palette.page = themeDark.palette.augmentColor({
  color: themeDark.palette.page,
  name: 'page',
});
themeDark.palette.surface = themeDark.palette.augmentColor({
  color: themeDark.palette.surface,
  name: 'surface',
});
themeDark.palette.highlight = themeDark.palette.augmentColor({
  color: themeDark.palette.highlight,
  name: 'highlight',
});

// Add pageGradient as custom theme property
theme.pageGradient = pageGradient;
themeDark.pageGradient = pageGradientDark;
