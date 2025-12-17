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
  Person as PersonIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const DatasetsSummaryCard = ({ dataset }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/datasets/${dataset.dataset_name}/patients`);
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
        height: 200,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
    >
      <CardContent sx={{ flexGrow: 1, width: '100%', pb: 1 }}>
        {/* Dataset Name */}
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
          {dataset.name}
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
            {dataset.owner}
          </Typography>
        </Box>

        {/* Patient Count */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 2
          }}
        >
          <GroupIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {dataset.patient_count} {dataset.patient_count === 1 ? 'patient' : 'patients'}
          </Typography>
        </Box>

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
            {formatDate(dataset.created_date)}
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

export default DatasetsSummaryCard;