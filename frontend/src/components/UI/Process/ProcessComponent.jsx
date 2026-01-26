import React from 'react';
import { Typography, Box } from '@mui/material';
import { PlaylistAddCheck as ProcessIcon } from '@mui/icons-material';

const ProcessComponent = () => {
  return (
    <Box sx={{
      backgroundColor: 'background.paper',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      p: 4
    }}>
      <ProcessIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h5" color="text.secondary">
        Workflow Execution (Legacy)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
        This feature has been deprecated. Please use project-based workflow execution instead.
      </Typography>
    </Box>
  );
};

export default ProcessComponent;
