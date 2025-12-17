import React from 'react';
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
  Grid,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  ShowChart as FlowsheetIcon
} from '@mui/icons-material';
// Removed streaming hooks as part of simplification
import { useProcessing } from '../../../contexts/ProcessingContext';

const FlowsheetsInstanceComponent = ({ flowsheet_instances, mrn, csn, highlightedItems = [] }) => {
  // Use processing context
  const { isItemProcessing, getProcessingCount } = useProcessing();

  // Check if there's any active processing
  const processingCount = getProcessingCount('flowsheets');
  
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatDateTimeForHeader = (dateString) => {
    if (!dateString) return { date: 'N/A', time: '' };
    try {
      const date = new Date(dateString);
      return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString()
      };
    } catch {
      return { date: dateString, time: '' };
    }
  };

  // Get instance states using processing context
  const instanceStates = {};
  if (flowsheet_instances && flowsheet_instances.length > 0) {
    for (let i = 0; i < flowsheet_instances.length; i++) {
      instanceStates[i] = { isActive: isItemProcessing('flowsheets', `instance_${i}`) };
    }
  }

  const renderInstanceTable = () => {
    if (!flowsheet_instances || flowsheet_instances.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No flowsheet instance data available.
          </Typography>
        </Box>
      );
    }

    // Get all unique measurement keys across all instances
    const allMeasurementKeys = new Set();
    flowsheet_instances.forEach(instance => {
      Object.keys(instance.measurements).forEach(key => {
        allMeasurementKeys.add(key);
      });
    });
    const measurementKeys = Array.from(allMeasurementKeys);

    return (
      <Box>
        {/* Instance Table Summary */}
        <Box sx={{ mb: 2, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2">
                <strong>Total Instances:</strong> {flowsheet_instances.length}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2">
                <strong>Unique Measurements:</strong> {measurementKeys.length}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2">
                <strong>Date Range:</strong> {formatDateTime(flowsheet_instances[0]?.timestamp)} - {formatDateTime(flowsheet_instances[flowsheet_instances.length - 1]?.timestamp)}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Instance Table */}
        <TableContainer 
          component={Paper} 
          variant="outlined"
          sx={{ maxHeight: 400, overflow: 'auto' }}
        >
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell sx={{ minWidth: 150, position: 'sticky', left: 0, backgroundColor: 'action.hover', zIndex: 5 }}>
                  <strong>Measurement</strong>
                </TableCell>
                {flowsheet_instances.map((instance, index) => {
                  const instanceState = instanceStates[index];
                  const isBeingProcessed = instanceState?.isActive;
                  return (
                    <TableCell 
                      key={index} 
                      sx={{ 
                        minWidth: 120, 
                        backgroundColor: isBeingProcessed ? 'success.light' : 'action.hover',
                        opacity: isBeingProcessed ? 0.3 : 1,
                        fontWeight: isBeingProcessed ? 'bold' : 'normal',
                        textAlign: 'center'
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, py: 1 }}>
                        {(() => {
                          const { date, time } = formatDateTimeForHeader(instance.timestamp);
                          return (
                            <>
                              <Typography variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1.1, fontWeight: 'bold' }}>
                                {date}
                              </Typography>
                              <Typography variant="caption" sx={{ fontSize: '0.7rem', lineHeight: 1.1, fontWeight: 'bold' }}>
                                {time}
                              </Typography>
                            </>
                          );
                        })()}
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {measurementKeys.map((measurementKey, rowIndex) => {
                // Get the display name from the first instance that has this measurement
                let displayName = measurementKey;
                for (const instance of flowsheet_instances) {
                  if (instance.measurements[measurementKey]) {
                    displayName = instance.measurements[measurementKey].disp_name || 
                                 instance.measurements[measurementKey].flo_meas_name || 
                                 measurementKey;
                    break;
                  }
                }

                // Check if this measurement is highlighted (used for CAPD scores or other flagged measurements)
                const isHighlighted = displayName.toLowerCase().includes('capd') && highlightedItems.some(item => 
                  typeof item === 'string' && item.includes(measurementKey)
                );

                return (
                  <TableRow key={rowIndex} sx={{ 
                    '&:last-child td, &:last-child th': { border: 0 },
                    backgroundColor: isHighlighted ? 'warning.light' : 'transparent',
                    opacity: isHighlighted ? 0.3 : 1,
                    borderLeft: isHighlighted ? '4px solid' : 'none',
                    borderColor: isHighlighted ? 'warning.main' : undefined,
                    '&:hover': {
                      backgroundColor: isHighlighted ? 'warning.main' : undefined,
                      opacity: isHighlighted ? 0.4 : undefined
                    }
                  }}>
                    <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'inherit' }}>
                      <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayName}
                      </Typography>
                    </TableCell>
                    {flowsheet_instances.map((instance, colIndex) => {
                      const measurement = instance.measurements[measurementKey];
                      const hasComment = measurement?.comment && measurement.comment !== 'No comment' && measurement.comment.trim() !== '';
                      
                      return (
                        <TableCell 
                          key={colIndex} 
                          align="center"
                        >
                          {measurement ? (
                            <Tooltip title={measurement.comment || 'No comment'}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  minWidth: 60,
                                  fontWeight: hasComment ? 'bold' : 'normal',
                                  color: hasComment ? 'warning.main' : 'text.primary'
                                }}
                              >
                                {measurement.value === null || measurement.value === undefined ? 'N/A' : measurement.value}
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.disabled">
                              -
                            </Typography>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <FlowsheetIcon sx={{ fontSize: 30, color: 'icon.main' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" component="h2">
            Flowsheets
          </Typography>
          <Typography variant="body2" color="text.secondary">
            MRN: {mrn} | CSN: {csn}
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
            Processing {processingCount} flowsheet instance{processingCount === 1 ? '' : 's'}...
          </Typography>
        </Box>
      )}
      
      {/* Content */}
      {renderInstanceTable()}
    </Box>
  );
};

export default FlowsheetsInstanceComponent;