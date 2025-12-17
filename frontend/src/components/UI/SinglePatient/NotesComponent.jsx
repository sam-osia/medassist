import React, { useState, useMemo } from 'react';
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  Description as NoteIcon,
  Note as ViewIcon,
  Close as CloseIcon
} from '@mui/icons-material';
// Removed streaming hooks as part of simplification
import { useProcessing } from '../../../contexts/ProcessingContext';

// Individual note row component with processing state
const NoteRow = ({ note, index, onViewNote, isHighlighted = false, isProcessing = false }) => {
  const isBeingProcessed = isProcessing;
  
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <TableRow 
      key={note.note_id || index}
      sx={{ 
        '&:last-child td, &:last-child th': { border: 0 },
        backgroundColor: isHighlighted ? '#fff9c4' : (isBeingProcessed ? '#e8f5e8' : 'transparent'),
        borderLeft: isHighlighted ? '4px solid #ffa726' : 'none',
        fontWeight: isBeingProcessed ? 'bold' : 'normal',
        '&:hover': {
          backgroundColor: isHighlighted ? '#fff59d' : (isBeingProcessed ? '#d4f0d4' : 'rgba(0, 0, 0, 0.04)')
        }
      }}
    >
      <TableCell component="th" scope="row">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {note.note_id || 'N/A'}
          {isBeingProcessed && (
            <CircularProgress size={16} color="success" />
          )}
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {note.note_type || 'N/A'}
        </Typography>
      </TableCell>
      <TableCell>{note.service || 'N/A'}</TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ maxWidth: 150 }}>
          {note.author || 'N/A'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {formatDateTime(note.create_datetime)}
        </Typography>
      </TableCell>
      <TableCell>
        <Button
          variant="contained"
          size="small"
          onClick={() => onViewNote(note)}
          disabled={!note.note_text || isBeingProcessed}
        >
          {isBeingProcessed ? 'Processing...' : 'View'}
        </Button>
      </TableCell>
    </TableRow>
  );
};

const NotesComponent = ({ notes = [], mrn, csn, highlightedItems = [] }) => {
  const [selectedNote, setSelectedNote] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Use processing context
  const { isItemProcessing, getProcessingCount } = useProcessing();

  // Check if there's any active processing
  const processingCount = getProcessingCount('notes');
  
  // Ensure notes is an array
  notes = Array.isArray(notes) ? notes : [];
  

  // Calculate transition duration based on content length
  const transitionDuration = useMemo(() => {
    const baseTime = 300; // Base duration in ms
    const minTime = 150; // Minimum duration in ms
    // Notes often contain long text content, so we'll make it faster with fewer items
    if (notes.length > 10) {
      return minTime;
    }
    return baseTime;
  }, [notes.length]);

  const handleViewNote = (note) => {
    setSelectedNote(note);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedNote(null);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <NoteIcon 
            sx={{ 
              fontSize: 30,
              color: 'icon.main',
              transition: 'color 0.3s ease'
            }} 
          />
          <Box>
            <Typography variant="h5" component="h2">
              Clinical Notes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              MRN: {mrn} | CSN: {csn} | Total: {notes.length}
            </Typography>
          </Box>
        </Box>

        {/* Processing Status Alert */}
        {processingCount > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="body2"
              sx={{
                p: 2,
                backgroundColor: 'success.light',
                opacity: 0.3,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'success.light',
                color: 'success.dark'
              }}
            >
              Processing {processingCount} note{processingCount === 1 ? '' : 's'}...
            </Typography>
          </Box>
        )}

        {/* Content */}
        {notes.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No clinical notes found for this encounter.
            </Typography>
          </Box>
        ) : (
          <TableContainer 
            component={Paper} 
            variant="outlined"
            sx={{ maxHeight: 400, overflow: 'auto' }}
          >
            <Table sx={{ minWidth: 650 }} aria-label="notes table">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.50' }}>
                  <TableCell><strong>Note ID</strong></TableCell>
                  <TableCell><strong>Note Type</strong></TableCell>
                  <TableCell><strong>Service</strong></TableCell>
                  <TableCell><strong>Author</strong></TableCell>
                  <TableCell><strong>Created</strong></TableCell>
                  <TableCell><strong>Action</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notes.map((note, index) => (
                  <NoteRow 
                    key={note.note_id || index}
                    note={note}
                    index={index}
                    onViewNote={handleViewNote}
                    isHighlighted={highlightedItems.includes(note.note_id)}
                    isProcessing={isItemProcessing('notes', note.note_id)}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Note Text Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '400px' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">
              Clinical Note - {selectedNote?.note_type || 'Unknown Type'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Note ID: {selectedNote?.note_id} | Author: {selectedNote?.author}
            </Typography>
          </Box>
          <IconButton onClick={handleCloseDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Created:</strong> {formatDateTime(selectedNote?.create_datetime)} | 
              <strong> Filed:</strong> {formatDateTime(selectedNote?.filing_datetime)} |
              <strong> Service:</strong> {selectedNote?.service || 'N/A'}
            </Typography>
          </Box>
          
          <Typography 
            variant="body1" 
            component="div"
            sx={{ 
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              backgroundColor: 'grey.50',
              p: 2,
              borderRadius: 1,
              maxHeight: '400px',
              overflow: 'auto'
            }}
          >
            {selectedNote?.note_text || 'No note text available.'}
          </Typography>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDialog} variant="text">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NotesComponent;
