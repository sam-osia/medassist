import React, { useMemo } from 'react';
import { Paper, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { countFlagsPerEncounter, getUniqueFlagNames } from '../../../../utils/workflowResultsUtils';

const ExperimentResultsPatientTable = ({
  experimentResults,
  datasetName,
  experimentName,
  projectName
}) => {
  const navigate = useNavigate();

  // Process results using definition-based format
  const flattenedData = useMemo(() => {
    if (!experimentResults?.output_definitions && !experimentResults?.output_values) {
      return [];
    }

    const countsData = countFlagsPerEncounter(experimentResults);
    // Convert to format compatible with the table
    return countsData.map((row) => ({
      mrn: row.mrn,
      csn: row.csn,
      flags: Object.fromEntries(
        Object.entries(row.flagCounts).map(([flagName, data]) => [
          flagName,
          { state: data.detected, sources: Array(data.count).fill({}) }
        ])
      )
    }));
  }, [experimentResults]);

  // Extract flag names from definitions
  const flagNames = useMemo(() => {
    return getUniqueFlagNames(experimentResults);
  }, [experimentResults]);

  // Navigation handler
  const handleViewPatient = (row) => {
    const encodedDataset = encodeURIComponent(datasetName);
    navigate(
      `/projects/${projectName}/dataset/${encodedDataset}/patient/${row.mrn}`,
      { state: { preselectedCSN: String(row.csn), preselectedExperiment: experimentName } }
    );
  };

  // Helper to get flag value for display
  const getFlagValue = (flags, flagName) => {
    const flag = flags[flagName];
    if (!flag || !flag.state) return '-';
    const sourceCount = flag.sources?.length || 0;
    return sourceCount > 0 ? sourceCount : 1;
  };

  // Helper to get total positive flags
  const getTotalFlags = (flags) => {
    return flagNames.reduce((total, flagName) => {
      const flag = flags[flagName];
      return total + (flag?.state ? 1 : 0);
    }, 0);
  };

  // Build columns dynamically
  const columns = useMemo(() => {
    const baseColumns = [
      {
        accessorKey: 'mrn',
        header: 'MRN',
        size: 100,
        enableColumnFilter: true,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight="bold">
            {cell.getValue()}
          </Typography>
        ),
      },
      {
        accessorKey: 'csn',
        header: 'CSN',
        size: 100,
        enableColumnFilter: true,
        Cell: ({ cell }) => (
          <Typography variant="body2">
            {cell.getValue()}
          </Typography>
        ),
      },
    ];

    // Add flag columns
    const flagColumns = flagNames.map(flagName => ({
      id: `flag_${flagName}`,
      header: flagName,
      size: 120,
      enableColumnFilter: false,
      enableSorting: true,
      accessorFn: (row) => {
        const flag = row.flags[flagName];
        if (!flag || !flag.state) return 0;
        return flag.sources?.length || 1;
      },
      Cell: ({ row }) => {
        const value = getFlagValue(row.original.flags, flagName);
        return (
          <Typography
            variant="body2"
            sx={{
              textAlign: 'center',
              color: value !== '-' ? 'warning.main' : 'text.disabled',
              fontWeight: value !== '-' ? 600 : 400
            }}
          >
            {value}
          </Typography>
        );
      },
    }));

    // Add total column
    const totalColumn = {
      id: 'total',
      header: 'Total',
      size: 80,
      enableColumnFilter: false,
      enableSorting: true,
      accessorFn: (row) => getTotalFlags(row.flags),
      Cell: ({ row }) => {
        const total = getTotalFlags(row.original.flags);
        return (
          <Typography
            variant="body2"
            sx={{
              textAlign: 'center',
              fontWeight: 600,
              color: total > 0 ? 'warning.main' : 'text.secondary'
            }}
          >
            {total}
          </Typography>
        );
      },
    };

    // Add actions column
    const actionsColumn = {
      id: 'actions',
      header: 'Actions',
      size: 100,
      enableColumnFilter: false,
      enableSorting: false,
      Cell: ({ row }) => (
        <Button
          variant="contained"
          size="small"
          onClick={() => handleViewPatient(row.original)}
        >
          View
        </Button>
      ),
    };

    return [...baseColumns, ...flagColumns, totalColumn, actionsColumn];
  }, [flagNames, datasetName, projectName, experimentName]);

  const table = useMaterialReactTable({
    columns,
    data: flattenedData,
    enableGlobalFilter: false,
    enableColumnFilters: true,
    enableSorting: true,
    enablePagination: false,
    enableColumnActions: false,
    enableBottomToolbar: false,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableHiding: false,
    muiTableProps: {
      sx: {
        tableLayout: 'auto',
      },
    },
    muiTablePaperProps: {
      elevation: 2,
    },
    muiTableContainerProps: {
      sx: {
        maxHeight: '600px',
      },
    },
  });

  if (flattenedData.length === 0) {
    return (
      <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No patient results found for this experiment.
        </Typography>
      </Paper>
    );
  }

  return <MaterialReactTable table={table} />;
};

export default ExperimentResultsPatientTable;