import React from 'react';
import { Box } from '@mui/material';
import { FlagIndicator, SpanReasoning } from '../../shared/outputs';

/**
 * AnalyzeNoteWithSpanAndReason OutputView
 *
 * Displays:
 * - Flag indicator
 * - Span and reasoning (only when flag is true)
 */
function OutputView({ data, schema, toolName }) {
  const { flag_state, span, reasoning } = data || {};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <FlagIndicator
        value={flag_state}
        trueLabel="EVIDENCE FOUND"
        falseLabel="NO EVIDENCE"
        trueColor="warning"
        falseColor="default"
        label="Analysis Result"
      />

      {flag_state && (span || reasoning) && (
        <SpanReasoning
          span={span}
          reasoning={reasoning}
          spanLabel="Evidence Span"
          reasoningLabel="Reasoning"
        />
      )}
    </Box>
  );
}

export default OutputView;
