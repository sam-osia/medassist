import React from 'react';
import { TextField } from '@mui/material';

/**
 * NumberInput - Numeric input component
 *
 * @param {string} name - Field name (used as label)
 * @param {number} value - Current value
 * @param {function} onChange - Callback with new value
 * @param {object} schema - JSON Schema for field (supports minimum, maximum)
 * @param {string} error - Error message
 * @param {boolean} disabled - Disabled state
 */
function NumberInput({
  name,
  value,
  onChange,
  schema = {},
  error,
  disabled = false,
  ...props
}) {
  const handleChange = (e) => {
    const rawValue = e.target.value;

    // Allow empty string for clearing
    if (rawValue === '') {
      onChange('');
      return;
    }

    // Parse based on schema type
    const isInteger = schema.type === 'integer';
    const num = isInteger ? parseInt(rawValue, 10) : parseFloat(rawValue);

    if (!Number.isNaN(num)) {
      onChange(num);
    }
  };

  return (
    <TextField
      fullWidth
      size="small"
      type="number"
      label={name}
      value={value ?? ''}
      onChange={handleChange}
      helperText={error || schema.description || ''}
      error={Boolean(error)}
      disabled={disabled}
      inputProps={{
        min: schema.minimum,
        max: schema.maximum,
        step: schema.type === 'integer' ? 1 : 'any'
      }}
      {...props}
    />
  );
}

export default NumberInput;