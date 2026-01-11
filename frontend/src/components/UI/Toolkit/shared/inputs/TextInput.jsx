import React from 'react';
import { TextField } from '@mui/material';

/**
 * TextInput - Single-line text input component
 *
 * @param {string} name - Field name (used as label)
 * @param {string} value - Current value
 * @param {function} onChange - Callback with new value
 * @param {object} schema - JSON Schema for field
 * @param {string} error - Error message
 * @param {boolean} disabled - Disabled state
 */
function TextInput({
  name,
  value,
  onChange,
  schema = {},
  error,
  disabled = false,
  placeholder,
  ...props
}) {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <TextField
      fullWidth
      size="small"
      type="text"
      label={name}
      value={value ?? ''}
      onChange={handleChange}
      helperText={error || schema.description || ''}
      error={Boolean(error)}
      disabled={disabled}
      placeholder={placeholder || schema.default?.toString()}
      {...props}
    />
  );
}

export default TextInput;