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
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { getPageGradient } from '../App';
import { useAuth } from '../contexts/AuthProvider';
import { usersService, datasetsService, projectsService } from '../services/ApiService';

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
  const [selectedUserForDataset, setSelectedUserForDataset] = useState('');
  const [userDatasets, setUserDatasets] = useState([]);
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [selectedDatasetToGrant, setSelectedDatasetToGrant] = useState('');
  const [datasetsLoading, setDatasetsLoading] = useState(false);

  // Project Access Tab State
  const [selectedUserForProject, setSelectedUserForProject] = useState('');
  const [userProjects, setUserProjects] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [selectedProjectToGrant, setSelectedProjectToGrant] = useState('');
  const [projectsLoading, setProjectsLoading] = useState(false);

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
  }, []);

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
  const handleUserSelectForDataset = async (username) => {
    setSelectedUserForDataset(username);
    if (username) {
      setDatasetsLoading(true);
      try {
        const response = await usersService.getUserDatasets(username);
        setUserDatasets(response.data.datasets || []);
      } catch (err) {
        setSnackbar({
          open: true,
          message: err.response?.data?.detail || 'Failed to load user datasets',
          severity: 'error'
        });
      } finally {
        setDatasetsLoading(false);
      }
    } else {
      setUserDatasets([]);
    }
  };

  const handleGrantDatasetAccess = async () => {
    if (!selectedUserForDataset || !selectedDatasetToGrant) {
      setSnackbar({ open: true, message: 'Please select a user and dataset', severity: 'error' });
      return;
    }

    try {
      await usersService.grantDatasetAccess(selectedUserForDataset, selectedDatasetToGrant);
      setSnackbar({
        open: true,
        message: `Granted access to '${selectedDatasetToGrant}' for user '${selectedUserForDataset}'`,
        severity: 'success'
      });
      setSelectedDatasetToGrant('');
      handleUserSelectForDataset(selectedUserForDataset); // Refresh datasets
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to grant dataset access',
        severity: 'error'
      });
    }
  };

  const handleRevokeDatasetAccess = async (datasetName) => {
    try {
      await usersService.revokeDatasetAccess(selectedUserForDataset, datasetName);
      setSnackbar({
        open: true,
        message: `Revoked access to '${datasetName}' for user '${selectedUserForDataset}'`,
        severity: 'success'
      });
      handleUserSelectForDataset(selectedUserForDataset); // Refresh datasets
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to revoke dataset access',
        severity: 'error'
      });
    }
  };

  // Project Access Functions
  const handleUserSelectForProject = async (username) => {
    setSelectedUserForProject(username);
    if (username) {
      setProjectsLoading(true);
      try {
        const response = await usersService.getUserProjects(username);
        setUserProjects(response.data.projects || []);
      } catch (err) {
        setSnackbar({
          open: true,
          message: err.response?.data?.detail || 'Failed to load user projects',
          severity: 'error'
        });
      } finally {
        setProjectsLoading(false);
      }
    } else {
      setUserProjects([]);
    }
  };

  const handleGrantProjectAccess = async () => {
    if (!selectedUserForProject || !selectedProjectToGrant) {
      setSnackbar({ open: true, message: 'Please select a user and project', severity: 'error' });
      return;
    }

    try {
      await usersService.addUserToProject(selectedUserForProject, selectedProjectToGrant);
      setSnackbar({
        open: true,
        message: `Added user '${selectedUserForProject}' to project '${selectedProjectToGrant}'`,
        severity: 'success'
      });
      setSelectedProjectToGrant('');
      handleUserSelectForProject(selectedUserForProject); // Refresh projects
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to grant project access',
        severity: 'error'
      });
    }
  };

  const handleRevokeProjectAccess = async (projectName) => {
    try {
      await usersService.removeUserFromProject(selectedUserForProject, projectName);
      setSnackbar({
        open: true,
        message: `Removed user '${selectedUserForProject}' from project '${projectName}'`,
        severity: 'success'
      });
      handleUserSelectForProject(selectedUserForProject); // Refresh projects
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to revoke project access',
        severity: 'error'
      });
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: getPageGradient(theme),
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

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select User</InputLabel>
                  <Select
                    value={selectedUserForDataset}
                    onChange={(e) => handleUserSelectForDataset(e.target.value)}
                    label="Select User"
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {users.map((user) => (
                      <MenuItem key={user.username} value={user.username}>
                        {user.username} {user.is_admin && '(Admin)'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {selectedUserForDataset && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Current Datasets</Typography>
                    {datasetsLoading ? (
                      <CircularProgress size={24} />
                    ) : userDatasets.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {userDatasets.map((dataset) => (
                          <Chip
                            key={dataset}
                            label={dataset}
                            onDelete={() => handleRevokeDatasetAccess(dataset)}
                            color="primary"
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No datasets assigned
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Grant Access</Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <FormControl sx={{ flex: 1 }}>
                        <InputLabel>Select Dataset</InputLabel>
                        <Select
                          value={selectedDatasetToGrant}
                          onChange={(e) => setSelectedDatasetToGrant(e.target.value)}
                          label="Select Dataset"
                        >
                          {availableDatasets.map((dataset) => (
                            <MenuItem key={dataset.dataset_name} value={dataset.dataset_name}>
                              {dataset.dataset_name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        variant="contained"
                        onClick={handleGrantDatasetAccess}
                        disabled={!selectedDatasetToGrant}
                      >
                        Grant Access
                      </Button>
                    </Box>
                  </Grid>
                </>
              )}
            </Grid>
          </Paper>
        )}

        {currentTab === 2 && (
          <Paper sx={{ p: 3 }}>
            {/* Project Access Tab */}
            <Typography variant="h6" sx={{ mb: 3 }}>Project Access Management</Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select User</InputLabel>
                  <Select
                    value={selectedUserForProject}
                    onChange={(e) => handleUserSelectForProject(e.target.value)}
                    label="Select User"
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {users.map((user) => (
                      <MenuItem key={user.username} value={user.username}>
                        {user.username} {user.is_admin && '(Admin)'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {selectedUserForProject && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Current Projects</Typography>
                    {projectsLoading ? (
                      <CircularProgress size={24} />
                    ) : userProjects.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {userProjects.map((project) => (
                          <Chip
                            key={project.project_name}
                            label={`${project.project_name} ${project.owner === selectedUserForProject ? '(Owner)' : ''}`}
                            onDelete={project.owner !== selectedUserForProject ? () => handleRevokeProjectAccess(project.project_name) : undefined}
                            color="primary"
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No projects assigned
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Grant Access</Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <FormControl sx={{ flex: 1 }}>
                        <InputLabel>Select Project</InputLabel>
                        <Select
                          value={selectedProjectToGrant}
                          onChange={(e) => setSelectedProjectToGrant(e.target.value)}
                          label="Select Project"
                        >
                          {availableProjects.map((project) => (
                            <MenuItem key={project.project_name} value={project.project_name}>
                              {project.project_name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        variant="contained"
                        onClick={handleGrantProjectAccess}
                        disabled={!selectedProjectToGrant}
                      >
                        Grant Access
                      </Button>
                    </Box>
                  </Grid>
                </>
              )}
            </Grid>
          </Paper>
        )}

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
