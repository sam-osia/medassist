import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { projectsService, datasetsService, usersService } from '../../../services/ApiService';
import { useAuth } from '../../../contexts/AuthProvider';

const CreateProjectDialog = ({ mode = 'create', initialProject = null, open, onClose, onProjectCreated }) => {
  const { user: username } = useAuth();
  const [formData, setFormData] = useState({
    project_name: '',
    summary: '',
    description: '',
    dataset: ''
  });

  const [contacts, setContacts] = useState([]);
  const [references, setReferences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (open) {
        try {
          const [datasetsResponse, usersResponse] = await Promise.all([
            datasetsService.getAllDatasets(),
            usersService.getAllUsers()
          ]);
          setDatasets(datasetsResponse.data.datasets || []);
          setUsers(usersResponse.data.users || []);
        } catch (err) {
          console.error('Failed to fetch data:', err);
          setDatasets([]);
          setUsers([]);
        }
      }
    };

    fetchData();
  }, [open]);

  // Pre-fill form data in edit mode
  useEffect(() => {
    if (mode === 'edit' && initialProject && open) {
      setFormData({
        project_name: initialProject.project_name || '',
        summary: initialProject.summary || '',
        description: initialProject.description || '',
        dataset: initialProject.dataset || ''
      });
      setContacts(initialProject.contacts || []);
      setReferences(initialProject.references || []);
      setSelectedMembers(initialProject.allowed_users || []);
    } else if (mode === 'create' && open) {
      // Reset form in create mode
      setFormData({
        project_name: '',
        summary: '',
        description: '',
        dataset: ''
      });
      setContacts([]);
      setReferences([]);
      setSelectedMembers([]);
    }
  }, [mode, initialProject, open, username]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addContact = () => {
    setContacts([...contacts, { name: '', role: '', email: '' }]);
  };

  const removeContact = (index) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const updateContact = (index, field, value) => {
    const updatedContacts = [...contacts];
    updatedContacts[index][field] = value;
    setContacts(updatedContacts);
  };

  const addReference = () => {
    setReferences([...references, '']);
  };

  const removeReference = (index) => {
    setReferences(references.filter((_, i) => i !== index));
  };

  const updateReference = (index, value) => {
    const updatedReferences = [...references];
    updatedReferences[index] = value;
    setReferences(updatedReferences);
  };

  const handleCreate = async () => {
    setError(null);

    // Validation
    if (mode === 'create' && !formData.project_name) {
      setError('Project name is required');
      return;
    }
    if (!formData.summary) {
      setError('Summary is required');
      return;
    }

    // Validate contacts (all fields must be filled if contact exists)
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      if (!contact.name || !contact.role || !contact.email) {
        setError(`Contact ${i + 1}: All fields (name, role, email) are required`);
        return;
      }
    }

    // Filter out empty references
    const validReferences = references.filter(ref => ref.trim() !== '');

    setLoading(true);

    try {
      if (mode === 'create') {
        const projectData = {
          project_name: formData.project_name,
          summary: formData.summary,
          description: formData.description,
          dataset: formData.dataset || null,
          contacts: contacts,
          references: validReferences,
          allowed_users: selectedMembers
        };

        await projectsService.createProject(projectData);
      } else {
        // mode === 'edit'
        const updateData = {
          summary: formData.summary,
          description: formData.description,
          dataset: formData.dataset || null,
          contacts: contacts,
          references: validReferences,
          allowed_users: selectedMembers
        };

        await projectsService.updateProject(formData.project_name, updateData);
      }

      // Reset form
      setFormData({
        project_name: '',
        summary: '',
        description: '',
        dataset: ''
      });
      setContacts([]);
      setReferences([]);
      setSelectedMembers([]);

      // Notify parent and close
      if (onProjectCreated) {
        onProjectCreated();
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${mode} project`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>{mode === 'create' ? 'Create New Project' : 'Edit Project'}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Basic Information */}
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
          Basic Information
        </Typography>

        <TextField
          label="Project Name"
          fullWidth
          required
          value={formData.project_name}
          onChange={(e) => handleInputChange('project_name', e.target.value)}
          sx={{ mb: 2 }}
          helperText={mode === 'create' ? "Use only letters, numbers, hyphens, and underscores" : "Project name cannot be changed"}
          disabled={mode === 'edit'}
        />

        <TextField
          label="Summary"
          fullWidth
          required
          multiline
          rows={2}
          value={formData.summary}
          onChange={(e) => handleInputChange('summary', e.target.value)}
          sx={{ mb: 2 }}
        />

        <TextField
          label="Description"
          fullWidth
          multiline
          rows={4}
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          sx={{ mb: 2 }}
        />

        <Divider sx={{ my: 3 }} />

        {/* References Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            References
          </Typography>

          {references.map((reference, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                gap: 1,
                mb: 2,
                alignItems: 'center'
              }}
            >
              <TextField
                label="Reference URL"
                value={reference}
                onChange={(e) => updateReference(index, e.target.value)}
                size="small"
                fullWidth
              />
              <IconButton
                onClick={() => removeReference(index)}
                color="error"
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}

          <Button
            startIcon={<AddIcon />}
            onClick={addReference}
            variant="outlined"
            size="small"
          >
            Add Reference
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Contacts Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Contacts
          </Typography>

          {contacts.map((contact, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                gap: 1,
                mb: 2,
                alignItems: 'flex-start'
              }}
            >
              <TextField
                label="Name"
                value={contact.name}
                onChange={(e) => updateContact(index, 'name', e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Role"
                value={contact.role}
                onChange={(e) => updateContact(index, 'role', e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Email"
                value={contact.email}
                onChange={(e) => updateContact(index, 'email', e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <IconButton
                onClick={() => removeContact(index)}
                color="error"
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}

          <Button
            startIcon={<AddIcon />}
            onClick={addContact}
            variant="outlined"
            size="small"
          >
            Add Contact
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Dataset */}
        <FormControl fullWidth>
          <InputLabel>Dataset</InputLabel>
          <Select
            value={formData.dataset}
            onChange={(e) => handleInputChange('dataset', e.target.value)}
            label="Dataset"
            disabled={datasets.length === 0}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {datasets.map((dataset) => (
              <MenuItem key={dataset.dataset_name} value={dataset.dataset_name}>
                {dataset.dataset_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Divider sx={{ my: 3 }} />

        {/* Project Members */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Project Members (Optional)
          </Typography>
          <Box sx={{
            maxHeight: 200,
            overflowY: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 1
          }}>
            {users.filter(user => user.username !== username).length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                No other users available
              </Typography>
            ) : (
              users
                .filter(user => user.username !== username)
                .map((user) => (
                  <FormControlLabel
                    key={user.username}
                    control={
                      <Checkbox
                        checked={selectedMembers.includes(user.username)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMembers([...selectedMembers, user.username]);
                          } else {
                            setSelectedMembers(selectedMembers.filter(u => u !== user.username));
                          }
                        }}
                      />
                    }
                    label={user.username}
                  />
                ))
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {mode === 'create' ? 'Create Project' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateProjectDialog;