import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Label as LabelIcon
} from '@mui/icons-material';
import { annotationsService } from '../../../../services/ApiService';

const SOURCE_OPTIONS = [
  { value: 'note', label: 'Clinical Notes' },
  { value: 'encounter', label: 'Encounters (CSN)' },
  { value: 'medication', label: 'Medications' },
  { value: 'diagnosis', label: 'Diagnoses' }
];

const FIELD_TYPE_OPTIONS = [
  { value: 'boolean', label: 'Boolean (Yes/No)' },
  { value: 'text', label: 'Text' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'categorical', label: 'Categorical (Dropdown)' }
];

const ProjectAnnotationsTab = ({ project }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    source: 'note',
    fields: [{ name: '', type: 'boolean', options: '' }]
  });

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await annotationsService.listGroups(project.project_name);
      setGroups(response.data.groups || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load annotation groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (project?.project_name) {
      fetchGroups();
    }
  }, [project?.project_name]);

  const handleOpenCreate = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      source: 'note',
      fields: [{ name: '', type: 'boolean', options: '' }]
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      source: group.source,
      fields: group.fields.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        options: f.options ? f.options.join(', ') : ''
      }))
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGroup(null);
    setError(null);
  };

  const handleAddField = () => {
    setFormData(prev => ({
      ...prev,
      fields: [...prev.fields, { name: '', type: 'boolean', options: '' }]
    }));
  };

  const handleRemoveField = (index) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index)
    }));
  };

  const handleFieldChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) =>
        i === index ? { ...f, [field]: value } : f
      )
    }));
  };

  const handleSave = async () => {
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Group name is required');
      return;
    }
    if (formData.fields.length === 0) {
      setError('At least one field is required');
      return;
    }
    for (let i = 0; i < formData.fields.length; i++) {
      if (!formData.fields[i].name.trim()) {
        setError(`Field ${i + 1}: name is required`);
        return;
      }
      if (formData.fields[i].type === 'categorical' && !formData.fields[i].options.trim()) {
        setError(`Field ${i + 1}: options are required for categorical fields`);
        return;
      }
    }

    setSaving(true);

    try {
      const groupData = {
        name: formData.name.trim(),
        source: formData.source,
        fields: formData.fields.map(f => ({
          ...(f.id && { id: f.id }),
          name: f.name.trim(),
          type: f.type,
          ...(f.type === 'categorical' && {
            options: f.options.split(',').map(o => o.trim()).filter(o => o)
          })
        }))
      };

      if (editingGroup) {
        await annotationsService.updateGroup(project.project_name, editingGroup.id, groupData);
      } else {
        await annotationsService.createGroup(project.project_name, groupData);
      }

      handleCloseDialog();
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save annotation group');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (group) => {
    setGroupToDelete(group);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!groupToDelete) return;

    try {
      await annotationsService.deleteGroup(project.project_name, groupToDelete.id);
      setDeleteConfirmOpen(false);
      setGroupToDelete(null);
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete annotation group');
    }
  };

  const getSourceLabel = (source) => {
    const option = SOURCE_OPTIONS.find(o => o.value === source);
    return option ? option.label : source;
  };

  const getFieldTypeLabel = (type) => {
    const option = FIELD_TYPE_OPTIONS.find(o => o.value === type);
    return option ? option.label : type;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LabelIcon sx={{ fontSize: 30, color: 'icon.main' }} />
          <Box>
            <Typography variant="h5">Annotation Groups</Typography>
            <Typography variant="body2" color="text.secondary">
              Define annotation schemas for labeling data
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
        >
          Create Group
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Empty State */}
      {groups.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No annotation groups defined
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create an annotation group to start labeling data in this project
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
          >
            Create First Group
          </Button>
        </Paper>
      )}

      {/* Groups Table */}
      {groups.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Source</strong></TableCell>
                <TableCell><strong>Fields</strong></TableCell>
                <TableCell><strong>Annotations</strong></TableCell>
                <TableCell><strong>Created By</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <Typography variant="subtitle2">{group.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getSourceLabel(group.source)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {group.fields.map((field, idx) => (
                        <Chip
                          key={idx}
                          label={`${field.name} (${field.type})`}
                          size="small"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {group.stats?.annotation_count || 0} items
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {group.created_by}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenEdit(group)}
                      title="Edit group"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(group)}
                      color="error"
                      title="Delete group"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingGroup ? 'Edit Annotation Group' : 'Create Annotation Group'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            label="Group Name"
            fullWidth
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            sx={{ mt: 2, mb: 2 }}
            placeholder="e.g., Sepsis Assessment"
          />

          <FormControl fullWidth sx={{ mb: 3 }} disabled={!!editingGroup}>
            <InputLabel>Annotation Source</InputLabel>
            <Select
              value={formData.source}
              onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
              label="Annotation Source"
            >
              {SOURCE_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {editingGroup && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Source cannot be changed after creation
              </Typography>
            )}
          </FormControl>

          <Divider sx={{ mb: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Annotation Fields
          </Typography>

          {formData.fields.map((field, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <TextField
                  label="Field Name"
                  value={field.name}
                  onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  placeholder="e.g., has_sepsis"
                />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={field.type}
                    onChange={(e) => handleFieldChange(index, 'type', e.target.value)}
                    label="Type"
                  >
                    {FIELD_TYPE_OPTIONS.map(option => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  onClick={() => handleRemoveField(index)}
                  disabled={formData.fields.length <= 1}
                  color="error"
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
              {field.type === 'categorical' && (
                <TextField
                  label="Options (comma-separated)"
                  value={field.options}
                  onChange={(e) => handleFieldChange(index, 'options', e.target.value)}
                  size="small"
                  fullWidth
                  sx={{ mt: 2 }}
                  placeholder="e.g., mild, moderate, severe"
                  helperText="Enter dropdown options separated by commas"
                />
              )}
            </Paper>
          ))}

          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddField}
            size="small"
          >
            Add Field
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving && <CircularProgress size={20} />}
          >
            {editingGroup ? 'Save Changes' : 'Create Group'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Annotation Group</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{groupToDelete?.name}"?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            This will permanently delete all {groupToDelete?.stats?.annotation_count || 0} annotations in this group.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectAnnotationsTab;
