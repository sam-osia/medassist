import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { renderHighlightedText } from '../../../../../utils/highlightUtils';

/**
 * HighlightedText - Text display with <highlight> tag rendering
 *
 * Renders text containing <highlight>...</highlight> tags as styled spans.
 *
 * @param {string} text - Text with optional highlight tags
 * @param {string} label - Optional label above the text
 * @param {string} highlightColor - Background color for highlights (default: warning.light)
 */
function HighlightedText({
  text,
  label,
  highlightColor = '#ffeb3b',
  ...props
}) {
  if (!text) {
    return null;
  }

  // Use the shared utility to render highlighted text as React elements
  const renderedContent = renderHighlightedText(text, {
    backgroundColor: highlightColor
  });

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
          backgroundColor: 'custom.neutralBackground',
        }}
      >
        <Typography
          component="div"
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'inherit'
          }}
        >
          {renderedContent}
        </Typography>
      </Paper>
    </Box>
  );
}

export default HighlightedText;
