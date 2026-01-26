import React, { useMemo } from 'react';
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
  CircularProgress,
  Button
} from '@mui/material';
import {
  Troubleshoot as DiagnosisIcon,
  Check as CheckIcon,
  Edit as EditIcon
} from '@mui/icons-material';
// Removed streaming hooks as part of simplification
import { useProcessing } from '../../../contexts/ProcessingContext';
import './ProcessingIndicators.css';

// Individual diagnosis row component with processing state
const DiagnosisRow = ({
  diagnosis,
  index,
  isProcessing = false,
  annotationMode = false,
  isAnnotated = false,
  onAnnotateClick
}) => {
  const isBeingProcessed = isProcessing;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <TableRow
      key={diagnosis.diagnosis_id || index}
      sx={{
        '&:last-child td, &:last-child th': { border: 0 },
        backgroundColor: isBeingProcessed ? '#e8f5e8' : 'transparent',
        fontWeight: isBeingProcessed ? 'bold' : 'normal',
        '&:hover': {
          backgroundColor: isBeingProcessed ? '#d4f0d4' : 'custom.tableRowHover'
        }
      }}
    >
      <TableCell component="th" scope="row">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {diagnosis.diagnosis_id || 'N/A'}
          {isBeingProcessed && (
            <CircularProgress size={16} color="success" />
          )}
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ maxWidth: 200 }}>
          {diagnosis.diagnosis_name || 'N/A'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {diagnosis.diagnosis_code || 'N/A'}
        </Typography>
      </TableCell>
      <TableCell>{diagnosis.code_set || 'N/A'}</TableCell>
      <TableCell>{diagnosis.diagnosis_source || 'N/A'}</TableCell>
      <TableCell>{formatDate(diagnosis.date)}</TableCell>
      <TableCell>
        <Typography variant="body2">
          {diagnosis.is_chronic ? 'Chronic' : 'Acute'}
        </Typography>
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2">
            {diagnosis.resolved_date ? `Resolved ${formatDate(diagnosis.resolved_date)}` : 'Active'}
          </Typography>
          {annotationMode && (
            <Button
              size="small"
              variant={isAnnotated ? 'outlined' : 'contained'}
              color={isAnnotated ? 'success' : 'primary'}
              startIcon={isAnnotated ? <CheckIcon /> : <EditIcon />}
              onClick={() => onAnnotateClick(diagnosis)}
            >
              {isAnnotated ? 'Edit' : 'Annotate'}
            </Button>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
};

const DiagnosisComponent = ({
  diagnoses = [],
  mrn,
  csn,
  annotationMode = false,
  annotationMap = new Map(),
  onAnnotateClick
}) => {
  // Use processing context
  const { isItemProcessing, getProcessingCount } = useProcessing();

  // Check if there's any active processing
  const processingCount = getProcessingCount('diagnoses');

  
  // Ensure diagnoses is an array
  diagnoses = Array.isArray(diagnoses) ? diagnoses : [];
  

  // Calculate transition duration based on content length
  const transitionDuration = useMemo(() => {
    const baseTime = 300; // Base duration in ms
    const minTime = 150; // Minimum duration in ms
    if (diagnoses.length > 20) {
      return minTime;
    }
    return baseTime;
  }, [diagnoses.length]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <DiagnosisIcon 
          sx={{ 
            fontSize: 30,
            color: 'icon.main',
            transition: 'color 0.3s ease'
          }} 
        />
        <Box>
          <Typography variant="h5" component="h2">
            Diagnoses
          </Typography>
          <Typography variant="body2" color="text.secondary">
            MRN: {mrn} | CSN: {csn} | Total: {diagnoses.length}
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
            Processing {processingCount} diagnosis{processingCount === 1 ? '' : 'es'}...
          </Typography>
        </Box>
      )}

      {/* Content */}
      {diagnoses.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No diagnosis records found for this encounter.
          </Typography>
        </Box>
      ) : (
        <TableContainer 
          component={Paper} 
          variant="outlined"
          sx={{ maxHeight: 400, overflow: 'auto' }}
        >
          <Table sx={{ minWidth: 650 }} aria-label="diagnosis table">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell><strong>Diagnosis ID</strong></TableCell>
                <TableCell><strong>Diagnosis Name</strong></TableCell>
                <TableCell><strong>Diagnosis Code</strong></TableCell>
                <TableCell><strong>Code Set</strong></TableCell>
                <TableCell><strong>Source</strong></TableCell>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Chronic</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {diagnoses.map((diagnosis, index) => (
                <DiagnosisRow
                  key={diagnosis.diagnosis_id || index}
                  diagnosis={diagnosis}
                  index={index}
                  isProcessing={isItemProcessing('diagnoses', diagnosis.diagnosis_id)}
                  annotationMode={annotationMode}
                  isAnnotated={annotationMap.has(String(diagnosis.diagnosis_id))}
                  onAnnotateClick={onAnnotateClick}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default DiagnosisComponent;
