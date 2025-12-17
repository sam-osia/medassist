import React, { useMemo } from 'react';
import {
  Paper,
  Typography,
  Button
} from '@mui/material';
import {
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';

const DatasetTable = ({ patients, datasetName, projectName }) => {
  const navigate = useNavigate();

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getTotalEncounterMetrics = (patient) => {
    return patient.encounters.reduce((totals, encounter) => {
      const metrics = encounter.metrics || {};
      return {
        flowsheets: totals.flowsheets + (metrics.flowsheet_count || 0),
        medications: totals.medications + (metrics.medication_count || 0),
        diagnoses: totals.diagnoses + (metrics.diagnosis_count || 0),
        notes: totals.notes + (metrics.note_count || 0)
      };
    }, { flowsheets: 0, medications: 0, diagnoses: 0, notes: 0 });
  };

  const handleViewPatient = (mrn) => {
    const encodedDataset = encodeURIComponent(datasetName);
    if (projectName) {
      navigate(`/projects/${projectName}/dataset/${encodedDataset}/patient/${mrn}`);
    } else {
      navigate(`/datasets/${encodedDataset}/patient/${mrn}`);
    }
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: 'mrn',
        header: 'MRN',
        size: 120,
        enableGlobalFilter: true, // Only MRN is searchable via top search bar
        Cell: ({ cell }) => (
          <Typography variant="subtitle2" fontWeight="bold">
            {cell.getValue()}
          </Typography>
        ),
      },
      {
        accessorKey: 'sex',
        header: 'Sex',
        size: 80,
        enableGlobalFilter: false,
        Cell: ({ cell }) => cell.getValue() || 'N/A',
      },
      {
        accessorKey: 'date_of_birth',
        header: 'Date of Birth',
        size: 130,
        enableGlobalFilter: false,
        Cell: ({ cell }) => formatDate(cell.getValue()),
      },
      {
        accessorKey: 'encounters',
        header: 'Encounters',
        size: 110,
        enableGlobalFilter: false,
        enableColumnFilter: false,
        Cell: ({ row }) => row.original.encounters.length,
      },
      {
        accessorKey: 'notes',
        header: 'Notes',
        size: 90,
        enableGlobalFilter: false,
        enableColumnFilter: false,
        Cell: ({ row }) => getTotalEncounterMetrics(row.original).notes,
      },
      {
        accessorKey: 'medications',
        header: 'Medications',
        size: 120,
        enableGlobalFilter: false,
        enableColumnFilter: false,
        Cell: ({ row }) => getTotalEncounterMetrics(row.original).medications,
      },
      {
        accessorKey: 'flowsheets',
        header: 'Flowsheets',
        size: 110,
        enableGlobalFilter: false,
        enableColumnFilter: false,
        Cell: ({ row }) => getTotalEncounterMetrics(row.original).flowsheets,
      },
      {
        accessorKey: 'diagnoses',
        header: 'Diagnosis',
        size: 100,
        enableGlobalFilter: false,
        enableColumnFilter: false,
        Cell: ({ row }) => getTotalEncounterMetrics(row.original).diagnoses,
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        size: 100,
        enableColumnFilter: false,
        enableSorting: false,
        enableGlobalFilter: false,
        Cell: ({ row }) => (
          <Button
            variant="contained"
            size="small"
            onClick={() => handleViewPatient(row.original.mrn)}
          >
            View
          </Button>
        ),
      },
    ],
    [datasetName, projectName, navigate, handleViewPatient]
  );

  const table = useMaterialReactTable({
    columns,
    data: patients || [],
    enableGlobalFilter: false, // No global search bar
    enableColumnFilters: true, // Per-column filtering
    enableSorting: true, // Allow sorting
    enablePagination: false, // No pagination
    enableColumnActions: false, // No column menu buttons
    enableBottomToolbar: false, // Remove bottom toolbar for cleaner UI
    enableDensityToggle: false, // No density toggle
    enableFullScreenToggle: false, // No fullscreen toggle
    enableHiding: false, // Can't hide columns
    positionToolbarAlertBanner: 'bottom', // Position alerts at bottom
    muiTableProps: {
      sx: {
        tableLayout: 'fixed',
      },
    },
    muiTablePaperProps: {
      elevation: 2,
    },
  });

  if (!patients || patients.length === 0) {
    return (
      <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No patients available.
        </Typography>
      </Paper>
    );
  }

  return <MaterialReactTable table={table} />;
};

export default DatasetTable;
