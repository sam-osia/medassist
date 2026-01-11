import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * TextDisplay - Simple text/string display component
 *
 * @param {string} label - Field label
 * @param {*} value - Value to display
 * @param {string} variant - Typography variant ('body1', 'body2', 'caption')
 */
function TextDisplay({
  label,
  value,
  variant = 'body1',
  ...props
}) {
  // Convert value to displayable string
  const displayValue = (() => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  })();

  return (
    <Box sx={{ mb: 2 }} {...props}>
      {label && (
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
          {label}
        </Typography>
      )}
      <Typography
        variant={variant}
        sx={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {displayValue || <em style={{ color: 'gray' }}>No value</em>}
      </Typography>
    </Box>
  );
}

export default TextDisplay;