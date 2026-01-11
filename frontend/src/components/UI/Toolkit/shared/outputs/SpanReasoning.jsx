import React from 'react';
import { Box, Typography, Paper, Divider } from '@mui/material';
import { FormatQuote as QuoteIcon } from '@mui/icons-material';

/**
 * SpanReasoning - Combined span + reasoning display
 *
 * Displays a quoted text span alongside the reasoning/analysis.
 *
 * @param {string} span - The text span/excerpt
 * @param {string} reasoning - The reasoning/analysis text
 * @param {string} label - Optional label above the component
 * @param {string} spanLabel - Label for span section (default: 'Evidence')
 * @param {string} reasoningLabel - Label for reasoning section (default: 'Analysis')
 */
function SpanReasoning({
  span,
  reasoning,
  label,
  spanLabel = 'Evidence',
  reasoningLabel = 'Analysis',
  ...props
}) {
  // Don't render if both are empty
  if (!span && !reasoning) {
    return null;
  }

  return (
    <Box {...props}>
      {label && (
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          {label}
        </Typography>
      )}

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {/* Span Section */}
        {span && (
          <Box sx={{ p: 2, backgroundColor: 'grey.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <QuoteIcon sx={{ color: 'text.secondary', fontSize: 20, mt: 0.5 }} />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {spanLabel}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    mt: 0.5,
                    fontStyle: 'italic',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  "{span}"
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Divider */}
        {span && reasoning && <Divider />}

        {/* Reasoning Section */}
        {reasoning && (
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {reasoningLabel}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {reasoning}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default SpanReasoning;