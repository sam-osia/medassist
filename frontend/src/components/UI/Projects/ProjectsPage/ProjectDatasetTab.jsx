import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import DatasetTable from '../../Datasets/DatasetTable';
import { datasetsService } from '../../../../services/ApiService';

const ProjectDatasetTab = ({ project }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPatients = async () => {
      if (!project.dataset) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await datasetsService.getDatasetPatients(project.dataset);
        setPatients(response.data.patients || []);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load dataset patients');
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [project.dataset]);

  if (!project.dataset) {
    return (
      <Typography variant="body1" color="text.secondary">
        No dataset associated with this project.
      </Typography>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Dataset: {project.dataset}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Total Patients: {patients.length}
        </Typography>
      </Box>

      <DatasetTable
        patients={patients}
        datasetName={project.dataset}
        projectName={project.project_name}
      />
    </Box>
  );
};

export default ProjectDatasetTab;
