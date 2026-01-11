import React from 'react';
import { TextField, MenuItem } from '@mui/material';

/**
 * EnumInput - Select/dropdown input component
 *
 * @param {string} name - Field name (used as label)
 * @param {*} value - Current value
 * @param {function} onChange - Callback with new value
 * @param {object} schema - JSON Schema for field (must have enum array)
 * @param {string} error - Error message
 * @param {boolean} disabled - Disabled state
 */
function EnumInput({
  name,
  value,
  onChange,
  schema = {},
  error,
  disabled = false,
  ...props
}) {
  const options = schema.enum || [];

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <TextField
      select
      fullWidth
      size="small"
      label={name}
      value={value ?? ''}
      onChange={handleChange}
      helperText={error || schema.description || ''}
      error={Boolean(error)}
      disabled={disabled}
      {...props}
    >
      {options.map((opt) => (
        <MenuItem key={String(opt)} value={opt}>
          {String(opt)}
        </MenuItem>
      ))}
    </TextField>
  );
}

export default EnumInput;