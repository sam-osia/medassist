import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

/**
 * JsonDisplay - Raw JSON fallback display
 *
 * @param {*} data - Data to display as JSON
 * @param {string} label - Optional label above the display
 */
function JsonDisplay({
  data,
  label,
  ...props
}) {
  // Safe stringify
  const jsonString = (() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  })();

  return (
    <Box {...props}>
      {label && (
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          {label}
        </Typography>
      )}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          backgroundColor: 'grey.50',
          overflow: 'auto',
          maxHeight: 400
        }}
      >
        <Box
          component="pre"
          sx={{
            margin: 0,
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {jsonString}
        </Box>
      </Paper>
    </Box>
  );
}

export default JsonDisplay;