import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { FlagIndicator, HighlightedText } from '../../shared/outputs';
import { insertHighlightTags } from '../../../../../utils/highlightUtils';

/**
 * AnalyzeNoteWithSpanAndReason OutputView
 *
 * Displays:
 * - Flag indicator (always)
 * - Full note text (highlighted when flag=true, plain when flag=false)
 * - Reasoning (when available)
 */
function OutputView({ data, schema, toolName, inputs }) {
  const { flag_state, span, reasoning } = data || {};
  const noteText = inputs?.note || '';

  // Generate highlighted text when flag is true and we have both note and span
  const displayText = flag_state && span && noteText
    ? insertHighlightTags(noteText, span)
    : noteText;

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

      {noteText && (
        <HighlightedText
          text={displayText}
          label="Note Text"
        />
      )}

      {reasoning && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Reasoning
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              backgroundColor: 'action.hover',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {reasoning}
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

export default OutputView;
