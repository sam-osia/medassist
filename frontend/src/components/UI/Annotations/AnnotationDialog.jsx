import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  CircularProgress,
  Paper,
  Chip,
  Alert
} from '@mui/material';
import AnnotationForm from './AnnotationForm';

// Item Preview Components
const NotePreview = ({ item }) => (
  <Box>
    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
      <Chip label={item.note_type || 'Note'} size="small" color="primary" variant="outlined" />
      {item.service && <Chip label={item.service} size="small" variant="outlined" />}
    </Box>
    <Typography variant="body2" color="text.secondary" gutterBottom>
      <strong>Author:</strong> {item.author || 'Unknown'}
    </Typography>
    <Typography variant="body2" color="text.secondary" gutterBottom>
      <strong>Created:</strong> {item.create_datetime ? new Date(item.create_datetime).toLocaleString() : 'N/A'}
    </Typography>
    <Divider sx={{ my: 2 }} />
    <Typography variant="subtitle2" gutterBottom>Note Text:</Typography>
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        maxHeight: 300,
        overflow: 'auto',
        backgroundColor: 'grey.50'
      }}
    >
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {item.note_text || 'No content available'}
      </Typography>
    </Paper>
  </Box>
);

const EncounterPreview = ({ item }) => (
  <Box>
    <Typography variant="h6" gutterBottom>
      CSN: {item.csn}
    </Typography>
    {item.metrics && (
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
        <Chip label={`${item.metrics.note_count || 0} Notes`} size="small" />
        <Chip label={`${item.metrics.medication_count || 0} Medications`} size="small" />
        <Chip label={`${item.metrics.flowsheet_count || 0} Flowsheets`} size="small" />
        <Chip label={`${item.metrics.diagnosis_count || 0} Diagnoses`} size="small" />
      </Box>
    )}
  </Box>
);

const MedicationPreview = ({ item }) => (
  <Box>
    <Typography variant="h6" gutterBottom>
      {item.medication_name || item.order_display_name || 'Unknown Medication'}
    </Typography>
    {item.simple_generic_name && (
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Generic: {item.simple_generic_name}
      </Typography>
    )}
    <Divider sx={{ my: 2 }} />
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2">
        <strong>Dosage:</strong> {item.dosage_given_amount} {item.dosage_given_unit}
      </Typography>
      <Typography variant="body2">
        <strong>Route:</strong> {item.medication_route || 'N/A'}
      </Typography>
      <Typography variant="body2">
        <strong>Frequency:</strong> {item.dosing_frequency || 'N/A'}
      </Typography>
      <Typography variant="body2">
        <strong>Admin Time:</strong> {item.admin_datetime ? new Date(item.admin_datetime).toLocaleString() : 'N/A'}
      </Typography>
      <Typography variant="body2">
        <strong>Action:</strong> {item.admin_action || 'N/A'}
      </Typography>
    </Box>
  </Box>
);

const DiagnosisPreview = ({ item }) => (
  <Box>
    <Typography variant="h6" gutterBottom>
      {item.diagnosis_name || 'Unknown Diagnosis'}
    </Typography>
    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
      {item.diagnosis_code && (
        <Chip label={item.diagnosis_code} size="small" color="primary" variant="outlined" />
      )}
      {item.code_set && (
        <Chip label={item.code_set} size="small" variant="outlined" />
      )}
      <Chip
        label={item.is_chronic ? 'Chronic' : 'Acute'}
        size="small"
        color={item.is_chronic ? 'warning' : 'default'}
      />
    </Box>
    <Divider sx={{ my: 2 }} />
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2">
        <strong>Source:</strong> {item.diagnosis_source || 'N/A'}
      </Typography>
      <Typography variant="body2">
        <strong>Date:</strong> {item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}
      </Typography>
      <Typography variant="body2">
        <strong>Status:</strong> {item.resolved_date ? `Resolved ${new Date(item.resolved_date).toLocaleDateString()}` : 'Active'}
      </Typography>
    </Box>
  </Box>
);

const ItemPreview = ({ item, sourceType }) => {
  if (!item) return null;

  switch (sourceType) {
    case 'note':
      return <NotePreview item={item} />;
    case 'encounter':
      return <EncounterPreview item={item} />;
    case 'medication':
      return <MedicationPreview item={item} />;
    case 'diagnosis':
      return <DiagnosisPreview item={item} />;
    default:
      return (
        <Typography color="text.secondary">
          Unknown source type: {sourceType}
        </Typography>
      );
  }
};

const AnnotationDialog = ({
  open,
  onClose,
  item,
  sourceType,
  group,
  existingValues,
  onSave
}) => {
  const [formValues, setFormValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Initialize form values when dialog opens or existing values change
  useEffect(() => {
    if (open) {
      setFormValues(existingValues?.values || {});
      setError(null);
      setSaving(false);
    }
  }, [open, existingValues]);

  const handleFieldChange = (fieldId, value) => {
    setFormValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(formValues);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save annotation');
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { minHeight: '60vh' } }}
    >
      <DialogTitle>
        Annotate: {group?.name || 'Annotation'}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
          {/* Left: Item Preview */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Item Details
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <ItemPreview item={item} sourceType={sourceType} />
            </Paper>
          </Box>

          {/* Divider */}
          <Divider orientation="vertical" flexItem />

          {/* Right: Annotation Form */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Annotation Fields
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <AnnotationForm
                fields={group?.fields || []}
                values={formValues}
                onChange={handleFieldChange}
              />
            </Paper>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving && <CircularProgress size={20} />}
        >
          {saving ? 'Saving...' : 'Save Annotation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AnnotationDialog;
