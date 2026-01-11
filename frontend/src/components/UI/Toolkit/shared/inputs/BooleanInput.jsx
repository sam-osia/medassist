import React from 'react';
import { FormControlLabel, Switch, Typography, Box } from '@mui/material';

/**
 * BooleanInput - Switch/toggle input component
 *
 * @param {string} name - Field name (used as label)
 * @param {boolean} value - Current value
 * @param {function} onChange - Callback with new value
 * @param {object} schema - JSON Schema for field
 * @param {string} error - Error message
 * @param {boolean} disabled - Disabled state
 */
function BooleanInput({
  name,
  value,
  onChange,
  schema = {},
  error,
  disabled = false,
  ...props
}) {
  const handleChange = (e) => {
    onChange(e.target.checked);
  };

  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(value)}
            onChange={handleChange}
            color="primary"
            disabled={disabled}
          />
        }
        label={name}
        {...props}
      />
      {(error || schema.description) && (
        <Typography
          variant="caption"
          color={error ? 'error' : 'text.secondary'}
          sx={{ display: 'block', ml: 1.5 }}
        >
          {error || schema.description}
        </Typography>
      )}
    </Box>
  );
}

export default BooleanInput;