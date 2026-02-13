import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  Snackbar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Switch,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';
import { usersService, datasetsService, projectsService, apiKeysService } from '../services/ApiService';

const AdminDashboardPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState(0);

  // Users Tab State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // Create/Edit User Dialog State
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    is_admin: false
  });

  // Delete User Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Dataset Access Tab State
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetAccessMap, setDatasetAccessMap] = useState(new Map());
  const [datasetLoadingCells, setDatasetLoadingCells] = useState(new Map());

  // Project Access Tab State
  const [availableProjects, setAvailableProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectAccessMap, setProjectAccessMap] = useState(new Map());
  const [projectLoadingCells, setProjectLoadingCells] = useState(new Map());

  // API Keys Tab State
  const [apiKeys, setApiKeys] = useState([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [keyFormData, setKeyFormData] = useState({ key_name: '', model_name: '', api_key: '' });
  const [availableModels, setAvailableModels] = useState([]);
  const [keyAssignments, setKeyAssignments] = useState([]);
  const [keyAssignmentMap, setKeyAssignmentMap] = useState(new Map());
  const [keyLoadingCells, setKeyLoadingCells] = useState(new Map());

  // Snackbar State
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [error, setError] = useState(null);

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
    fetchAvailableDatasets();
    fetchAvailableProjects();
    fetchApiKeys();
    fetchAvailableModels();
  }, []);

  // Build dataset access map when users or datasets change
  useEffect(() => {
    const map = new Map();
    users.forEach(user => {
      user.allowed_datasets?.forEach(dataset => {
        map.set(`${user.username}:${dataset}`, true);
      });
    });
    setDatasetAccessMap(map);
  }, [users, availableDatasets]);

  // Build project access map when users or projects change
  useEffect(() => {
    const map = new Map();
    availableProjects.forEach(project => {
      // Owner has access
      map.set(`${project.owner}:${project.project_name}`, true);
      // Allowed users have access
      project.allowed_users?.forEach(username => {
        map.set(`${username}:${project.project_name}`, true);
      });
    });
    setProjectAccessMap(map);
  }, [users, availableProjects]);

  // Build key assignment map when assignments change
  useEffect(() => {
    const map = new Map();
    keyAssignments.forEach(a => {
      map.set(`${a.username}:${a.key_id}`, true);
    });
    setKeyAssignmentMap(map);
  }, [keyAssignments]);

  const fetchApiKeys = async () => {
    setApiKeysLoading(true);
    try {
      const [keysRes, assignRes] = await Promise.all([
        apiKeysService.listKeys(),
        apiKeysService.listAssignments()
      ]);
      setApiKeys(keysRes.data.keys || []);
      setKeyAssignments(assignRes.data.assignments || []);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    } finally {
      setApiKeysLoading(false);
    }
  };

  const fetchAvailableModels = async () => {
    try {
      const response = await apiKeysService.listModels();
      setAvailableModels(response.data.models || []);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    setError(null);
    try {
      const response = await usersService.getAllUsers();
      setUsers(response.data.users || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchAvailableDatasets = async () => {
    try {
      const response = await datasetsService.getAllDatasets();
      setAvailableDatasets(response.data.datasets || []);
    } catch (err) {
      console.error('Failed to load datasets:', err);
    }
  };

  const fetchAvailableProjects = async () => {
    try {
      const response = await projectsService.getAllProjects();
      setAvailableProjects(response.data.projects || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  // User CRUD Functions
  const handleOpenCreateDialog = () => {
    setEditingUser(null);
    setUserFormData({
      username: '',
      password: '',
      confirmPassword: '',
      is_admin: false
    });
    setUserDialogOpen(true);
  };

  const handleOpenEditDialog = (user) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      password: '',
      confirmPassword: '',
      is_admin: user.is_admin || false
    });
    setUserDialogOpen(true);
  };

  const handleCloseUserDialog = () => {
    setUserDialogOpen(false);
    setEditingUser(null);
    setUserFormData({
      username: '',
      password: '',
      confirmPassword: '',
      is_admin: false
    });
  };

  const handleUserFormChange = (field, value) => {
    setUserFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveUser = async () => {
    // Validation
    if (!editingUser && !userFormData.username) {
      setSnackbar({ open: true, message: 'Username is required', severity: 'error' });
      return;
    }

    if (!editingUser && !userFormData.password) {
      setSnackbar({ open: true, message: 'Password is required', severity: 'error' });
      return;
    }

    if (!editingUser && userFormData.password !== userFormData.confirmPassword) {
      setSnackbar({ open: true, message: 'Passwords do not match', severity: 'error' });
      return;
    }

    if (editingUser && userFormData.password && userFormData.password !== userFormData.confirmPassword) {
      setSnackbar({ open: true, message: 'Passwords do not match', severity: 'error' });
      return;
    }

    try {
      if (editingUser) {
        // Update user
        const updateData = {
          is_admin: userFormData.is_admin
        };
        if (userFormData.password) {
          updateData.password = userFormData.password;
        }
        await usersService.updateUser(editingUser.username, updateData);
        setSnackbar({ open: true, message: `User '${editingUser.username}' updated successfully`, severity: 'success' });
      } else {
        // Create user
        await usersService.createUser({
          username: userFormData.username,
          password: userFormData.password,
          is_admin: userFormData.is_admin,
          allowed_datasets: []
        });
        setSnackbar({ open: true, message: `User '${userFormData.username}' created successfully`, severity: 'success' });
      }
      handleCloseUserDialog();
      fetchUsers();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to save user',
        severity: 'error'
      });
    }
  };

  const handleOpenDeleteDialog = (user) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const handleDeleteUser = async () => {
    try {
      await usersService.deleteUser(userToDelete.username);
      setSnackbar({ open: true, message: `User '${userToDelete.username}' deleted successfully`, severity: 'success' });
      handleCloseDeleteDialog();
      fetchUsers();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to delete user',
        severity: 'error'
      });
    }
  };

  // Dataset Access Functions
  const handleDatasetAccessToggle = async (username, datasetName) => {
    const key = `${username}:${datasetName}`;
    const hasAccess = datasetAccessMap.get(key) || false;

    setDatasetLoadingCells(prev => new Map(prev).set(key, true));

    try {
      if (hasAccess) {
        await usersService.revokeDatasetAccess(username, datasetName);
        setSnackbar({
          open: true,
          message: `Revoked access to '${datasetName}' for user '${username}'`,
          severity: 'success'
        });
      } else {
        await usersService.grantDatasetAccess(username, datasetName);
        setSnackbar({
          open: true,
          message: `Granted access to '${datasetName}' for user '${username}'`,
          severity: 'success'
        });
      }

      const newMap = new Map(datasetAccessMap);
      if (hasAccess) {
        newMap.delete(key);
      } else {
        newMap.set(key, true);
      }
      setDatasetAccessMap(newMap);
      fetchUsers();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to update dataset access',
        severity: 'error'
      });
    } finally {
      setDatasetLoadingCells(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    }
  };

  // Project Access Functions
  const handleProjectAccessToggle = async (username, projectName, projectOwner) => {
    if (projectOwner === username) {
      setSnackbar({
        open: true,
        message: 'Cannot remove project owner from project',
        severity: 'error'
      });
      return;
    }

    const key = `${username}:${projectName}`;
    const hasAccess = projectAccessMap.get(key) || false;

    setProjectLoadingCells(prev => new Map(prev).set(key, true));

    try {
      if (hasAccess) {
        await usersService.removeUserFromProject(username, projectName);
        setSnackbar({
          open: true,
          message: `Removed user '${username}' from project '${projectName}'`,
          severity: 'success'
        });
      } else {
        await usersService.addUserToProject(username, projectName);
        setSnackbar({
          open: true,
          message: `Added user '${username}' to project '${projectName}'`,
          severity: 'success'
        });
      }

      const newMap = new Map(projectAccessMap);
      if (hasAccess) {
        newMap.delete(key);
      } else {
        newMap.set(key, true);
      }
      setProjectAccessMap(newMap);
      fetchUsers();
      fetchAvailableProjects();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to update project access',
        severity: 'error'
      });
    } finally {
      setProjectLoadingCells(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    }
  };

  // API Key CRUD Functions
  const handleOpenKeyDialog = (key = null) => {
    setEditingKey(key);
    setKeyFormData(key
      ? { key_name: key.key_name, model_name: key.model_name, api_key: '' }
      : { key_name: '', model_name: '', api_key: '' }
    );
    setKeyDialogOpen(true);
  };

  const handleCloseKeyDialog = () => {
    setKeyDialogOpen(false);
    setEditingKey(null);
    setKeyFormData({ key_name: '', model_name: '', api_key: '' });
  };

  const handleSaveKey = async () => {
    if (!keyFormData.key_name || !keyFormData.api_key || !keyFormData.model_name) {
      if (!editingKey && (!keyFormData.key_name || !keyFormData.api_key || !keyFormData.model_name)) {
        setSnackbar({ open: true, message: 'All fields are required', severity: 'error' });
        return;
      }
    }

    try {
      if (editingKey) {
        const updateData = {};
        if (keyFormData.key_name && keyFormData.key_name !== editingKey.key_name) {
          updateData.key_name = keyFormData.key_name;
        }
        if (keyFormData.api_key) {
          updateData.api_key = keyFormData.api_key;
        }
        await apiKeysService.updateKey(editingKey.key_id, updateData);
        setSnackbar({ open: true, message: `Key '${keyFormData.key_name}' updated`, severity: 'success' });
      } else {
        await apiKeysService.createKey({
          key_name: keyFormData.key_name,
          model_name: keyFormData.model_name,
          api_key: keyFormData.api_key
        });
        setSnackbar({ open: true, message: `Key '${keyFormData.key_name}' created`, severity: 'success' });
      }
      handleCloseKeyDialog();
      fetchApiKeys();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to save key', severity: 'error' });
    }
  };

  const handleDeleteKey = async (key) => {
    if (!window.confirm(`Delete key "${key.key_name}"? This will also remove all user assignments.`)) return;
    try {
      await apiKeysService.deleteKey(key.key_id);
      setSnackbar({ open: true, message: `Key '${key.key_name}' deleted`, severity: 'success' });
      fetchApiKeys();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to delete key', severity: 'error' });
    }
  };

  const handleKeyAssignmentToggle = async (username, keyId) => {
    const cellKey = `${username}:${keyId}`;
    const hasAccess = keyAssignmentMap.get(cellKey) || false;

    setKeyLoadingCells(prev => new Map(prev).set(cellKey, true));

    try {
      if (hasAccess) {
        await apiKeysService.unassignKey(username, keyId);
        setSnackbar({ open: true, message: `Unassigned key from '${username}'`, severity: 'success' });
      } else {
        await apiKeysService.assignKey(username, keyId);
        setSnackbar({ open: true, message: `Assigned key to '${username}'`, severity: 'success' });
      }

      const newMap = new Map(keyAssignmentMap);
      if (hasAccess) { newMap.delete(cellKey); } else { newMap.set(cellKey, true); }
      setKeyAssignmentMap(newMap);
      fetchApiKeys();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to update key assignment', severity: 'error' });
    } finally {
      setKeyLoadingCells(prev => { const m = new Map(prev); m.delete(cellKey); return m; });
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: theme.pageGradient,
        py: 4
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Admin Dashboard
          </Typography>
        </Box>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
            <Tab label="Users" />
            <Tab label="Dataset Access" />
            <Tab label="Project Access" />
            <Tab label="API Keys" />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        {currentTab === 0 && (
          <Paper sx={{ p: 3 }}>
            {/* Users Tab */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">User Management</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenCreateDialog}
              >
                Create User
              </Button>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {usersLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell>Admin</TableCell>
                      <TableCell>Datasets</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.username}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>
                          {user.is_admin && <Chip label="Admin" color="primary" size="small" />}
                        </TableCell>
                        <TableCell>{user.allowed_datasets?.length || 0}</TableCell>
                        <TableCell>
                          {user.created_date ? new Date(user.created_date).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEditDialog(user)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDeleteDialog(user)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        )}

        {currentTab === 1 && (
          <Paper sx={{ p: 3 }}>
            {/* Dataset Access Tab */}
            <Typography variant="h6" sx={{ mb: 3 }}>Dataset Access Management</Typography>

            {usersLoading || datasetsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : users.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
                No users found. Create users in the Users tab.
              </Typography>
            ) : availableDatasets.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
                No datasets available.
              </Typography>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Scroll horizontally to see all {availableDatasets.length} datasets
                </Typography>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table sx={{ minWidth: 650 }} size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1, fontWeight: 'bold' }}>
                          Username
                        </TableCell>
                        {availableDatasets.map(dataset => (
                          <TableCell key={dataset.dataset_name} align="center">
                            {dataset.dataset_name}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.map(user => (
                        <TableRow key={user.username} hover>
                          <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', fontWeight: 'medium' }}>
                            {user.username}
                            {user.is_admin && <Chip label="Admin" size="small" color="primary" sx={{ ml: 1 }} />}
                          </TableCell>
                          {availableDatasets.map(dataset => (
                            <TableCell key={dataset.dataset_name} align="center">
                              {datasetLoadingCells.get(`${user.username}:${dataset.dataset_name}`) ? (
                                <CircularProgress size={20} />
                              ) : (
                                <Switch
                                  checked={datasetAccessMap.get(`${user.username}:${dataset.dataset_name}`) || false}
                                  onChange={() => handleDatasetAccessToggle(user.username, dataset.dataset_name)}
                                  size="small"
                                />
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Paper>
        )}

        {currentTab === 2 && (
          <Paper sx={{ p: 3 }}>
            {/* Project Access Tab */}
            <Typography variant="h6" sx={{ mb: 3 }}>Project Access Management</Typography>

            {usersLoading || projectsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : users.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
                No users found. Create users in the Users tab.
              </Typography>
            ) : availableProjects.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
                No projects available.
              </Typography>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Scroll horizontally to see all {availableProjects.length} projects
                </Typography>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table sx={{ minWidth: 650 }} size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1, fontWeight: 'bold' }}>
                          Username
                        </TableCell>
                        {availableProjects.map(project => (
                          <TableCell key={project.project_name} align="center">
                            {project.project_name}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.map(user => (
                        <TableRow key={user.username} hover>
                          <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', fontWeight: 'medium' }}>
                            {user.username}
                            {user.is_admin && <Chip label="Admin" size="small" color="primary" sx={{ ml: 1 }} />}
                          </TableCell>
                          {availableProjects.map(project => (
                            <TableCell key={project.project_name} align="center">
                              {projectLoadingCells.get(`${user.username}:${project.project_name}`) ? (
                                <CircularProgress size={20} />
                              ) : (
                                <Tooltip title={project.owner === user.username ? "Cannot remove project owner" : ""}>
                                  <span>
                                    <Switch
                                      checked={projectAccessMap.get(`${user.username}:${project.project_name}`) || false}
                                      onChange={() => handleProjectAccessToggle(user.username, project.project_name, project.owner)}
                                      disabled={project.owner === user.username}
                                      size="small"
                                    />
                                  </span>
                                </Tooltip>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Paper>
        )}

        {currentTab === 3 && (
          <Paper sx={{ p: 3 }}>
            {/* API Keys Tab */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">API Key Registration</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenKeyDialog()}>
                Register Key
              </Button>
            </Box>

            {apiKeysLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : apiKeys.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
                No API keys registered yet.
              </Typography>
            ) : (
              <TableContainer sx={{ mb: 4 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Key Name</TableCell>
                      <TableCell>Model</TableCell>
                      <TableCell>Provider</TableCell>
                      <TableCell>API Key</TableCell>
                      <TableCell>Created By</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.key_id}>
                        <TableCell>{key.key_name}</TableCell>
                        <TableCell>{key.model_name}</TableCell>
                        <TableCell><Chip label={key.provider} size="small" /></TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{key.api_key}</TableCell>
                        <TableCell>{key.created_by}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleOpenKeyDialog(key)} color="primary"><EditIcon /></IconButton>
                          <IconButton size="small" onClick={() => handleDeleteKey(key)} color="error"><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Key Assignment Matrix */}
            {apiKeys.length > 0 && users.length > 0 && (
              <>
                <Typography variant="h6" sx={{ mb: 2 }}>Key Assignments</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Toggle which API keys each user can access
                </Typography>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table sx={{ minWidth: 650 }} size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1, fontWeight: 'bold' }}>
                          Username
                        </TableCell>
                        {apiKeys.map(key => (
                          <TableCell key={key.key_id} align="center">
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{key.key_name}</Typography>
                              <Typography variant="caption" color="text.secondary">{key.model_name}</Typography>
                            </Box>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.map(user => (
                        <TableRow key={user.username} hover>
                          <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', fontWeight: 'medium' }}>
                            {user.username}
                            {user.is_admin && <Chip label="Admin" size="small" color="primary" sx={{ ml: 1 }} />}
                          </TableCell>
                          {apiKeys.map(key => (
                            <TableCell key={key.key_id} align="center">
                              {keyLoadingCells.get(`${user.username}:${key.key_id}`) ? (
                                <CircularProgress size={20} />
                              ) : (
                                <Switch
                                  checked={keyAssignmentMap.get(`${user.username}:${key.key_id}`) || false}
                                  onChange={() => handleKeyAssignmentToggle(user.username, key.key_id)}
                                  size="small"
                                />
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Paper>
        )}

        {/* Register/Edit Key Dialog */}
        <Dialog open={keyDialogOpen} onClose={handleCloseKeyDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{editingKey ? 'Edit Key' : 'Register API Key'}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Key Name"
                value={keyFormData.key_name}
                onChange={(e) => setKeyFormData(prev => ({ ...prev, key_name: e.target.value }))}
                fullWidth
                required
                helperText="A unique, human-readable name for this key"
              />
              {!editingKey && (
                <FormControl fullWidth required>
                  <InputLabel>Model</InputLabel>
                  <Select
                    value={keyFormData.model_name}
                    label="Model"
                    onChange={(e) => setKeyFormData(prev => ({ ...prev, model_name: e.target.value }))}
                  >
                    {availableModels.map(m => (
                      <MenuItem key={m.model_name} value={m.model_name}>
                        {m.display_name} ({m.provider})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <TextField
                label={editingKey ? 'New API Key (leave blank to keep current)' : 'API Key'}
                type="password"
                value={keyFormData.api_key}
                onChange={(e) => setKeyFormData(prev => ({ ...prev, api_key: e.target.value }))}
                fullWidth
                required={!editingKey}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseKeyDialog}>Cancel</Button>
            <Button onClick={handleSaveKey} variant="contained">
              {editingKey ? 'Update' : 'Register'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create/Edit User Dialog */}
        <Dialog open={userDialogOpen} onClose={handleCloseUserDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingUser ? 'Edit User' : 'Create User'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Username"
                value={userFormData.username}
                onChange={(e) => handleUserFormChange('username', e.target.value)}
                disabled={!!editingUser}
                fullWidth
                required
              />
              <TextField
                label={editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                type="password"
                value={userFormData.password}
                onChange={(e) => handleUserFormChange('password', e.target.value)}
                fullWidth
                required={!editingUser}
              />
              <TextField
                label="Confirm Password"
                type="password"
                value={userFormData.confirmPassword}
                onChange={(e) => handleUserFormChange('confirmPassword', e.target.value)}
                fullWidth
                required={!editingUser || !!userFormData.password}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={userFormData.is_admin}
                    onChange={(e) => handleUserFormChange('is_admin', e.target.checked)}
                  />
                }
                label="Admin User"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseUserDialog}>Cancel</Button>
            <Button onClick={handleSaveUser} variant="contained">
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete User Dialog */}
        <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
          <DialogTitle>Delete User</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete user '{userToDelete?.username}'?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
            <Button onClick={handleDeleteUser} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
};

export default AdminDashboardPage;
