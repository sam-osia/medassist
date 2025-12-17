import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Collapse,
  IconButton,
  Chip,
  Divider,
  Grid,
  Button
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  LocalHospital as HospitalIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import EncounterCard from './EncounterCard';

const PatientCard = ({ patient }) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const handleViewPatient = () => {
    navigate(`/patient/${patient.mrn}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getTotalEncounterMetrics = () => {
    return patient.encounters.reduce((totals, encounter) => {
      const metrics = encounter.metrics || {};
      return {
        flowsheets: totals.flowsheets + (metrics.flowsheet_count || 0),
        medications: totals.medications + (metrics.medication_count || 0),
        diagnoses: totals.diagnoses + (metrics.diagnosis_count || 0),
        notes: totals.notes + (metrics.note_count || 0)
      };
    }, { flowsheets: 0, medications: 0, diagnoses: 0, notes: 0 });
  };

  const totalMetrics = getTotalEncounterMetrics();

  return (
    <Card elevation={2} sx={{ mb: 2 }}>
      <CardContent>
        {/* Patient Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PersonIcon color="primary" sx={{ fontSize: 30 }} />
            <Box>
              <Typography variant="h6" component="h2">
                MRN: {patient.mrn}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {patient.encounters.length} encounter{patient.encounters.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ViewIcon />}
              onClick={handleViewPatient}
              size="small"
            >
              View
            </Button>
            <IconButton
              onClick={handleExpandClick}
              sx={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease'
              }}
              aria-expanded={expanded}
              aria-label="show encounters"
            >
              <ExpandMoreIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Patient Summary */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon fontSize="small" color="action" />
              <Typography variant="body2">
                <strong>Sex:</strong> {patient.sex || 'N/A'}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon fontSize="small" color="action" />
              <Typography variant="body2">
                <strong>DOB:</strong> {formatDate(patient.date_of_birth)}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HospitalIcon fontSize="small" color="action" />
              <Typography variant="body2">
                <strong>Encounters:</strong> {patient.encounters.length}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2">
              <strong>Total Records:</strong> {totalMetrics.flowsheets + totalMetrics.medications + totalMetrics.diagnoses + totalMetrics.notes}
            </Typography>
          </Grid>
        </Grid>

        {/* Summary Metrics */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            label={`${totalMetrics.flowsheets} Flowsheets`} 
            variant="outlined" 
            size="small" 
            color="primary"
          />
          <Chip 
            label={`${totalMetrics.medications} Medications`} 
            variant="outlined" 
            size="small" 
            color="secondary"
          />
          <Chip 
            label={`${totalMetrics.diagnoses} Diagnoses`} 
            variant="outlined" 
            size="small" 
            color="success"
          />
          <Chip 
            label={`${totalMetrics.notes} Notes`} 
            variant="outlined" 
            size="small" 
            color="info"
          />
        </Box>
      </CardContent>

      {/* Expandable Encounters Section */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        <CardContent sx={{ pt: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Encounters ({patient.encounters.length})
          </Typography>
          
          {patient.encounters.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No encounters found for this patient.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {patient.encounters.map((encounter) => (
                <EncounterCard 
                  key={encounter.csn} 
                  encounter={encounter} 
                  patientMrn={patient.mrn}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default PatientCard;
