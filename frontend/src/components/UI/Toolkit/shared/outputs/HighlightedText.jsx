import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

/**
 * HighlightedText - Text display with <highlight> tag rendering
 *
 * Converts <highlight>...</highlight> tags to styled spans.
 *
 * @param {string} text - Text with optional highlight tags
 * @param {string} label - Optional label above the text
 * @param {string} highlightColor - Background color for highlights (default: warning.light)
 * @param {string} highlightTag - Tag name to look for (default: 'highlight')
 */
function HighlightedText({
  text,
  label,
  highlightColor = 'warning.light',
  highlightTag = 'highlight',
  ...props
}) {
  if (!text) {
    return null;
  }

  // Convert highlight tags to styled spans
  // Using a regex that handles multiline content
  const pattern = new RegExp(`<${highlightTag}>([\\s\\S]*?)</${highlightTag}>`, 'g');
  const html = text.replace(
    pattern,
    '<mark class="tool-highlight">$1</mark>'
  );

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
          '& .tool-highlight': {
            backgroundColor: highlightColor,
            padding: '2px 4px',
            borderRadius: '2px',
          }
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
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Paper>
    </Box>
  );
}

export default HighlightedText;