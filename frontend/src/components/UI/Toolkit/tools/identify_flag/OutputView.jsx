import React from 'react';
import { Box } from '@mui/material';
import { FlagIndicator, HighlightedText } from '../../shared/outputs';

/**
 * IdentifyFlag OutputView
 *
 * Displays:
 * - Flag indicator (DETECTED / NOT DETECTED)
 * - Formatted text with highlights (only when flag is true)
 */
function OutputView({ data, schema, toolName }) {
  const { flag_state, formatted_text } = data || {};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <FlagIndicator
        value={flag_state}
        trueLabel="DETECTED"
        falseLabel="NOT DETECTED"
        trueColor="warning"
        falseColor="default"
        label="Flag Status"
      />

      {flag_state && formatted_text && (
        <HighlightedText
          text={formatted_text}
          label="Supporting Evidence"
          highlightColor="#fff3cd"
        />
      )}
    </Box>
  );
}

export default OutputView;