import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Chip,
  Collapse,
  IconButton
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { workflowBuilderService, workflowService, datasetsService } from '../../../../services/ApiService';
import PatientSelectionTable from '../PatientSelectionTable';
import ExperimentResultsPatientTable from './ExperimentResultsPatientTable';

const ProjectWorkflowResultsTab = ({ project }) => {
  const [workflowRuns, setWorkflowRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [experimentName, setExperimentName] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [availableWorkflows, setAvailableWorkflows] = useState([]);
  const [executing, setExecuting] = useState(false);
  const [executionError, setExecutionError] = useState(null);
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState(null);
  const [selectedMRNs, setSelectedMRNs] = useState([]);
  const [selectedExperimentName, setSelectedExperimentName] = useState(null);
  const [selectedExperimentDetails, setSelectedExperimentDetails] = useState(null);
  const [experimentLoading, setExperimentLoading] = useState(false);
  const [experimentError, setExperimentError] = useState(null);

  // New state for active experiments
  const [runningExperiments, setRunningExperiments] = useState([]);
  const [completedExperiments, setCompletedExperiments] = useState([]);
  const [activeExpanded, setActiveExpanded] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  useEffect(() => {
    fetchWorkflowRuns();
    fetchAvailableWorkflows();
  }, [project]);

  // Auto-select first completed run when workflow runs are loaded
  useEffect(() => {
    if (completedExperiments.length > 0 && !selectedExperimentName) {
      setSelectedExperimentName(completedExperiments[0].experiment_name);
    }
  }, [completedExperiments]);

  // Fetch experiment details when selection changes
  useEffect(() => {
    if (selectedExperimentName) {
      fetchExperimentDetails(selectedExperimentName);
    }
  }, [selectedExperimentName]);

  const fetchRunningExperiments = async () => {
    try {
      const response = await workflowService.getExperimentsForProject(project.project_name);
      const allExperiments = response.data.workflow_runs || [];

      // Fetch status for each experiment to determine if running or completed
      const experimentsWithStatus = await Promise.all(
        allExperiments.map(async (exp) => {
          try {
            const statusResponse = await workflowService.getExperimentStatus(exp.experiment_name);
            return {
              ...exp,
              statusData: statusResponse.data
            };
          } catch (err) {
            console.error(`Failed to fetch status for ${exp.experiment_name}:`, err);
            return {
              ...exp,
              statusData: { status: 'completed' } // Assume completed on error
            };
          }
        })
      );

      // Separate running and completed experiments
      const running = experimentsWithStatus.filter(exp =>
        exp.statusData.status !== 'completed'
      );
      const completed = experimentsWithStatus.filter(exp =>
        exp.statusData.status === 'completed'
      );

      setRunningExperiments(running);
      setCompletedExperiments(completed);
      setWorkflowRuns(allExperiments); // Keep original list for compatibility
    } catch (err) {
      console.error('Error fetching running experiments:', err);
    }
  };

  const fetchWorkflowRuns = async () => {
    try {
      setLoading(true);
      setError(null);
      await fetchRunningExperiments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load workflow runs');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableWorkflows = async () => {
    try {
      const response = await workflowBuilderService.getAllSavedWorkflows();
      setAvailableWorkflows(response.data.plans || []);
    } catch (err) {
      console.error('Error fetching workflows:', err);
      setAvailableWorkflows([]);
    }
  };

  const fetchExperimentDetails = async (experimentName) => {
    setExperimentLoading(true);
    setExperimentError(null);
    try {
      const response = await workflowService.getExperimentDetails(experimentName);
      setSelectedExperimentDetails(response.data);
    } catch (err) {
      setExperimentError(err.response?.data?.detail || 'Failed to load experiment details');
      setSelectedExperimentDetails(null);
    } finally {
      setExperimentLoading(false);
    }
  };

  const handleOpenDialog = async () => {
    setDialogOpen(true);
    setExperimentName('');
    setSelectedWorkflow('');
    setExecutionError(null);
    setPatientsError(null);

    // Fetch patients if dataset exists
    if (project.dataset) {
      setPatientsLoading(true);
      try {
        const response = await datasetsService.getDatasetPatients(project.dataset);
        const fetchedPatients = response.data.patients || [];
        setPatients(fetchedPatients);
        // Select all patients by default
        setSelectedMRNs(fetchedPatients.map(p => p.mrn));
      } catch (err) {
        setPatientsError(err.response?.data?.detail || 'Failed to load patients');
        setPatients([]);
        setSelectedMRNs([]);
      } finally {
        setPatientsLoading(false);
      }
    }
  };

  const handleCloseDialog = () => {
    if (!executing) {
      setDialogOpen(false);
    }
  };

  const handleRunWorkflow = async () => {
    if (!experimentName.trim() || !selectedWorkflow) {
      setExecutionError('Please enter an experiment name and select a workflow');
      return;
    }

    if (selectedMRNs.length === 0) {
      setExecutionError('Please select at least one patient');
      return;
    }

    try {
      setExecuting(true);
      setExecutionError(null);

      const response = await workflowService.createExperiment(
        project.project_name,
        experimentName.trim(),
        selectedWorkflow,
        selectedMRNs
      );

      // Check if it's async (202) or sync (201) response
      if (response.status === 202) {
        // Async - experiment started in background
        // Refresh running experiments list
        await fetchRunningExperiments();

        // Auto-expand active experiments section
        setActiveExpanded(true);
      } else {
        // Legacy sync response - reload all workflow runs
        await fetchWorkflowRuns();
      }

      // Close dialog
      setDialogOpen(false);
      setExperimentName('');
      setSelectedWorkflow('');
    } catch (err) {
      setExecutionError(err.response?.data?.detail || 'Failed to create experiment');
    } finally {
      setExecuting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const now = new Date();
      const then = new Date(timestamp);
      const diffMs = now - then;
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
      return formatDate(timestamp);
    } catch {
      return timestamp;
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshingStatus(true);
    try {
      await fetchRunningExperiments();
    } catch (err) {
      console.error('Error refreshing status:', err);
    } finally {
      setRefreshingStatus(false);
    }
  };

  return (
    <Box>
      {/* Header with Run Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Workflow Results</Typography>
        <Button
          variant="contained"
          startIcon={<PlayIcon />}
          onClick={handleOpenDialog}
          disabled={!project.dataset}
        >
          Run Workflow
        </Button>
      </Box>

      {!project.dataset && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This project has no dataset assigned. Please assign a dataset to run workflows.
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error State */}
      {error && !loading && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Experiment Selection and Results */}
      {!loading && !error && (
        <>
          {/* Active Experiments Section */}
          {runningExperiments.length > 0 && (
            <Paper variant="outlined" sx={{ mb: 3, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: activeExpanded ? 2 : 0 }}>
                <IconButton
                  onClick={() => setActiveExpanded(!activeExpanded)}
                  size="small"
                  sx={{ mr: 1 }}
                >
                  {activeExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                </IconButton>
                <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                  {runningExperiments.length} experiment{runningExperiments.length > 1 ? 's' : ''} running
                </Typography>
                <IconButton
                  onClick={handleRefreshStatus}
                  size="small"
                  disabled={refreshingStatus}
                >
                  <RefreshIcon sx={{ animation: refreshingStatus ? 'spin 1s linear infinite' : 'none' }} />
                </IconButton>
              </Box>

              <Collapse in={activeExpanded}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {runningExperiments.map((exp) => {
                    const status = exp.statusData?.status || 'unknown';
                    const progress = exp.statusData?.progress || {};
                    const totalFlags = exp.statusData?.total_flags_detected || 0;
                    const startedAt = exp.statusData?.started_at;

                    // Status chip color
                    let statusColor = 'default';
                    if (status === 'running') statusColor = 'primary';
                    else if (status === 'pending') statusColor = 'default';
                    else if (status === 'failed') statusColor = 'error';
                    else if (status === 'partial_complete') statusColor = 'warning';

                    return (
                      <Paper key={exp.experiment_name} variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, flexGrow: 1 }}>
                            {exp.experiment_name}
                          </Typography>
                          <Chip
                            label={status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                            color={statusColor}
                            size="small"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Workflow: {exp.statusData?.workflow_name || exp.workflow_name || 'Unknown'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Progress: {progress.processed_count || 0}/{progress.total_patients || 0} patients
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Flags detected: {totalFlags}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Started: {formatRelativeTime(startedAt)}
                        </Typography>
                      </Paper>
                    );
                  })}
                </Box>
              </Collapse>
            </Paper>
          )}

          {workflowRuns.length === 0 && runningExperiments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                No workflow runs yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Click "Run Workflow" to execute a workflow on this project's dataset
              </Typography>
            </Box>
          ) : (
            <>
              {/* Completed Workflow Runs Section */}
              {completedExperiments.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Completed Workflow Runs
                  </Typography>
                  <FormControl fullWidth sx={{ mb: 3, maxWidth: 500 }}>
                    <InputLabel>Select Workflow Run</InputLabel>
                    <Select
                      value={selectedExperimentName || ''}
                      onChange={(e) => setSelectedExperimentName(e.target.value)}
                      label="Select Workflow Run"
                    >
                      {completedExperiments.map((run) => (
                        <MenuItem key={run.experiment_name} value={run.experiment_name}>
                          {run.experiment_name} - {formatDate(run.run_date)} ({run.patient_count} patients)
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}

              {/* Loading experiment details */}
              {experimentLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              )}

              {/* Error loading experiment details */}
              {experimentError && !experimentLoading && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {experimentError}
                </Alert>
              )}

              {/* Display experiment details */}
              {selectedExperimentDetails && !experimentLoading && !experimentError && (
                <>
                  {/* Metadata banner */}
                  <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'action.hover' }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {selectedExperimentDetails.experiment_name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      <Typography variant="body2" color="text.secondary">
                        Workflow: {selectedExperimentDetails.metadata.workflow_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Date: {formatDate(selectedExperimentDetails.metadata.created_date)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Patients: {selectedExperimentDetails.metadata.total_patients}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Encounters: {selectedExperimentDetails.metadata.total_encounters}
                      </Typography>
                    </Box>
                  </Paper>

                  {/* Patient table */}
                  <ExperimentResultsPatientTable
                    experimentResults={selectedExperimentDetails.results}
                    datasetName={selectedExperimentDetails.metadata.dataset_name}
                    experimentName={selectedExperimentDetails.experiment_name}
                    projectName={project.project_name}
                  />
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Run Workflow Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>Run Workflow on Dataset</DialogTitle>
        <DialogContent>
          {executionError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {executionError}
            </Alert>
          )}

          <TextField
            autoFocus
            margin="dense"
            label="Experiment Name"
            fullWidth
            variant="outlined"
            value={experimentName}
            onChange={(e) => setExperimentName(e.target.value)}
            disabled={executing}
            placeholder="e.g., exp_screening_001"
            sx={{ mb: 2 }}
            helperText="Provide a unique name for this experiment"
          />

          <FormControl fullWidth variant="outlined" disabled={executing} sx={{ mb: 2 }}>
            <InputLabel>Select Workflow</InputLabel>
            <Select
              value={selectedWorkflow}
              onChange={(e) => setSelectedWorkflow(e.target.value)}
              label="Select Workflow"
            >
              {availableWorkflows.length === 0 && (
                <MenuItem disabled>No workflows available</MenuItem>
              )}
              {availableWorkflows.map((workflow) => (
                <MenuItem key={workflow.workflow_name} value={workflow.workflow_name}>
                  {workflow.workflow_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Patient Selection Section */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Select Patients ({selectedMRNs.length} of {patients.length} selected)
            </Typography>

            {patientsLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={30} />
              </Box>
            )}

            {patientsError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {patientsError}
              </Alert>
            )}

            {!patientsLoading && !patientsError && patients.length > 0 && (
              <Box sx={{ maxHeight: '300px', overflow: 'auto', border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <PatientSelectionTable
                  patients={patients}
                  selectedMRNs={selectedMRNs}
                  onSelectionChange={setSelectedMRNs}
                />
              </Box>
            )}
          </Box>

          <Alert severity="info">
            This will run the workflow on the selected patients from dataset ({project.dataset}).
            The process may take several minutes depending on the number of patients.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={executing}>
            Cancel
          </Button>
          <Button
            onClick={handleRunWorkflow}
            variant="contained"
            disabled={executing || !experimentName.trim() || !selectedWorkflow || selectedMRNs.length === 0}
            startIcon={executing ? <CircularProgress size={20} /> : <PlayIcon />}
          >
            {executing ? 'Running...' : 'Run Workflow'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectWorkflowResultsTab;
