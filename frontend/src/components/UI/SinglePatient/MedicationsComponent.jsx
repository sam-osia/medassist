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
  CircularProgress
} from '@mui/material';
import {
  Medication as MedicationIcon
} from '@mui/icons-material';
// Removed streaming hooks as part of simplification
import { useProcessing } from '../../../contexts/ProcessingContext';
import './ProcessingIndicators.css';

// Individual medication row component with processing state
const MedicationRow = ({ medication, index, isHighlighted = false, isProcessing = false }) => {
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
      key={`${medication.order_id}-${medication.admin_line_num}` || index}
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
          {medication.order_id || 'N/A'}
          {isBeingProcessed && (
            <CircularProgress size={16} color="success" />
          )}
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ maxWidth: 200 }}>
          {medication.medication_name || medication.order_display_name || 'N/A'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ maxWidth: 150 }}>
          {medication.simple_generic_name || 'N/A'}
        </Typography>
      </TableCell>
      <TableCell>
        <Box>
          <Typography variant="body2">
            {medication.dosage_given_amount || 'N/A'} {medication.dosage_given_unit || ''}
          </Typography>
          {medication.dosage_order_amount && (
            <Typography variant="caption" color="text.secondary">
              Ordered: {medication.dosage_order_amount} {medication.dosage_order_unit || ''}
            </Typography>
          )}
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {medication.medication_route || 'N/A'}
        </Typography>
      </TableCell>
      <TableCell>{medication.dosing_frequency || 'N/A'}</TableCell>
      <TableCell>
        <Typography variant="body2">
          {formatDateTime(medication.admin_datetime)}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {medication.admin_action || 'N/A'}
        </Typography>
      </TableCell>
    </TableRow>
  );
};

const MedicationsComponent = ({ medications = [], mrn, csn, highlightedItems = [] }) => {
  // Access streaming events context
  // Use processing context
  const { isItemProcessing, getProcessingCount } = useProcessing();

  // Check if there's any active processing
  const processingCount = getProcessingCount('medications');

  
  // Ensure medications is an array
  medications = Array.isArray(medications) ? medications : [];
  

  // Calculate transition duration based on content length
  const transitionDuration = useMemo(() => {
    const baseTime = 300; // Base duration in ms
    const minTime = 150; // Minimum duration in ms
    if (medications.length > 15) {
      return minTime;
    }
    return baseTime;
  }, [medications.length]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <MedicationIcon 
          sx={{ 
            fontSize: 30,
            color: 'icon.main',
            transition: 'color 0.3s ease'
          }} 
        />
        <Box>
          <Typography variant="h5" component="h2">
            Medications
          </Typography>
          <Typography variant="body2" color="text.secondary">
            MRN: {mrn} | CSN: {csn} | Total: {medications.length}
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
            Processing {processingCount} medication{processingCount === 1 ? '' : 's'}...
          </Typography>
        </Box>
      )}

      {/* Content */}
      {medications.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No medication records found for this encounter.
          </Typography>
        </Box>
      ) : (
        <TableContainer 
          component={Paper} 
          variant="outlined"
          sx={{ maxHeight: 400, overflow: 'auto' }}
        >
          <Table sx={{ minWidth: 650 }} aria-label="medications table">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell><strong>Order ID</strong></TableCell>
                <TableCell><strong>Medication Name</strong></TableCell>
                <TableCell><strong>Generic Name</strong></TableCell>
                <TableCell><strong>Dosage Given</strong></TableCell>
                <TableCell><strong>Route</strong></TableCell>
                <TableCell><strong>Frequency</strong></TableCell>
                <TableCell><strong>Admin Time</strong></TableCell>
                <TableCell><strong>Action</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {medications.map((medication, index) => (
                <MedicationRow 
                  key={`${medication.order_id}-${medication.admin_line_num}` || index}
                  medication={medication}
                  index={index}
                  isHighlighted={highlightedItems.includes(medication.order_id)}
                  isProcessing={isItemProcessing('medications', medication.order_id)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default MedicationsComponent;
