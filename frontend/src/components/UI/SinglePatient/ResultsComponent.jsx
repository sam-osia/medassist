import React, { useState, useEffect } from 'react';
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
  Divider,
  Button,
  Collapse,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Assessment as ResultsIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Visibility as ViewIcon,
  KeyboardArrowDown,
  KeyboardArrowUp,
  History as HistoryIcon
} from '@mui/icons-material';
import EvidenceNoteViewer from './EvidenceNoteViewer';
import { workflowService } from '../../../services/ApiService';
import { groupResultsByFlag } from '../../../utils/workflowResultsUtils';

// Helper to format date/time consistently
const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
};

// Prevent non-interactive chips from triggering ripple handlers that expect callbacks
const preventChipInteraction = (event) => {
  if (!event) return;
  event.preventDefault();
  event.stopPropagation();
};

// Evidence row components that replicate the table structures from other components
const DiagnosisEvidenceRow = ({ diagnosis }) => {
  return (
    <TableRow sx={{ backgroundColor: (theme) => alpha(theme.palette.warning.light, 0.3), '&:hover': { backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.4) } }}>
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
    <TableRow sx={{ backgroundColor: (theme) => alpha(theme.palette.warning.light, 0.3), '&:hover': { backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.4) } }}>
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
    <TableRow sx={{ backgroundColor: (theme) => alpha(theme.palette.warning.light, 0.3), '&:hover': { backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.4) } }}>
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
              backgroundColor: (theme) => alpha(theme.palette.warning.light, 0.3),
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
    <TableRow sx={{ backgroundColor: (theme) => alpha(theme.palette.warning.light, 0.3), '&:hover': { backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.4) } }}>
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

// Evidence table component that renders the appropriate table based on evidence type
const EvidenceTable = ({ evidenceList, evidenceType, onViewEvidence }) => {
  if (!evidenceList || evidenceList.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
        No evidence available
      </Typography>
    );
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
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 1, mb: 2 }}>
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

// Flag row component for collapsible table
const FlagRow = ({ flagName, flagData, onViewEvidence }) => {
  const [open, setOpen] = useState(false);
  const isPositive = flagData.state;
  const sources = flagData.sources || [];
  
  // Group sources by type
  const sourcesByType = sources.reduce((acc, source) => {
    const type = source.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(source);
    return acc;
  }, {});

  const hasEvidence = isPositive && sources.length > 0;

  return (
    <>
      <TableRow sx={{
        '& > *': { borderBottom: (theme) => `1px solid ${theme.palette.custom.subtleBorder}` },
        backgroundColor: isPositive ? 'custom.warningBackground' : 'transparent',
        '&:hover': { backgroundColor: isPositive ? 'custom.warningHover' : 'custom.tableRowHover' }
      }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
            disabled={!hasEvidence}
            sx={{ 
              visibility: hasEvidence ? 'visible' : 'hidden'
            }}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        
        <TableCell component="th" scope="row">
          <Typography variant="body1" sx={{ 
            fontWeight: isPositive ? 500 : 400,
            color: isPositive ? 'warning.main' : 'text.primary'
          }}>
            {flagName}
          </Typography>
        </TableCell>
        
        <TableCell align="center">
          <Chip 
            label={isPositive ? 'DETECTED' : 'NOT DETECTED'} 
            size="small" 
            color={isPositive ? 'warning' : 'default'}
            variant={isPositive ? 'filled' : 'outlined'}
            clickable={false}
            onClick={preventChipInteraction}
            sx={{
              fontWeight: 500,
              minWidth: 100
            }}
          />
        </TableCell>
        
        <TableCell align="center">
          {hasEvidence ? (
            <Typography variant="body2" color="text.secondary">
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          )}
        </TableCell>
      </TableRow>
      
      {hasEvidence && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 500, color: 'warning.main' }}>
                  Supporting Evidence:
                </Typography>
                
                {Object.entries(sourcesByType).map(([type, evidenceList]) => (
                  <Box key={type} sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ 
                      fontWeight: 500, 
                      mb: 1, 
                      textTransform: 'capitalize',
                      color: 'text.primary'
                    }}>
                      {type} Evidence ({evidenceList.length}):
                    </Typography>
                    <EvidenceTable evidenceList={evidenceList} evidenceType={type} onViewEvidence={onViewEvidence} />
                  </Box>
                ))}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

