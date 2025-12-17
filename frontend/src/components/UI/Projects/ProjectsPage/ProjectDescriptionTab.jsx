import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  Link,
  Chip,
  Button
} from '@mui/material';
import {
  Person as PersonIcon,
  Storage as DatasetIcon,
  Email as EmailIcon,
  Edit as EditIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { useAuth } from '../../../../contexts/AuthProvider';

const ProjectDescriptionTab = ({ project, onEditClick }) => {
  const { user, isAdmin } = useAuth();

  // Check if current user can edit (owner or admin)
  const canEdit = user === project.owner || isAdmin;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <Box>
      {/* Owner (always read-only) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PersonIcon color="action" />
        <Typography variant="body1">
          <strong>Owner:</strong> {project.owner}
        </Typography>
      </Box>

      {/* Created Date */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <CalendarIcon color="action" />
        <Typography variant="body1">
          <strong>Created:</strong> {formatDate(project.created_date)}
        </Typography>
      </Box>

      {/* Last Modified Date */}
      {project.last_modified_date && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CalendarIcon color="action" />
          <Typography variant="body1">
            <strong>Modified:</strong> {formatDate(project.last_modified_date)}
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Summary */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          Summary
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {project.summary}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Description */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          Description
        </Typography>
        {project.description ? (
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ whiteSpace: 'pre-wrap' }}
          >
            {project.description}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled" fontStyle="italic">
            No description provided
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* References */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          References
        </Typography>
        {project.references && project.references.length > 0 ? (
          <List>
            {project.references.map((reference, index) => (
              <ListItem key={index} sx={{ px: 0 }}>
                <Link
                  href={reference}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ wordBreak: 'break-all' }}
                >
                  {reference}
                </Link>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.disabled" fontStyle="italic">
            No references added
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Contacts */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          Contacts
        </Typography>
        {project.contacts && project.contacts.length > 0 ? (
          <List>
            {project.contacts.map((contact, index) => (
              <ListItem key={index} sx={{ px: 0 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {contact.name}
                      </Typography>
                      <Chip label={contact.role} size="small" variant="outlined" />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <EmailIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {contact.email}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.disabled" fontStyle="italic">
            No contacts added
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Dataset */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          Dataset
        </Typography>
        {project.dataset ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DatasetIcon color="action" />
            <Typography variant="body1">{project.dataset}</Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.disabled" fontStyle="italic">
            No dataset assigned
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Project Members */}
      <Box>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          Project Members
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Users who have access to this project (in addition to the owner)
        </Typography>

        {project.allowed_users && project.allowed_users.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {project.allowed_users.map((username) => (
              <Chip
                key={username}
                label={username}
                variant="outlined"
              />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.disabled" fontStyle="italic">
            No additional members
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ProjectDescriptionTab;
