import React from 'react';
import { TextField } from '@mui/material';

/**
 * TextAreaInput - Multi-line text input component
 *
 * @param {string} name - Field name (used as label)
 * @param {string} value - Current value
 * @param {function} onChange - Callback with new value
 * @param {object} schema - JSON Schema for field
 * @param {string} error - Error message
 * @param {boolean} disabled - Disabled state
 * @param {number} rows - Number of rows (default: 6)
 */
function TextAreaInput({
  name,
  value,
  onChange,
  schema = {},
  error,
  disabled = false,
  rows = 6,
  placeholder,
  ...props
}) {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <TextField
      fullWidth
      multiline
      rows={rows}
      size="small"
      label={name}
      value={value ?? ''}
      onChange={handleChange}
      helperText={error || schema.description || ''}
      error={Boolean(error)}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
}

export default TextAreaInput;