import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Divider
} from '@mui/material';
import { Visibility as ViewIcon } from '@mui/icons-material';
import EvidenceNoteViewer from '../../SinglePatient/EvidenceNoteViewer';

// Helper to format date/time consistently
const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
};

// Evidence row components
const DiagnosisEvidenceRow = ({ diagnosis }) => {
  return (
    <TableRow sx={{ backgroundColor: 'warning.light', opacity: 0.3, '&:hover': { backgroundColor: 'warning.main', opacity: 0.4 } }}>
      <TableCell>{diagnosis.diagnosis_id || 'N/A'}</TableCell>
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
      <TableCell>{formatDateTime(diagnosis.date)}</TableCell>
      <TableCell>
        <Typography variant="body2">
          {diagnosis.is_chronic ? 'Chronic' : 'Acute'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {diagnosis.resolved_date ? `Resolved ${formatDateTime(diagnosis.resolved_date)}` : 'Active'}
        </Typography>
      </TableCell>
    </TableRow>
  );
};

const MedicationEvidenceRow = ({ medication }) => {
  return (
    <TableRow sx={{ backgroundColor: 'warning.light', opacity: 0.3, '&:hover': { backgroundColor: 'warning.main', opacity: 0.4 } }}>
      <TableCell>{medication.order_id || 'N/A'}</TableCell>
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

const NoteEvidenceRow = ({ evidenceSource, onViewEvidence }) => {
  const note = evidenceSource.details;

  return (
    <TableRow sx={{ backgroundColor: 'warning.light', opacity: 0.3, '&:hover': { backgroundColor: 'warning.main', opacity: 0.4 } }}>
      <TableCell>{note.note_id || 'N/A'}</TableCell>
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
          variant="outlined"
          size="small"
          startIcon={<ViewIcon />}
          onClick={() => onViewEvidence(evidenceSource)}
          sx={{
            color: 'warning.dark',
            borderColor: 'warning.main',
            '&:hover': {
              backgroundColor: 'warning.light',
              opacity: 0.3,
              borderColor: 'warning.main'
            }
          }}
        >
          View Evidence
        </Button>
      </TableCell>
    </TableRow>
  );
};

const FlowsheetEvidenceRow = ({ flowsheetData }) => {
  const instance = flowsheetData.flowsheet_instance;
  const analysisInputs = flowsheetData.analysis_inputs;

  // Find CAPD score if available
  const capdScore = Object.values(instance.measurements || {}).find(
    measurement => measurement.flo_meas_name === 'SK IP R CAPD TOTAL SCORE'
  );

  return (
    <TableRow sx={{ backgroundColor: 'warning.light', opacity: 0.3, '&:hover': { backgroundColor: 'warning.main', opacity: 0.4 } }}>
      <TableCell>
        <Typography variant="body2">
          {formatDateTime(instance.timestamp)}
        </Typography>
      </TableCell>
      <TableCell>
        {capdScore ? (
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'error.main' }}>
            CAPD Score: {capdScore.value}
          </Typography>
        ) : (
          <Typography variant="body2">
            Multiple measurements
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Box>
          <Typography variant="caption" display="block">
            Sensory Deficit: {analysisInputs.sensory_deficit ? 'Yes' : 'No'}
          </Typography>
          <Typography variant="caption" display="block">
            Motor Deficit: {analysisInputs.motor_deficit ? 'Yes' : 'No'}
          </Typography>
          <Typography variant="caption" display="block">
            Developmental Delay: {analysisInputs.developmental_delay ? 'Yes' : 'No'}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          Flowsheet Analysis
        </Typography>
      </TableCell>
    </TableRow>
  );
};

// Evidence table component
const EvidenceTable = ({ evidenceList, evidenceType, onViewEvidence }) => {
  if (!evidenceList || evidenceList.length === 0) {
    return null;
  }

  const renderTableHeaders = () => {
    switch (evidenceType) {
      case 'diagnosis':
        return (
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
        );
      case 'medications':
        return (
          <TableRow sx={{ backgroundColor: 'action.hover' }}>
            <TableCell><strong>Order ID</strong></TableCell>
            <TableCell><strong>Medication Name</strong></TableCell>
            <TableCell><strong>Generic Name</strong></TableCell>
            <TableCell><strong>Dosage Given</strong></TableCell>
            <TableCell><strong>Route</strong></TableCell>
            <TableCell><strong>Frequency</strong></TableCell>
            <TableCell><strong>Admin Time</strong></TableCell>
            <TableCell><strong>Action</strong></TableCell>
          </TableRow>
        );
      case 'note':
        return (
          <TableRow sx={{ backgroundColor: 'action.hover' }}>
            <TableCell><strong>Note ID</strong></TableCell>
            <TableCell><strong>Note Type</strong></TableCell>
            <TableCell><strong>Service</strong></TableCell>
            <TableCell><strong>Author</strong></TableCell>
            <TableCell><strong>Created</strong></TableCell>
            <TableCell><strong>Action</strong></TableCell>
          </TableRow>
        );
      case 'flowsheet':
        return (
          <TableRow sx={{ backgroundColor: 'action.hover' }}>
            <TableCell><strong>Timestamp</strong></TableCell>
            <TableCell><strong>Key Measurements</strong></TableCell>
            <TableCell><strong>Analysis Conditions</strong></TableCell>
            <TableCell><strong>Type</strong></TableCell>
          </TableRow>
        );
      default:
        return null;
    }
  };

  const renderEvidenceRow = (evidence, index) => {
    switch (evidenceType) {
      case 'diagnosis':
        return <DiagnosisEvidenceRow key={index} diagnosis={evidence.details} />;
      case 'medications':
        return <MedicationEvidenceRow key={index} medication={evidence.details} />;
      case 'note':
        return <NoteEvidenceRow key={index} evidenceSource={evidence} onViewEvidence={onViewEvidence} />;
      case 'flowsheet':
        return <FlowsheetEvidenceRow key={index} flowsheetData={evidence.details} />;
      default:
        return null;
    }
  };

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
      <Table size="small">
        <TableHead>
          {renderTableHeaders()}
        </TableHead>
        <TableBody>
          {evidenceList.map((evidence, index) => renderEvidenceRow(evidence, index))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const PatientFlagsExpansion = ({ patient, experimentName, datasetName }) => {
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [evidenceViewerOpen, setEvidenceViewerOpen] = useState(false);

  const handleViewEvidence = (evidenceSource) => {
    setSelectedEvidence(evidenceSource);
    setEvidenceViewerOpen(true);
  };

  const handleCloseEvidenceViewer = () => {
    setEvidenceViewerOpen(false);
    setSelectedEvidence(null);
  };

  const encounters = patient.encounters || [];

  return (
    <Box sx={{ p: 2 }}>
      {encounters.map((encounter, encounterIndex) => {
        const flags = encounter.flags || {};

        // Filter to only detected flags
        const detectedFlags = Object.entries(flags).filter(
          ([key, flagData]) => !key.endsWith('_threshold') && flagData?.state === true
        );

        return (
          <Box key={encounter.csn} sx={{ mb: encounterIndex < encounters.length - 1 ? 3 : 0 }}>
            {/* Encounter header if multiple encounters */}
            {encounters.length > 1 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 500 }}>
                  Encounter CSN: {encounter.csn}
                </Typography>
                <Divider sx={{ mt: 1 }} />
              </Box>
            )}

            {/* No flags detected message */}
            {detectedFlags.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body1" color="text.secondary">
                  No flags detected for this encounter
                </Typography>
              </Box>
            ) : (
              /* Display each detected flag */
              detectedFlags.map(([flagName, flagData]) => {
                // Group sources by type
                const sources = flagData.sources || [];
                const sourcesByType = sources.reduce((acc, source) => {
                  const type = source.type;
                  if (!acc[type]) acc[type] = [];
                  acc[type].push(source);
                  return acc;
                }, {});

                return (
                  <Paper key={flagName} variant="outlined" sx={{ mb: 2, p: 2, borderLeft: '4px solid', borderColor: 'warning.main' }}>
                    {/* Flag header */}
                    <Typography variant="h6" sx={{ mb: 2, color: 'warning.main', fontWeight: 600 }}>
                      🚩 {flagName}
                    </Typography>

                    {/* Evidence by type */}
                    {Object.keys(sourcesByType).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No evidence sources available
                      </Typography>
                    ) : (
                      Object.entries(sourcesByType).map(([type, evidenceList]) => (
                        <Box key={type} sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500, textTransform: 'capitalize' }}>
                            {type} Evidence ({evidenceList.length}):
                          </Typography>
                          <EvidenceTable
                            evidenceList={evidenceList}
                            evidenceType={type}
                            onViewEvidence={handleViewEvidence}
                          />
                        </Box>
                      ))
                    )}
                  </Paper>
                );
              })
            )}
          </Box>
        );
      })}

      {/* Evidence Note Viewer */}
      <EvidenceNoteViewer
        open={evidenceViewerOpen}
        onClose={handleCloseEvidenceViewer}
        evidenceData={selectedEvidence}
      />
    </Box>
  );
};

export default PatientFlagsExpansion;
