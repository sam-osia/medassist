import React, { useState } from 'react';
import { AppBar, Toolbar, Box, Typography, Button, IconButton, Menu, MenuItem, Switch } from '@mui/material';
import { AccountCircle } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../../../contexts/AuthProvider';
import { useThemeMode } from '../../../contexts/ThemeProvider';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { logout, isAdmin } = useAuth();
  const { isDark, toggleTheme } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState(null);

  const menuItems = [
    // { text: 'Dashboard', path: '/dashboard' },
    { text: 'Datasets', path: '/datasets' },
    { text: 'Projects', path: '/projects' },
    { text: 'Workflows', path: '/planning-agent' },
    { text: 'Toolkit Playground', path: '/tool-playground' },
    { text: 'Caboodle', path: '/caboodle' }
  ];

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAccountClick = () => {
    handleMenuClose();
    navigate('/account');
  };

  const handleAdminClick = () => {
    handleMenuClose();
    navigate('/admin');
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="static" sx={{ backgroundColor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }} elevation={1}>
      <Toolbar sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography
          variant="h5"
          component="div"
          sx={{
            color: 'text.primary',
            fontWeight: 'bold',
            fontFamily: 'Syncopate, monospace',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/datasets')}
        >
          MedAssist AI
        </Typography>

        {/* Right section - Navigation links */}
        <Box sx={{ display: 'flex', gap: 2, marginLeft: 'auto', alignItems: 'center' }}>
          {menuItems.map((item) => (
            <Button
              key={item.text}
              onClick={() => navigate(item.path)}
              sx={{
                color: location.pathname === item.path ? theme.palette.secondary.main : theme.palette.primary.main,
                textTransform: 'none',
                fontSize: '16px',
                fontWeight: 500,
                '&:hover': {
                  color: theme.palette.secondary.main,
                  backgroundColor: 'transparent'
                },
                '&:active': {
                  color: theme.palette.secondary.main,
                  backgroundColor: 'transparent'
                },
                '&.Mui-focusVisible': {
                  color: theme.palette.secondary.main,
                  backgroundColor: 'transparent'
                }
              }}
            >
              {item.text}
            </Button>
          ))}
          <IconButton
            onClick={handleMenuOpen}
            sx={{
              color: theme.palette.primary.main,
              '&:hover': {
                color: theme.palette.secondary.main,
                backgroundColor: 'transparent'
              }
            }}
          >
            <AccountCircle sx={{ fontSize: 32 }} />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem
              onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
              sx={{ color: theme.palette.primary.main }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                Dark Mode
                <Switch
                  checked={isDark}
                  size="small"
                  onClick={(e) => e.stopPropagation()}
                  onChange={toggleTheme}
                />
              </Box>
            </MenuItem>
            <MenuItem onClick={handleAccountClick} sx={{ color: theme.palette.primary.main }}>My Account</MenuItem>
            {isAdmin && <MenuItem onClick={handleAdminClick} sx={{ color: theme.palette.primary.main }}>Admin Dashboard</MenuItem>}
            <MenuItem onClick={handleLogout} sx={{ color: theme.palette.primary.main }}>Logout</MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
