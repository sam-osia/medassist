import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Grid,
  Stack,
  Button
} from '@mui/material';
import {
  ShowChart as FlowsheetIcon,
  Medication as MedicationIcon,
  Troubleshoot as DiagnosisIcon,
  Description as NoteIcon,
  Check as CheckIcon,
  Edit as EditIcon
} from '@mui/icons-material';

const MetricItem = ({ icon: Icon, count, label, color }) => (
  <Stack
    direction="row"
    alignItems="center"
    spacing={1}
    sx={{
      minWidth: '80px', // Ensure consistent width for all metric items
    }}
  >
    <Icon fontSize="small" color={color} sx={{ minWidth: '20px' }} />
    <Box sx={{ display: 'flex', minWidth: '60px' }}> {/* Combined width for number + label */}
      <Typography 
        variant="body2" 
        sx={{ 
          fontWeight: 500,
          fontFamily: 'monospace', // Use monospace for consistent number width
        }}
      >
        {count.toString().padStart(1, ' ')}
      </Typography>
      <Typography 
        variant="caption" 
        color="text.secondary"
        sx={{ ml: 0.5 }} // Small gap between number and label
      >
        {label}
      </Typography>
    </Box>
  </Stack>
);

const EncounterCard = ({
  encounter,
  metrics: metricsProp,
  patientMrn,
  annotationMode = false,
  isAnnotated = false,
  onAnnotateClick
}) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const handleAnnotateClick = (e) => {
    e.stopPropagation(); // Prevent RadioGroup selection
    e.preventDefault();
    if (onAnnotateClick) {
      onAnnotateClick();
    }
  };

  const metrics = metricsProp || encounter.metrics || {};
  const totalRecords = (metrics.flowsheet_count || 0) +
                      (metrics.medication_count || 0) +
                      (metrics.diagnosis_count || 0) +
                      (metrics.note_count || 0);

  return (
    <Card
      variant="outlined"
      sx={{
        border: (theme) => `1px solid ${theme.palette.divider}`,
        '&:hover': {
          boxShadow: 1,
          borderColor: 'primary.main'
        },
        transition: 'all 0.2s ease',
        width: '100%'
      }}
    >
      <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={annotationMode ? 2 : 2.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              CSN: {encounter.csn}
            </Typography>
          </Grid>

          <Grid item xs={annotationMode ? 1.6 : 1.9}>
            <MetricItem
              icon={NoteIcon}
              count={metrics.note_count || 0}
              label="Notes"
              color="icon"
            />
          </Grid>

          <Grid item xs={annotationMode ? 1.6 : 1.9}>
            <MetricItem
              icon={MedicationIcon}
              count={metrics.medication_count || 0}
              label="Meds"
              color="icon"
            />
          </Grid>

          <Grid item xs={annotationMode ? 1.6 : 1.9}>
            <MetricItem
              icon={FlowsheetIcon}
              count={metrics.flowsheet_count || 0}
              label="Flow"
              color="icon"
            />
          </Grid>

          <Grid item xs={annotationMode ? 1.6 : 1.9}>
            <MetricItem
              icon={DiagnosisIcon}
              count={metrics.diagnosis_count || 0}
              label="Diag"
              color="icon"
            />
          </Grid>

          <Grid item xs={annotationMode ? 1.6 : 1.9}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Chip
                label={`${totalRecords} Total`}
                size="small"
                color="primary"
                variant="filled"
                sx={{ height: 20, fontSize: '0.75rem' }}
              />
            </Box>
          </Grid>

          {annotationMode && (
            <Grid item xs={2}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant={isAnnotated ? 'outlined' : 'contained'}
                  color={isAnnotated ? 'success' : 'primary'}
                  startIcon={isAnnotated ? <CheckIcon /> : <EditIcon />}
                  onClick={handleAnnotateClick}
                >
                  {isAnnotated ? 'Edit' : 'Annotate'}
                </Button>
              </Box>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default EncounterCard;
