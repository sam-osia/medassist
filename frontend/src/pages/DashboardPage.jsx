import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Grid,
  Divider
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { datasetsService, projectsService } from '../services/ApiService';
import DatasetsSummaryCard from '../components/UI/Datasets/DatasetsSummaryCard';
import CreateDatasetDialog from '../components/UI/Datasets/CreateDatasetDialog';
import ProjectsSummaryCard from '../components/UI/Projects/ProjectsSummaryCard';
import CreateProjectDialog from '../components/UI/Projects/CreateProjectDialog';

const DashboardPage = () => {
  const theme = useTheme();

  // Datasets state
  const [datasets, setDatasets] = useState([]);
  const [datasetsLoading, setDatasetsLoading] = useState(true);
  const [datasetsError, setDatasetsError] = useState(null);
  const [datasetsDialogOpen, setDatasetsDialogOpen] = useState(false);

  // Projects state
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(null);
  const [projectsDialogOpen, setProjectsDialogOpen] = useState(false);

  // Fetch datasets
  const fetchDatasets = async () => {
    setDatasetsLoading(true);
    setDatasetsError(null);
    try {
      const response = await datasetsService.getAllDatasets();
      setDatasets(response.data.datasets || []);
    } catch (err) {
      setDatasetsError(err.response?.data?.detail || 'Failed to load datasets');
    } finally {
      setDatasetsLoading(false);
    }
  };

  // Fetch projects
  const fetchProjects = async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const response = await projectsService.getAllProjects();
      setProjects(response.data.projects || []);
    } catch (err) {
      setProjectsError(err.response?.data?.detail || 'Failed to load projects');
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
    fetchProjects();
  }, []);

  // Datasets dialog handlers
  const handleDatasetsDialogOpen = () => {
    setDatasetsDialogOpen(true);
  };

  const handleDatasetsDialogClose = () => {
    setDatasetsDialogOpen(false);
  };

  const handleDatasetCreated = () => {
    fetchDatasets();
  };

  // Projects dialog handlers
  const handleProjectsDialogOpen = () => {
    setProjectsDialogOpen(true);
  };

  const handleProjectsDialogClose = () => {
    setProjectsDialogOpen(false);
  };

  const handleProjectCreated = () => {
    fetchProjects();
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
        {/* Datasets Section */}
        <Box sx={{ mb: 6 }}>
          {/* Datasets Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 4
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              Datasets
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleDatasetsDialogOpen}
            >
              Create Dataset
            </Button>
          </Box>

          {/* Datasets Loading State */}
          {datasetsLoading && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '200px'
              }}
            >
              <CircularProgress />
            </Box>
          )}

          {/* Datasets Error State */}
          {datasetsError && !datasetsLoading && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {datasetsError}
            </Alert>
          )}

          {/* Datasets Empty State */}
          {!datasetsLoading && !datasetsError && datasets.length === 0 && (
            <Box
              sx={{
                textAlign: 'center',
                py: 8
              }}
            >
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No datasets available
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                There are currently no datasets to display
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleDatasetsDialogOpen}
              >
                Create Dataset
              </Button>
            </Box>
          )}

          {/* Datasets Grid */}
          {!datasetsLoading && !datasetsError && datasets.length > 0 && (
            <Grid container spacing={3}>
              {datasets.map((dataset) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={dataset.dataset_name}>
                  <DatasetsSummaryCard dataset={dataset} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {/* Divider */}
        <Divider sx={{ my: 6 }} />

        {/* Projects Section */}
        <Box>
          {/* Projects Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 4
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              Projects
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleProjectsDialogOpen}
            >
              Create Project
            </Button>
          </Box>

          {/* Projects Loading State */}
          {projectsLoading && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '200px'
              }}
            >
              <CircularProgress />
            </Box>
          )}

          {/* Projects Error State */}
          {projectsError && !projectsLoading && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {projectsError}
            </Alert>
          )}

          {/* Projects Empty State */}
          {!projectsLoading && !projectsError && projects.length === 0 && (
            <Box
              sx={{
                textAlign: 'center',
                py: 8
              }}
            >
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No projects yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create your first project to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleProjectsDialogOpen}
              >
                Create Project
              </Button>
            </Box>
          )}

          {/* Projects Grid */}
          {!projectsLoading && !projectsError && projects.length > 0 && (
            <Grid container spacing={3}>
              {projects.map((project) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.project_name}>
                  <ProjectsSummaryCard project={project} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {/* Dialogs */}
        <CreateDatasetDialog
          open={datasetsDialogOpen}
          onClose={handleDatasetsDialogClose}
          onDatasetCreated={handleDatasetCreated}
        />
        <CreateProjectDialog
          open={projectsDialogOpen}
          onClose={handleProjectsDialogClose}
          onProjectCreated={handleProjectCreated}
        />
      </Container>
    </Box>
  );
};

export default DashboardPage;
