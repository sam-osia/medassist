import React from 'react';
import { Box } from '@mui/material';
import Grid from '@mui/material/Grid';
import { TextAreaInput, TextInput } from '../../shared/inputs';

/**
 * IdentifyFlag InputForm
 *
 * Custom input form for the identify_flag tool.
 * Fields: text (textarea), criteria (text)
 */
function InputForm({
  schema,
  values,
  onChange,
  errors = {},
  disabled = false
}) {
  const handleFieldChange = (fieldName, newValue) => {
    onChange({
      ...values,
      [fieldName]: newValue
    });
  };

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid size={12}>
          <TextAreaInput
            name="text"
            value={values.text || ''}
            onChange={(value) => handleFieldChange('text', value)}
            schema={schema?.properties?.text || {}}
            error={errors.text}
            disabled={disabled}
            rows={8}
            placeholder="Enter text to analyze for flag criteria..."
          />
        </Grid>
        <Grid size={12}>
          <TextInput
            name="criteria"
            value={values.criteria || ''}
            onChange={(value) => handleFieldChange('criteria', value)}
            schema={schema?.properties?.criteria || {}}
            error={errors.criteria}
            disabled={disabled}
            placeholder="e.g., 'mental health concerns' or 'fall risk indicators'"
          />
        </Grid>
      </Grid>
    </Box>
  );
}

export default InputForm;