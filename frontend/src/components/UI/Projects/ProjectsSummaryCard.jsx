import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ProjectsSummaryCard = ({ project }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/projects/${project.project_name}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <Card
      sx={{
        height: 220,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
    >
      <CardContent sx={{ flexGrow: 1, width: '100%', pb: 1 }}>
        {/* Project Name */}
        <Typography
          variant="h6"
          component="div"
          gutterBottom
          sx={{
            fontWeight: 600,
            color: 'primary.main',
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {project.project_name}
        </Typography>

        {/* Owner */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 2
          }}
        >
          <PersonIcon fontSize="small" color="action" />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {project.owner}
          </Typography>
        </Box>

        {/* Summary */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {project.summary}
        </Typography>

        {/* Created Date */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 1
          }}
        >
          <CalendarIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {formatDate(project.created_date)}
          </Typography>
        </Box>

        {/* View Button */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8
          }}
        >
          <Button
            variant="contained"
            size="small"
            onClick={handleClick}
          >
            View
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProjectsSummaryCard;