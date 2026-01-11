import React, { useState, useEffect } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  CircularProgress,
  Box
} from '@mui/material';
import {
  Edit as AnnotateIcon,
  KeyboardArrowDown as ArrowDownIcon,
  ExitToApp as ExitIcon,
  Note as NoteIcon,
  MedicalServices as MedicationIcon,
  LocalHospital as DiagnosisIcon,
  EventNote as EncounterIcon
} from '@mui/icons-material';
import { annotationsService } from '../../../services/ApiService';

const SOURCE_ICONS = {
  note: NoteIcon,
  medication: MedicationIcon,
  diagnosis: DiagnosisIcon,
  encounter: EncounterIcon
};

const SOURCE_LABELS = {
  note: 'Notes',
  medication: 'Medications',
  diagnosis: 'Diagnoses',
  encounter: 'Encounters'
};

const AnnotationModeDropdown = ({
  projectName,
  activeGroup,
  onSelectGroup,
  onExit
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const open = Boolean(anchorEl);

  useEffect(() => {
    if (projectName) {
      fetchGroups();
    }
  }, [projectName]);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await annotationsService.listGroups(projectName);
      setGroups(response.data.groups || []);
    } catch (err) {
      setError('Failed to load annotation groups');
      console.error('Error fetching annotation groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelectGroup = (group) => {
    handleClose();
    onSelectGroup(group);
  };

  const handleExit = () => {
    handleClose();
    onExit();
  };

  // Group the annotation groups by source type
  const groupsBySource = groups.reduce((acc, group) => {
    const source = group.source || 'other';
    if (!acc[source]) acc[source] = [];
    acc[source].push(group);
    return acc;
  }, {});

  const isActive = !!activeGroup;

  return (
    <>
      <Button
        variant={isActive ? 'contained' : 'outlined'}
        color={isActive ? 'primary' : 'inherit'}
        startIcon={<AnnotateIcon />}
        endIcon={<ArrowDownIcon />}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <CircularProgress size={20} />
        ) : isActive ? (
          `Annotating: ${activeGroup.name}`
        ) : (
          'Enter Annotation Mode'
        )}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { minWidth: 280 } }}
      >
        {/* Exit option when active */}
        {isActive && [
          <MenuItem key="exit" onClick={handleExit}>
            <ListItemIcon>
              <ExitIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Exit Annotation Mode" />
          </MenuItem>,
          <Divider key="exit-divider" />
        ]}

        {/* Header */}
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {isActive ? 'Switch to another group:' : 'Select annotation group:'}
          </Typography>
        </Box>

        {/* Error state */}
        {error && (
          <MenuItem disabled>
            <Typography color="error" variant="body2">{error}</Typography>
          </MenuItem>
        )}

        {/* Empty state */}
        {!loading && !error && groups.length === 0 && (
          <MenuItem disabled>
            <Typography color="text.secondary" variant="body2">
              No annotation groups defined for this project
            </Typography>
          </MenuItem>
        )}

        {/* Groups by source type */}
        {Object.entries(groupsBySource).map(([source, sourceGroups], idx) => {
          const Icon = SOURCE_ICONS[source] || NoteIcon;
          const label = SOURCE_LABELS[source] || source;

          return (
            <React.Fragment key={source}>
              {idx > 0 && <Divider />}
              <Box sx={{ px: 2, py: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Icon fontSize="inherit" /> {label}
                </Typography>
              </Box>
              {sourceGroups.map((group) => (
                <MenuItem
                  key={group.id}
                  onClick={() => handleSelectGroup(group)}
                  selected={activeGroup?.id === group.id}
                  sx={{ pl: 4 }}
                >
                  <ListItemText
                    primary={group.name}
                    secondary={`${group.fields?.length || 0} fields`}
                  />
                </MenuItem>
              ))}
            </React.Fragment>
          );
        })}
      </Menu>
    </>
  );
};

export default AnnotationModeDropdown;
