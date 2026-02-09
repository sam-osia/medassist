import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
} from '@mui/material';

const OutputDefinitionCard = ({ definition }) => {
  return (
    <Card variant="outlined" sx={{ backgroundColor: 'action.hover' }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* Header: Label + Tool Name Chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {definition.label}
          </Typography>
          {definition.tool_name && (
            <Chip
              label={definition.tool_name}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {/* Step ID (monospace) */}
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          step: {definition.step_id}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default OutputDefinitionCard;
