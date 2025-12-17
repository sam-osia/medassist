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
import { planningService } from '../../../services/ApiService';

// Save Plan Dialog Component
export const SavePlanDialog = ({ open, onClose, result, availablePlans, onSaveSuccess, onError, error }) => {
  const [planName, setPlanName] = useState('');
  const [selectedExistingPlan, setSelectedExistingPlan] = useState('');
  const [saveMode, setSaveMode] = useState('new'); // 'new' or 'overwrite'
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const finalPlanName = saveMode === 'new' ? planName : selectedExistingPlan;

    if (!finalPlanName.trim()) {
      onError('Please enter a plan name or select an existing plan');
      return;
    }

    // Validate plan name format
    if (saveMode === 'new' && !finalPlanName.replace('_', '').replace('-', '').replace(/\s/g, '').match(/^[a-zA-Z0-9_-\s]+$/)) {
      onError('Plan name can only contain letters, numbers, spaces, hyphens, and underscores');
      return;
    }

    setSaving(true);
    onError(null);

    try {
      // Convert spaces to underscores for the actual plan name
      const sanitizedPlanName = finalPlanName.trim().replace(/\s+/g, '_');

      await planningService.savePlan(
        sanitizedPlanName,
        result.raw_plan
      );

      onSaveSuccess();
      setPlanName('');
      setSelectedExistingPlan('');
      setSaveMode('new');
    } catch (err) {
      onError(err.response?.data?.detail || 'Error saving plan');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setPlanName('');
    setSelectedExistingPlan('');
    setSaveMode('new');
    onError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Save Plan</DialogTitle>
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
              <label htmlFor="save-new">Save as new plan</label>
            </Box>

            {saveMode === 'new' && (
              <TextField
                autoFocus
                fullWidth
                label="Plan Name"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Enter plan name (e.g., Patient Analysis Workflow)"
                disabled={saving}
                sx={{ ml: 3 }}
              />
            )}

            {availablePlans.length > 0 && (
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
                  <label htmlFor="save-overwrite">Overwrite existing plan</label>
                </Box>

                {saveMode === 'overwrite' && (
                  <FormControl fullWidth sx={{ ml: 3 }}>
                    <InputLabel>Select Plan to Overwrite</InputLabel>
                    <Select
                      value={selectedExistingPlan}
                      onChange={(e) => setSelectedExistingPlan(e.target.value)}
                      disabled={saving}
                      label="Select Plan to Overwrite"
                    >
                      {availablePlans.map((plan) => (
                        <MenuItem key={plan.plan_name} value={plan.plan_name}>
                          {plan.plan_name}
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
          disabled={saving || (!planName.trim() && saveMode === 'new') || (!selectedExistingPlan && saveMode === 'overwrite')}
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {saving ? 'Saving...' : 'Save Plan'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Load Plan Dialog Component
export const LoadPlanDialog = ({ open, onClose, availablePlans, onLoadPlan, onDeletePlan, loading }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Load Plan</DialogTitle>
      <DialogContent>
        {availablePlans.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No saved plans found
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
            {availablePlans.map((plan) => (
              <Card
                key={plan.plan_name}
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
                onClick={() => onLoadPlan(plan.plan_name)}
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
                      {plan.plan_name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block' }}
                    >
                      Created: {new Date(plan.created_date).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
                    <Tooltip title="Delete plan">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePlan(plan.plan_name);
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
