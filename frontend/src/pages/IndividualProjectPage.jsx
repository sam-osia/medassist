import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Tabs,
  Tab,
  IconButton,
  Paper
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CalendarToday as CalendarIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { projectsService } from '../services/ApiService';
import ProjectDescriptionTab from '../components/UI/Projects/ProjectsPage/ProjectDescriptionTab';
import ProjectDatasetTab from '../components/UI/Projects/ProjectsPage/ProjectDatasetTab';
import ProjectAnnotationsTab from '../components/UI/Projects/ProjectsPage/ProjectAnnotationsTab';
import ProjectWorkflowResultsTab from '../components/UI/Projects/ProjectsPage/ProjectWorkflowResultsTab';
import ProjectEvaluationsTab from '../components/UI/Projects/ProjectsPage/ProjectEvaluationsTab';
import ProjectFinancialsTab from '../components/UI/Projects/ProjectsPage/ProjectFinancialsTab';
import CreateProjectDialog from '../components/UI/Projects/CreateProjectDialog';
import BreadcrumbNav from '../components/UI/Common/BreadcrumbNav';
import { useAuth } from '../contexts/AuthProvider';

const IndividualProjectPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { projectName } = useParams();
  const { user, isAdmin } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await projectsService.getProjectDetails(projectName);
        setProject(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectName]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const handleBack = () => {
    navigate('/projects');
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleProjectUpdated = () => {
    setDialogOpen(false);
    window.location.reload();
  };

  const canEdit = project && (user === project.owner || isAdmin);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: theme.pageGradient,
        py: 4
      }}
    >
      <Container maxWidth="lg">
        {/* Breadcrumbs */}
        <BreadcrumbNav
          breadcrumbs={[
            { label: 'Projects', path: '/projects' },
            { label: projectName }
          ]}
        />

        {/* Loading State */}
        {loading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '400px'
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {/* Error State */}
        {error && !loading && (
          <Alert severity="error">{error}</Alert>
        )}

        {/* Project Details */}
        {project && !loading && !error && (
          <>
            {/* Header with Project Name */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                {project.project_name}
              </Typography>
              {canEdit && (
                <IconButton
                  onClick={() => setDialogOpen(true)}
                  size="small"
                  sx={{ ml: 1 }}
                >
                  <EditIcon />
                </IconButton>
              )}
            </Box>

            {/* Tabs */}
            <Paper elevation={2} sx={{ mb: 3 }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={handleTabChange}>
                  <Tab label="Description" />
                  <Tab label="Dataset" />
                  <Tab label="Annotations" />
                  <Tab label="Workflows" />
                  <Tab label="Evaluations" />
                  <Tab label="Financials" />
                </Tabs>
              </Box>

              {/* Tab Panels */}
              <Box sx={{ p: 2 }}>
                {tabValue === 0 && <ProjectDescriptionTab project={project} onEditClick={() => setDialogOpen(true)} />}
                {tabValue === 1 && <ProjectDatasetTab project={project} />}
                {tabValue === 2 && <ProjectAnnotationsTab project={project} />}
                {tabValue === 3 && <ProjectWorkflowResultsTab project={project} />}
                {tabValue === 4 && <ProjectEvaluationsTab project={project} />}
                {tabValue === 5 && <ProjectFinancialsTab project={project} />}
              </Box>
            </Paper>

            {/* Edit Project Dialog */}
            <CreateProjectDialog
              mode="edit"
              initialProject={project}
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              onProjectCreated={handleProjectUpdated}
            />
          </>
        )}
      </Container>
    </Box>
  );
};

export default IndividualProjectPage;