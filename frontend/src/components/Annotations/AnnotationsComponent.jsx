import React from 'react';
import { Typography, Box } from '@mui/material';
import { Note as AnnotationIcon } from '@mui/icons-material';

const AnnotationsComponent = () => {
  return (
    <Box sx={{ backgroundColor: 'white', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3, pb: 2 }}>
        <AnnotationIcon sx={{ fontSize: 30, color: 'icon.main' }} />
        <Box>
          <Typography variant="h5" component="h2">
            Annotations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Labeled data annotations
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3, pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Annotations will be displayed here.
        </Typography>
      </Box>
    </Box>
  );
};

export default AnnotationsComponent;