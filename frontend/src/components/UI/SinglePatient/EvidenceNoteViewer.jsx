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
import {
  Close as CloseIcon,
  Highlight as EvidenceIcon
} from '@mui/icons-material';
import { parseHighlightedText, hasHighlights } from '../../../utils/highlightParser';

const EvidenceNoteViewer = ({ open, onClose, evidenceData }) => {
  if (!evidenceData) {
    return null;
  }

  const { details } = evidenceData;
  const highlightedText = details?.highlighted_text || '';
  const criteriaName = details?.criteria_name || 'Unknown Criteria';
  const reasoning = details?.reasoning || '';
  
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

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
              Evidence Note - {details?.note_type || 'Unknown Type'}
            </Typography>
            <Chip 
              label={criteriaName}
              size="small"
              color="warning"
              variant="outlined"
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Note ID: {details?.note_id || 'N/A'} | Author: {details?.author || 'N/A'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent 
        dividers 
        sx={{ 
          height: 'calc(80vh - 120px)', // Account for header and actions
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden' // Prevent main content scrolling
        }}
      >
        {/* Detection Criteria and Evidence Status */}
        <Box sx={{
          mb: 2,
          p: 2,
          backgroundColor: 'warning.light',
          opacity: 0.3,
          borderLeft: '4px solid',
          borderColor: 'warning.main',
          borderRadius: 1,
          flexShrink: 0
        }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Detection Criteria:</strong> {details?.criteria || 'N/A'}
          </Typography>
          {highlightedText && (
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.dark', mt: 1 }}>
              {hasHighlights(highlightedText) ? '📍 Evidence Found' : '📍 Evidence highlighting is missing from the text'}
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
          flex: 1, // Take remaining space
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
            flexShrink: 0 // Don't shrink this section
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