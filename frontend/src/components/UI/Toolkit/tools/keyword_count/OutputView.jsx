import React from 'react';
import { Box } from '@mui/material';
import { MetricCard, HighlightedText } from '../../shared/outputs';

/**
 * KeywordCount OutputView
 *
 * Displays:
 * - Count as a prominent metric card
 * - Formatted text with highlighted keywords
 */
function OutputView({ data, schema, toolName }) {
  const { count, formatted_text } = data || {};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <MetricCard
        label="Keywords Found"
        value={count}
        color={count > 0 ? 'success' : 'default'}
        size="medium"
      />

      {formatted_text && (
        <HighlightedText
          text={formatted_text}
          label="Analyzed Text"
          highlightColor="#fff3cd"
        />
      )}
    </Box>
  );
}

export default OutputView;