import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Chip
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Highlight as EvidenceIcon
} from '@mui/icons-material';
import { parseHighlightedText } from '../../../utils/highlightParser';

// Client-side function to find span in text and wrap with highlight tags
const highlightSpanInText = (text, spanText) => {
  if (!text || !spanText) return text || '';

  // Normalize whitespace for matching
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const normalizedSpan = spanText.replace(/\s+/g, ' ').trim();

  // Case-insensitive search
  const lowerText = normalizedText.toLowerCase();
  const lowerSpan = normalizedSpan.toLowerCase();

  const startIdx = lowerText.indexOf(lowerSpan);
  if (startIdx === -1) {
    // Span not found - return original text with span appended
    return `${text}\n\n[Extracted span - not found verbatim in text]:\n${spanText}`;
  }

  const endIdx = startIdx + normalizedSpan.length;
  return (
    normalizedText.slice(0, startIdx) +
    '<highlight>' + normalizedText.slice(startIdx, endIdx) + '</highlight>' +
    normalizedText.slice(endIdx)
  );
};

const EvidenceNoteViewer = ({ open, onClose, evidenceData }) => {
  if (!evidenceData) {
    return null;
  }

  // New data structure: { noteText, noteMetadata, span, reasoning, criteria, criteriaName }
  const { noteText, noteMetadata, span, reasoning, criteria, criteriaName } = evidenceData;

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Generate highlighted text client-side
  const highlightedText = highlightSpanInText(noteText, span);
  const hasNoteText = !!noteText;

  // Fallback view when note text is not available
  if (!hasNoteText && span) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '300px', maxHeight: '60vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <EvidenceIcon color="warning" />
              <Typography variant="h6">
                Evidence Details
              </Typography>
              <Chip
                label={criteriaName || 'Unknown Criteria'}
                size="small"
                color="warning"
                variant="outlined"
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Note content unavailable
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {/* Span Display */}
          <Box sx={{
            mb: 2,
            p: 2,
            backgroundColor: (theme) => alpha(theme.palette.warning.light, 0.3),
            borderLeft: '4px solid',
            borderColor: 'warning.main',
            borderRadius: 1
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.dark', mb: 1 }}>
              📍 Detected Span
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6
              }}
            >
              {span}
            </Typography>
          </Box>

          {/* Reasoning Display */}
          {reasoning && (
            <Box sx={{
              p: 2,
              backgroundColor: 'action.hover',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1 }}>
                🧠 Reasoning
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.primary',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5
                }}
              >
                {reasoning}
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px', maxHeight: '80vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <EvidenceIcon color="warning" />
            <Typography variant="h6">
              Evidence Note - {noteMetadata?.note_type || 'Unknown Type'}
            </Typography>
            <Chip
              label={criteriaName || 'Unknown Criteria'}
              size="small"
              color="warning"
              variant="outlined"
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Note ID: {noteMetadata?.note_id || 'N/A'} | Author: {noteMetadata?.author || 'N/A'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          height: 'calc(80vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Detection Criteria and Evidence Status */}
        <Box sx={{
          mb: 2,
          p: 2,
          backgroundColor: (theme) => alpha(theme.palette.warning.light, 0.3),
          borderLeft: '4px solid',
          borderColor: 'warning.main',
          borderRadius: 1,
          flexShrink: 0
        }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Detection Criteria:</strong> {criteria || 'N/A'}
          </Typography>
          {span && (
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.dark', mt: 1 }}>
              📍 Evidence Found
            </Typography>
          )}
        </Box>

        {/* Note Text with Highlights - Scrollable */}
        <Box sx={{
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 2,
          flex: 1,
          overflow: 'auto',
          mb: 2
        }}>
          <Typography
            variant="body1"
            component="div"
            sx={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              lineHeight: 1.6
            }}
          >
            {highlightedText ? parseHighlightedText(highlightedText) : 'No evidence text available.'}
          </Typography>
        </Box>

        {/* Reasoning Display - Always Visible */}
        {reasoning && (
          <Box sx={{
            p: 2,
            backgroundColor: 'action.hover',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            flexShrink: 0
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1 }}>
              🧠 Reasoning
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.primary',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5
              }}
            >
              {reasoning}
            </Typography>
          </Box>
        )}

      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EvidenceNoteViewer;
