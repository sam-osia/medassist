import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Alert,
} from '@mui/material';
import { projectsService } from '../../../../services/ApiService';

const formatCost = (n) => `$${(n || 0).toFixed(4)}`;
const formatNumber = (n) => (n || 0).toLocaleString();

const ProjectFinancialsTab = ({ project }) => {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBilling = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await projectsService.getProjectBilling(project.project_name);
        setBilling(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load billing data');
      } finally {
        setLoading(false);
      }
    };
    fetchBilling();
  }, [project.project_name]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!billing) return null;

  const { totals, api_key_totals, entries } = billing;
  const apiKeys = Object.entries(api_key_totals || {});

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Financials</Typography>

      {/* Summary */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Cumulative Totals</Typography>
        <Typography variant="body2">
          Total Cost: {formatCost(totals?.total_cost)} &middot;{' '}
          Calls: {formatNumber(totals?.total_calls)} &middot;{' '}
          Input Tokens: {formatNumber(totals?.total_input_tokens)} &middot;{' '}
          Output Tokens: {formatNumber(totals?.total_output_tokens)}
        </Typography>
      </Paper>

      {/* Per-API Key Breakdown */}
      {apiKeys.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Cost by API Key</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Key Name</TableCell>
                  <TableCell align="right">Calls</TableCell>
                  <TableCell align="right">Input Tokens</TableCell>
                  <TableCell align="right">Output Tokens</TableCell>
                  <TableCell align="right">Cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apiKeys.map(([keyName, data]) => (
                  <TableRow key={keyName}>
                    <TableCell>{keyName}</TableCell>
                    <TableCell align="right">{formatNumber(data.calls)}</TableCell>
                    <TableCell align="right">{formatNumber(data.input_tokens)}</TableCell>
                    <TableCell align="right">{formatNumber(data.output_tokens)}</TableCell>
                    <TableCell align="right">{formatCost(data.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Billing Entries Table */}
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Billing History</Typography>
      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No billing entries yet.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Experiment</TableCell>
                <TableCell>Workflow</TableCell>
                <TableCell align="right">Calls</TableCell>
                <TableCell align="right">Cost</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry, idx) => (
                <TableRow key={idx}>
                  <TableCell>{new Date(entry.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{entry.category}</TableCell>
                  <TableCell>{entry.experiment_name}</TableCell>
                  <TableCell>{entry.workflow_name}</TableCell>
                  <TableCell align="right">{formatNumber(entry.total_calls)}</TableCell>
                  <TableCell align="right">{formatCost(entry.total_cost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default ProjectFinancialsTab;
