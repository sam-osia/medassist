import React from 'react';
import { Box, Typography } from '@mui/material';
import { Forum as ForumIcon } from '@mui/icons-material';

const ChatComponent = () => {
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'background.paper'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
        <ForumIcon sx={{ fontSize: 30, color: 'icon.main' }} />
        <Box>
          <Typography variant="h5" component="h2">
            Chat
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Coming soon
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatComponent;
