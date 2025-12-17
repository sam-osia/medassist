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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Tooltip
} from '@mui/material';
import {
  Assignment as FlowsheetIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

const FlowsheetsComponent = ({ flowsheets_pivot, mrn, csn }) => {
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const renderPivotTable = () => {
    if (!flowsheets_pivot || !flowsheets_pivot.measurements || flowsheets_pivot.measurements.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No flowsheet data available for pivot table view.
          </Typography>
        </Box>
      );
    }

    const { measurements, time_points, metadata } = flowsheets_pivot;
    
    return (
      <Box>
        {/* Pivot Table Summary */}
        <Box sx={{ mb: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <Typography variant="body2">
                <strong>Measurements:</strong> {metadata.total_measurements}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="body2">
                <strong>Time Points:</strong> {metadata.total_time_points}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="body2">
                <strong>Total Readings:</strong> {metadata.total_readings}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="body2">
                <strong>Period:</strong> {formatDateTime(metadata.admission_date)} - {formatDateTime(metadata.discharge_date)}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Pivot Table */}
        <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 150, position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 5 }}>
                  <strong>Display Name</strong>
                </TableCell>
                {time_points.map((timePoint, index) => (
                  <TableCell key={index} sx={{ minWidth: 100, writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
                      {timePoint.formatted}
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {measurements.map((measurement, rowIndex) => (
                <TableRow key={rowIndex} sx={{ 
                  '&:nth-of-type(odd)': { backgroundColor: 'grey.200' },
                  '&:nth-of-type(even)': { backgroundColor: 'white' }
                }}>
                  <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'inherit' }}>
                    <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {measurement.disp_name || 'N/A'}
                    </Typography>
                  </TableCell>
                  {time_points.map((timePoint, colIndex) => {
                    const timeKey = timePoint.timestamp;
                    const cellData = measurement.time_values[timeKey];
                    const hasComment = cellData?.comment && cellData.comment !== 'No comment' && cellData.comment.trim() !== '';
                    return (
                      <TableCell key={colIndex} align="center">
                        {cellData ? (
                          <Tooltip title={cellData.comment || 'No comment'}>
                            <Chip
                              label={cellData.value === null || cellData.value === undefined ? 'N/A' : cellData.value}
                              size="small"
                              color={hasComment ? "warning" : "secondary"}
                              variant="filled"
                              sx={{ minWidth: 60 }}
                            />
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <Accordion 
      defaultExpanded 
      sx={{ border: '1px solid #e0e0e0' }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{ backgroundColor: 'grey.50' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FlowsheetIcon color="primary" sx={{ fontSize: 30 }} />
          <Box>
            <Typography variant="h5" component="h2">
              Flowsheets
            </Typography>
            <Typography variant="body2" color="text.secondary">
              MRN: {mrn} | CSN: {csn}
            </Typography>
          </Box>
        </Box>
      </AccordionSummary>
      
      <AccordionDetails sx={{ p: 2 }}>
        {renderPivotTable()}
      </AccordionDetails>
    </Accordion>
  );
};

export default FlowsheetsComponent;
