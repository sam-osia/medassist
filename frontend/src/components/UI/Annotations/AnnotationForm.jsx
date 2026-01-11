import React from 'react';
import {
  Box,
  TextField,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography
} from '@mui/material';

const AnnotationForm = ({ fields, values, onChange }) => {
  const renderField = (field) => {
    const value = values[field.id];

    switch (field.type) {
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={value === true}
                onChange={(e) => onChange(field.id, e.target.checked)}
              />
            }
            label={field.name}
          />
        );

      case 'text':
        return (
          <TextField
            label={field.name}
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            multiline
            rows={3}
            fullWidth
          />
        );

      case 'numeric':
        return (
          <TextField
            label={field.name}
            type="number"
            value={value ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              onChange(field.id, val === '' ? null : Number(val));
            }}
            fullWidth
          />
        );

      case 'categorical':
        return (
          <FormControl fullWidth>
            <InputLabel>{field.name}</InputLabel>
            <Select
              value={value || ''}
              onChange={(e) => onChange(field.id, e.target.value || null)}
              label={field.name}
            >
              <MenuItem value="">
                <em>Not selected</em>
              </MenuItem>
              {(field.options || []).map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      default:
        return (
          <Typography color="error">
            Unknown field type: {field.type}
          </Typography>
        );
    }
  };

  if (!fields || fields.length === 0) {
    return (
      <Typography color="text.secondary">
        No annotation fields defined.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {fields.map((field) => (
        <Box key={field.id}>
          {renderField(field)}
        </Box>
      ))}
    </Box>
  );
};

export default AnnotationForm;
