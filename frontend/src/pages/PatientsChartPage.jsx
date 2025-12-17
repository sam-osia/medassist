import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import BrandingFooter from '../components/UI/Common/BrandingFooter';
import DatasetTable from '../components/UI/Datasets/DatasetTable';
import BreadcrumbNav from '../components/UI/Common/BreadcrumbNav';
import { datasetsService } from '../services/ApiService';
import { getPageGradient } from '../App';

const PatientsChartPage = () => {
  const theme = useTheme();
  const { datasetName } = useParams();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('');

  // Decode the dataset name from URL
  const decodedDatasetName = datasetName ? decodeURIComponent(datasetName) : 'SickKids ICU';

  useEffect(() => {
    fetchPatientSummary();
  }, [datasetName]);

  const fetchPatientSummary = async () => {
    try {
      setLoading(true);
      const response = await datasetsService.getDatasetPatients(decodedDatasetName);

      const data = response.data;
      setPatients(data.patients || []);
      setDataSource(data.name || decodedDatasetName);
      setError(null);
    } catch (err) {
      console.error('Error fetching patient data:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Unknown error occurred';
      setError(`Failed to load patient data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: getPageGradient(theme),
        py: 4
      }}>
        <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Loading patient data...
            </Typography>
          </Box>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: getPageGradient(theme),
        py: 4
      }}>
        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <button onClick={fetchPatientSummary}>
              Retry Loading Data
            </button>
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      background: getPageGradient(theme),
      py: 4
    }}>
      <Container maxWidth="lg" sx={{ mt: 0, mb: 4 }}>
      {/* Breadcrumbs */}
      <BreadcrumbNav
        breadcrumbs={[
          { label: 'Datasets', path: '/datasets' },
          { label: dataSource || decodedDatasetName }
        ]}
      />

      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Dataset: {dataSource || decodedDatasetName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Total Patients: {patients.length}
        </Typography>
      </Box>

      {/* Patient Table */}
      <DatasetTable
        patients={patients}
        datasetName={decodedDatasetName}
      />
      <BrandingFooter />
      </Container>
    </Box>
  );
};

export default PatientsChartPage;
