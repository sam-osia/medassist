import { createTheme } from '@mui/material/styles';

// Define gradient backgrounds
export const pageGradient = 'linear-gradient(135deg, #E8F7FC 0%, #FFFFFF 50%, #D6EFF7 100%)';
export const pageGradientDark = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';

// Helper function to get gradient based on theme mode
export const getPageGradient = (themeMode) => {
  return themeMode === 'dark' ? pageGradientDark : pageGradient;
};

// Create MUI light theme (SickKids branding)
export const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#00468B', // SickKids dark navy blue
        },
        secondary: {
            main: '#00B4E4' // SickKids light cyan/turquoise
        },
        info: {
            main: '#1D1C1D' // Dark Gray
        },
        icon: {
            main: '#00B4E4', // SickKids cyan
            light: '#4A484A',
            dark: '#000000',
        },
        page: {
            main: '#E8F7FC', // Light cyan for solid backgrounds
        },
        surface: {
            main: '#F0FAFD', // Very light cyan for tab panels and containers
            tab: 'rgba(0, 70, 139, 0.1)', // Light navy blue for tabs
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

// Create MUI dark theme (SickKids branding)
export const themeDark = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#4d8bc9', // Lighter navy blue for dark mode visibility
        },
        secondary: {
            main: '#00B4E4' // SickKids light cyan/turquoise (stays same)
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
            main: '#00B4E4', // SickKids cyan
            light: '#B0B0B0',
            dark: '#FFFFFF',
        },
        page: {
            main: '#1a1a2e', // Dark blue-gray for backgrounds
        },
        surface: {
            main: '#1e2a3a', // Dark cyan-tinted surface
            tab: 'rgba(0, 180, 228, 0.15)', // Cyan tint for tabs
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