const ResultsComponent = ({ workflowResults, mrn, csn, patientExperiments = [], initialExperiment }) => {
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [evidenceViewerOpen, setEvidenceViewerOpen] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState(initialExperiment || 'current');
  const [experimentResults, setExperimentResults] = useState(null);
  const [displayedResults, setDisplayedResults] = useState(null);

  // Update displayed results when workflowResults or selectedExperiment changes
  useEffect(() => {
    if (selectedExperiment === 'current') {
      setDisplayedResults(workflowResults);
    } else {
      setDisplayedResults(experimentResults);
    }
  }, [workflowResults, experimentResults, selectedExperiment]);

  // Load experiment results when experiment is selected
  useEffect(() => {
    if (selectedExperiment && selectedExperiment !== 'current') {
      loadExperimentResults(selectedExperiment);
    }
  }, [selectedExperiment, mrn, csn]);

  const loadExperimentResults = async (experimentName) => {
    try {
      const response = await workflowService.getExperimentDetails(experimentName);
      const experiment = response.data;
      const resultsData = experiment.results || {};

      const outputValues = resultsData.output_values || [];
      const outputDefinitions = resultsData.output_definitions || [];

      // Filter values for this patient/encounter
      const patientValues = outputValues.filter(
        v => String(v.metadata?.patient_id) === String(mrn) &&
             String(v.metadata?.encounter_id) === String(csn)
      );

      if (patientValues.length > 0 || outputDefinitions.length > 0) {
        // Set experiment results with full structure for groupResultsByFlag
        setExperimentResults({
          mrn: mrn,
          csn: csn,
          output_definitions: outputDefinitions,
          output_values: patientValues,
          workflow_type: experiment.metadata?.workflow_name || 'unknown',
          completed_time: experiment.metadata?.created_date || new Date().toISOString(),
          experiment_name: experimentName,
          experiment_metadata: experiment.metadata
        });
      } else {
        console.warn('No results found for MRN/CSN:', mrn, csn);
        setExperimentResults(null);
      }
    } catch (error) {
      console.error('Error loading experiment results:', error);
      setExperimentResults(null);
    }
  };
  
  const handleViewEvidence = (evidenceSource) => {
    setSelectedEvidence(evidenceSource);
    setEvidenceViewerOpen(true);
  };
  
  const handleCloseEvidenceViewer = () => {
    setEvidenceViewerOpen(false);
    setSelectedEvidence(null);
  };
  
  // Check if results exist
  const hasResults = displayedResults && (
    displayedResults.output_definitions ||
    displayedResults.output_values
  );
  if (!hasResults) {
    return (
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <ResultsIcon color="action" sx={{ fontSize: 30 }} />
          <Box>
            <Typography variant="h5" component="h2">
              Workflow Results
            </Typography>
            <Typography variant="body2" color="text.secondary">
              MRN: {mrn} | CSN: {csn}
            </Typography>
          </Box>
        </Box>
        
        {/* Experiment Selection Dropdown */}
        {patientExperiments.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth sx={{ maxWidth: 400 }}>
              <InputLabel>Select Results to View</InputLabel>
              <Select
                value={selectedExperiment}
                onChange={(e) => setSelectedExperiment(e.target.value)}
                label="Select Results to View"
                startAdornment={<HistoryIcon sx={{ mr: 1, color: 'text.secondary' }} />}
              >
                <MenuItem value="current">Current Workflow Results</MenuItem>
                {patientExperiments.map((experiment) => (
                  <MenuItem key={experiment.experiment_name} value={experiment.experiment_name}>
                    {experiment.experiment_name} - {formatDateTime(experiment.run_date)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        
        {/* Content */}
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            {selectedExperiment === 'current' 
              ? "No workflow results available. Run a workflow to see results here."
              : "No results found for the selected experiment."
            }
          </Typography>
        </Box>
      </Box>
    );
  }

  // Show loading state while experiment results are being fetched
  if (selectedExperiment !== 'current' && !experimentResults) {
    return (
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <ResultsIcon color="action" sx={{ fontSize: 30 }} />
          <Box>
            <Typography variant="h5" component="h2">
              Workflow Results
            </Typography>
            <Typography variant="body2" color="text.secondary">
              MRN: {mrn} | CSN: {csn}
            </Typography>
          </Box>
        </Box>
        
        {/* Content */}
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            Loading experiment results...
          </Typography>
        </Box>
      </Box>
    );
  }

  // Convert results to grouped flags format for display
  const flags = groupResultsByFlag(displayedResults, mrn, csn);

  const workflowType = displayedResults.workflow_type || 'Unknown';
  const completedTime = displayedResults.completed_time || new Date().toISOString();
  const experimentName = displayedResults.experiment_name;

  // Filter out threshold values and get all flags
  const flagEntries = Object.entries(flags).filter(([key]) => !key.endsWith('_threshold'));

  // Count positive flags
  const positiveFlags = flagEntries.filter(([key, flagData]) => flagData.state).length;
  const totalFlags = flagEntries.length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <ResultsIcon 
          color={positiveFlags > 0 ? 'warning' : 'action'} 
          sx={{ fontSize: 30 }} 
        />
        <Box>
          <Typography variant="h5" component="h2">
            Workflow Results
            <Chip 
              label={`${positiveFlags}/${totalFlags} flags detected`}
              size="small" 
              color={positiveFlags > 0 ? 'warning' : 'default'}
              sx={{ ml: 2 }}
              variant="outlined"
              clickable={false}
              onClick={preventChipInteraction}
            />
            {experimentName && (
              <Chip 
                label={experimentName}
                size="small" 
                color="primary"
                sx={{ ml: 1 }}
                variant="outlined"
                clickable={false}
                onClick={preventChipInteraction}
              />
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            MRN: {mrn} | CSN: {csn} | Workflow: {workflowType} | Completed: {formatDateTime(completedTime)}
          </Typography>
        </Box>
      </Box>
      
      {/* Experiment Selection Dropdown */}
      {patientExperiments.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth sx={{ maxWidth: 400 }}>
            <InputLabel>Select Results to View</InputLabel>
            <Select
              value={selectedExperiment}
              onChange={(e) => setSelectedExperiment(e.target.value)}
              label="Select Results to View"
              startAdornment={<HistoryIcon sx={{ mr: 1, color: 'text.secondary' }} />}
            >
              <MenuItem value="current">Current Workflow Results</MenuItem>
              {patientExperiments.map((experiment) => (
                <MenuItem key={experiment.experiment_name} value={experiment.experiment_name}>
                  {experiment.experiment_name} - {formatDateTime(experiment.run_date)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}
      
      {/* Flags Table */}
      {flagEntries.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No flags configured for this workflow.
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{
          borderRadius: 2,
          border: (theme) => `1px solid ${theme.palette.custom.mediumBorder}`
        }}>
          <Table aria-label="workflow flags table">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell sx={{ width: '50px', border: 'none' }} />
                <TableCell sx={{ border: 'none' }}>
                  <Typography variant="subtitle2" fontWeight={500} color="text.secondary">
                    Flag Name
                  </Typography>
                </TableCell>
                <TableCell align="center" sx={{ width: '140px', border: 'none' }}>
                  <Typography variant="subtitle2" fontWeight={500} color="text.secondary">
                    Status
                  </Typography>
                </TableCell>
                <TableCell align="center" sx={{ width: '120px', border: 'none' }}>
                  <Typography variant="subtitle2" fontWeight={500} color="text.secondary">
                    Evidence
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {flagEntries.map(([flagName, flagData]) => (
                <FlagRow
                  key={flagName}
                  flagName={flagName}
                  flagData={flagData}
                  onViewEvidence={handleViewEvidence}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Evidence Note Viewer */}
      <EvidenceNoteViewer
        open={evidenceViewerOpen}
        onClose={handleCloseEvidenceViewer}
        evidenceData={selectedEvidence}
      />
    </Box>
  );
};

export default ResultsComponent;
