import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Grid
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { getPageGradient } from '../App';
import { projectsService } from '../services/ApiService';
import ProjectsSummaryCard from '../components/UI/Projects/ProjectsSummaryCard';
import CreateProjectDialog from '../components/UI/Projects/CreateProjectDialog';

const ProjectsPage = () => {
  const theme = useTheme();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsService.getAllProjects();
      setProjects(response.data.projects || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDialogOpen = () => {
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleProjectCreated = () => {
    fetchProjects(); // Refresh the list
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
            onClick={handleDialogOpen}
          >
            Create Project
          </Button>
        </Box>

        {/* Loading State */}
        {loading && (
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

        {/* Error State */}
        {error && !loading && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Empty State */}
        {!loading && !error && projects.length === 0 && (
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
              onClick={handleDialogOpen}
            >
              Create Project
            </Button>
          </Box>
        )}

        {/* Projects Grid */}
        {!loading && !error && projects.length > 0 && (
          <Grid container spacing={3}>
            {projects.map((project) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.project_name}>
                <ProjectsSummaryCard project={project} />
              </Grid>
            ))}
          </Grid>
        )}

        {/* Create Project Dialog */}
        <CreateProjectDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          onProjectCreated={handleProjectCreated}
        />
      </Container>
    </Box>
  );
};

export default ProjectsPage;