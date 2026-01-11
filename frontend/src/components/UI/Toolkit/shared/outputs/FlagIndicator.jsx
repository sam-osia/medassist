import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

/**
 * FlagIndicator - Boolean flag display with visual indicator
 *
 * @param {boolean} value - Flag state
 * @param {string} trueLabel - Label when true (default: 'TRUE')
 * @param {string} falseLabel - Label when false (default: 'FALSE')
 * @param {string} trueColor - Color when true (default: 'warning')
 * @param {string} falseColor - Color when false (default: 'default')
 * @param {string} label - Optional label above the indicator
 */
function FlagIndicator({
  value,
  trueLabel = 'TRUE',
  falseLabel = 'FALSE',
  trueColor = 'warning',
  falseColor = 'default',
  label,
  ...props
}) {
  const isTrue = Boolean(value);

  return (
    <Box {...props}>
      {label && (
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          {label}
        </Typography>
      )}
      <Chip
        icon={isTrue ? <CheckIcon /> : <CancelIcon />}
        label={isTrue ? trueLabel : falseLabel}
        color={isTrue ? trueColor : falseColor}
        variant={isTrue ? 'filled' : 'outlined'}
        sx={{
          fontWeight: 600,
          '& .MuiChip-icon': {
            fontSize: '1.2rem'
          }
        }}
      />
    </Box>
  );
}

export default FlagIndicator;