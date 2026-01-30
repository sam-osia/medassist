import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  TextField,
  Alert,
  Box,
  Typography,
  Card,
  CardContent,
  Tooltip,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  Save as SaveIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { workflowBuilderService } from '../../../services/ApiService';

// Save Workflow Dialog Component
export const SaveWorkflowDialog = ({ open, onClose, result, availableSavedWorkflows, onSaveSuccess, onError, error }) => {
  const [workflowName, setWorkflowName] = useState('');
  const [selectedExistingWorkflow, setSelectedExistingWorkflow] = useState('');
  const [saveMode, setSaveMode] = useState('new'); // 'new' or 'overwrite'
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const finalWorkflowName = saveMode === 'new' ? workflowName : selectedExistingWorkflow;

    if (!finalWorkflowName.trim()) {
      onError('Please enter a workflow name or select an existing workflow');
      return;
    }

    // Validate workflow name format
    if (saveMode === 'new' && !finalWorkflowName.replace('_', '').replace('-', '').replace(/\s/g, '').match(/^[a-zA-Z0-9_-\s]+$/)) {
      onError('Workflow name can only contain letters, numbers, spaces, hyphens, and underscores');
      return;
    }

    setSaving(true);
    onError(null);

    try {
      // Convert spaces to underscores for the actual workflow name
      const sanitizedWorkflowName = finalWorkflowName.trim().replace(/\s+/g, '_');

      await workflowBuilderService.saveSavedWorkflow(
        sanitizedWorkflowName,
        result.raw_workflow
      );

      onSaveSuccess();
      setWorkflowName('');
      setSelectedExistingWorkflow('');
      setSaveMode('new');
    } catch (err) {
      onError(err.response?.data?.detail || 'Error saving workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setWorkflowName('');
    setSelectedExistingWorkflow('');
    setSaveMode('new');
    onError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Save Workflow</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <FormControl component="fieldset" sx={{ mb: 2, width: '100%' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <input
                type="radio"
                id="save-new"
                name="saveMode"
                value="new"
                checked={saveMode === 'new'}
                onChange={(e) => setSaveMode(e.target.value)}
              />
              <label htmlFor="save-new">Save as new workflow</label>
            </Box>

            {saveMode === 'new' && (
              <TextField
                autoFocus
                fullWidth
                label="Workflow Name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Enter workflow name (e.g., Patient Analysis Workflow)"
                disabled={saving}
                sx={{ ml: 3 }}
              />
            )}

            {availableSavedWorkflows && availableSavedWorkflows.length > 0 && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <input
                    type="radio"
                    id="save-overwrite"
                    name="saveMode"
                    value="overwrite"
                    checked={saveMode === 'overwrite'}
                    onChange={(e) => setSaveMode(e.target.value)}
                  />
                  <label htmlFor="save-overwrite">Overwrite existing workflow</label>
                </Box>

                {saveMode === 'overwrite' && (
                  <FormControl fullWidth sx={{ ml: 3 }}>
                    <InputLabel>Select Workflow to Overwrite</InputLabel>
                    <Select
                      value={selectedExistingWorkflow}
                      onChange={(e) => setSelectedExistingWorkflow(e.target.value)}
                      disabled={saving}
                      label="Select Workflow to Overwrite"
                    >
                      {availableSavedWorkflows.map((workflow) => (
                        <MenuItem key={workflow.workflow_name || workflow.plan_name} value={workflow.workflow_name || workflow.plan_name}>
                          {workflow.workflow_name || workflow.plan_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </>
            )}
          </Box>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || (!workflowName.trim() && saveMode === 'new') || (!selectedExistingWorkflow && saveMode === 'overwrite')}
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {saving ? 'Saving...' : 'Save Workflow'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Load Workflow Dialog Component
export const LoadWorkflowDialog = ({ open, onClose, availableSavedWorkflows, onLoadWorkflow, onDeleteWorkflow, loading }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Load Workflow</DialogTitle>
      <DialogContent>
        {!availableSavedWorkflows || availableSavedWorkflows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No saved workflows found
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
            {availableSavedWorkflows.map((workflow) => (
              <Card
                key={workflow.workflow_name || workflow.plan_name}
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    borderColor: 'primary.main',
                    transform: 'translateY(-1px)',
                    boxShadow: 2
                  }
                }}
                onClick={() => onLoadWorkflow(workflow.workflow_name || workflow.plan_name)}
              >
                <CardContent sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 2,
                  '&:last-child': { pb: 2 }
                }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        mb: 0.5,
                        wordBreak: 'break-word'
                      }}
                    >
                      {workflow.workflow_name || workflow.plan_name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block' }}
                    >
                      Created: {new Date(workflow.created_date).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
                    <Tooltip title="Delete workflow">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteWorkflow(workflow.workflow_name || workflow.plan_name);
                        }}
                        disabled={loading}
                        sx={{
                          opacity: 0.7,
                          '&:hover': {
                            opacity: 1,
                            backgroundColor: 'error.light',
                            color: 'white'
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};
