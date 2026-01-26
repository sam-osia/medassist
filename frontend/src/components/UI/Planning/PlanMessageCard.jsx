import React from 'react';
import { 
  Box, 
  Card,
  CardContent,
  Typography,
  Chip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

const PlanMessageCard = ({ 
  planData, 
  isSelected, 
  onClick, 
  timestamp 
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 1 }}>
      <Card 
        variant="outlined"
        sx={{
          display: 'inline-block',
          ml: 'auto',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          border: isSelected ? 2 : 1,
          borderColor: isSelected ? 'success.main' : 'divider',
          backgroundColor: isSelected ? 'success.light' : 'custom.alternateRow',
          '&:hover': {
            borderColor: isSelected ? 'success.dark' : 'primary.main',
            transform: 'translateY(-1px)',
            boxShadow: 3
          }
        }}
        onClick={onClick}
      >
        <CardContent sx={{ py: 1, px: 2, display: 'flex', alignItems: 'center', gap: 1, '&:last-child': { pb: 1 } }}>
          <Typography sx={{ fontSize: '1rem' }}>📋</Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: isSelected ? 'success.contrastText' : 'text.primary',
              fontWeight: isSelected ? 700 : 500
            }}
          >
            Plan
          </Typography>
          {isSelected && (
            <Chip 
              label="Active" 
              size="small" 
              color="success"
              variant="filled"
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PlanMessageCard;