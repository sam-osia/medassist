import React from 'react';
import { Box, TextField } from '@mui/material';

/**
 * EditableField - Editable output field for forms (e.g., in examples)
 *
 * Used in PromptDialog for editing expected response structures.
 *
 * @param {string} fieldName - The name of the field
 * @param {*} value - The current value
 * @param {function} onChange - Callback when value changes
 * @param {object} schema - The JSON Schema for the field
 */
function EditableField({ fieldName, value, onChange, schema }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <TextField
        fullWidth
        label={fieldName}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={schema?.description || ''}
        size="small"
      />
    </Box>
  );
}

/**
 * Render an editable output field (functional wrapper for compatibility)
 */
export function renderEditableOutputField(fieldName, value, onChange, schema) {
  return (
    <EditableField
      key={fieldName}
      fieldName={fieldName}
      value={value}
      onChange={onChange}
      schema={schema}
    />
  );
}

export default EditableField;
