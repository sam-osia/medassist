import React, { useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Typography,
  Collapse,
  Chip
} from '@mui/material';
import {
  KeyboardArrowDown,
  KeyboardArrowUp
} from '@mui/icons-material';
import PatientFlagsExpansion from './PatientFlagsExpansion';

const PatientRow = ({ patient, experimentName, datasetName }) => {
  const [open, setOpen] = useState(false);

  // Compute metrics
  const encountersCount = patient.encounters?.length || 0;
  const totalFlags = patient.encounters?.reduce((total, encounter) => {
    const flags = encounter.flags || {};
    const detectedFlags = Object.entries(flags).filter(
      ([key, flagData]) =>
        !key.endsWith('_threshold') &&
        flagData?.state === true
    ).length;
    return total + detectedFlags;
  }, 0) || 0;

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell align="center">
          <Typography variant="subtitle2" fontWeight="bold">
            {patient.mrn}
          </Typography>
        </TableCell>
        <TableCell align="center">{encountersCount}</TableCell>
        <TableCell align="center">
          <Chip
            label={totalFlags}
            color={totalFlags > 0 ? 'warning' : 'default'}
            size="small"
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <PatientFlagsExpansion
              patient={patient}
              experimentName={experimentName}
              datasetName={datasetName}
            />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const ExperimentResultsPatientTable = ({
  experimentResults,
  datasetName,
  experimentName
}) => {
  const patients = experimentResults?.patients || [];

  if (patients.length === 0) {
    return (
      <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No patient results found for this experiment.
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} elevation={2}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell align="center">
              <Typography variant="subtitle2" fontWeight="bold">MRN</Typography>
            </TableCell>
            <TableCell align="center">
              <Typography variant="subtitle2" fontWeight="bold">Encounters Processed</Typography>
            </TableCell>
            <TableCell align="center">
              <Typography variant="subtitle2" fontWeight="bold">Flags Detected</Typography>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {patients.map((patient) => (
            <PatientRow
              key={patient.mrn}
              patient={patient}
              experimentName={experimentName}
              datasetName={datasetName}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ExperimentResultsPatientTable;
