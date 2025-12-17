import React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Typography,
  Stack,
  Box
} from '@mui/material';
import {
  ShowChart as FlowsheetIcon,
  Medication as MedicationIcon,
  Troubleshoot as DiagnosisIcon,
  Description as NoteIcon
} from '@mui/icons-material';

const MetricItem = ({ icon: Icon, count, label, color }) => (
  <Stack
    direction="row"
    alignItems="center"
    spacing={1}
    sx={{
      minWidth: '80px',
    }}
  >
    <Icon fontSize="small" color={color} sx={{ minWidth: '20px' }} />
    <Box sx={{ display: 'flex', minWidth: '60px' }}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          fontFamily: 'monospace',
        }}
      >
        {count.toString().padStart(1, ' ')}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ ml: 0.5 }}
      >
        {label}
      </Typography>
    </Box>
  </Stack>
);

const PatientSelectionRow = ({ patient, isSelected, onToggle }) => {
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
    <TableRow hover>
      <TableCell padding="checkbox">
        <Checkbox
          checked={isSelected}
          onChange={() => onToggle(patient.mrn)}
        />
      </TableCell>
      <TableCell component="th" scope="row" align="center">
        <Typography variant="subtitle2" fontWeight="bold">
          {patient.mrn}
        </Typography>
      </TableCell>
      <TableCell align="center">{patient.sex || 'N/A'}</TableCell>
      <TableCell align="center">{formatDate(patient.date_of_birth)}</TableCell>
      <TableCell align="center">{patient.encounters.length}</TableCell>
      <TableCell align="center">
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          <MetricItem
            icon={NoteIcon}
            count={totalMetrics.notes}
            label="Notes"
            color="icon"
          />
          <MetricItem
            icon={MedicationIcon}
            count={totalMetrics.medications}
            label="Meds"
            color="icon"
          />
          <MetricItem
            icon={FlowsheetIcon}
            count={totalMetrics.flowsheets}
            label="Flow"
            color="icon"
          />
          <MetricItem
            icon={DiagnosisIcon}
            count={totalMetrics.diagnoses}
            label="Diag"
            color="icon"
          />
        </Box>
      </TableCell>
    </TableRow>
  );
};

const PatientSelectionTable = ({ patients, selectedMRNs, onSelectionChange }) => {
  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const allMRNs = patients.map(p => p.mrn);
      onSelectionChange(allMRNs);
    } else {
      onSelectionChange([]);
    }
  };

  const handleTogglePatient = (mrn) => {
    const currentIndex = selectedMRNs.indexOf(mrn);
    const newSelected = [...selectedMRNs];

    if (currentIndex === -1) {
      newSelected.push(mrn);
    } else {
      newSelected.splice(currentIndex, 1);
    }

    onSelectionChange(newSelected);
  };

  const isAllSelected = patients.length > 0 && selectedMRNs.length === patients.length;
  const isSomeSelected = selectedMRNs.length > 0 && selectedMRNs.length < patients.length;

  if (!patients || patients.length === 0) {
    return (
      <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No patients available.
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} elevation={2}>
      <Table aria-label="patient selection table" size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={isSomeSelected}
                checked={isAllSelected}
                onChange={handleSelectAll}
              />
            </TableCell>
            <TableCell align="center"><Typography variant="subtitle2" fontWeight="bold">MRN</Typography></TableCell>
            <TableCell align="center"><Typography variant="subtitle2" fontWeight="bold">Sex</Typography></TableCell>
            <TableCell align="center"><Typography variant="subtitle2" fontWeight="bold">Date of Birth</Typography></TableCell>
            <TableCell align="center"><Typography variant="subtitle2" fontWeight="bold">Encounters</Typography></TableCell>
            <TableCell align="center"><Typography variant="subtitle2" fontWeight="bold">Documents</Typography></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {patients.map((patient) => (
            <PatientSelectionRow
              key={patient.mrn}
              patient={patient}
              isSelected={selectedMRNs.indexOf(patient.mrn) !== -1}
              onToggle={handleTogglePatient}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default PatientSelectionTable;
