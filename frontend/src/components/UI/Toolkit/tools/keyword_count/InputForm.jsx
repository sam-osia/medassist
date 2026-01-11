import React from 'react';
import { Box } from '@mui/material';
import Grid from '@mui/material/Grid';
import { TextAreaInput, TextInput } from '../../shared/inputs';

/**
 * KeywordCount InputForm
 *
 * Custom input form for the keyword_count tool.
 * Fields: text (textarea), keywords (comma-separated string -> array)
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

  // Keywords are stored as comma-separated string in the form
  // but need to be converted to array when submitted
  const keywordsValue = Array.isArray(values.keywords)
    ? values.keywords.join(', ')
    : (values.keywords || '');

  const handleKeywordsChange = (value) => {
    // Convert comma-separated string to array
    const keywords = value
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    handleFieldChange('keywords', keywords);
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
            placeholder="Enter text to analyze for keywords..."
          />
        </Grid>
        <Grid size={12}>
          <TextInput
            name="keywords"
            value={keywordsValue}
            onChange={handleKeywordsChange}
            schema={{
              ...schema?.properties?.keywords,
              description: 'Comma-separated list of keywords to search for'
            }}
            error={errors.keywords}
            disabled={disabled}
            placeholder="keyword1, keyword2, keyword3"
          />
        </Grid>
      </Grid>
    </Box>
  );
}

export default InputForm;