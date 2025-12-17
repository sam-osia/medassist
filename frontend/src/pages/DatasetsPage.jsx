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
import { datasetsService } from '../services/ApiService';
import DatasetsSummaryCard from '../components/UI/Datasets/DatasetsSummaryCard';
import CreateDatasetDialog from '../components/UI/Datasets/CreateDatasetDialog';

const DatasetsPage = () => {
  const theme = useTheme();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await datasetsService.getAllDatasets();
      setDatasets(response.data.datasets || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load datasets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleDialogOpen = () => {
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleDatasetCreated = () => {
    fetchDatasets(); // Refresh the list
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
            Datasets
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleDialogOpen}
          >
            Create Dataset
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
        {!loading && !error && datasets.length === 0 && (
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
              onClick={handleDialogOpen}
            >
              Create Dataset
            </Button>
          </Box>
        )}

        {/* Datasets Grid */}
        {!loading && !error && datasets.length > 0 && (
          <Grid container spacing={3}>
            {datasets.map((dataset) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={dataset.dataset_name}>
                <DatasetsSummaryCard dataset={dataset} />
              </Grid>
            ))}
          </Grid>
        )}

        {/* Create Dataset Dialog */}
        <CreateDatasetDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          onDatasetCreated={handleDatasetCreated}
        />
      </Container>
    </Box>
  );
};

export default DatasetsPage;