import React from 'react';
import { Box } from '@mui/material';
import Grid from '@mui/material/Grid';
import { TextAreaInput, PromptInput } from '../../shared/inputs';

/**
 * AnalyzeNoteWithSpanAndReason InputForm
 *
 * Custom input form for the analyze_note_with_span_and_reason tool.
 * Fields: note (textarea), prompt (PromptInput dialog)
 */
function InputForm({
  schema,
  values,
  onChange,
  errors = {},
  disabled = false,
  outputSchema = null,
  inputHelp = {}
}) {
  const handleFieldChange = (fieldName, newValue) => {
    onChange({
      ...values,
      [fieldName]: newValue
    });
  };

  // Available variables for prompt templating (other input fields)
  const availableVariables = ['note'];

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid size={12}>
          <TextAreaInput
            name="note"
            value={values.note || ''}
            onChange={(value) => handleFieldChange('note', value)}
            schema={schema?.properties?.note || {}}
            error={errors.note}
            disabled={disabled}
            rows={8}
            placeholder="Enter the patient note to analyze..."
          />
        </Grid>
        <Grid size={12}>
          <PromptInput
            name="prompt"
            value={values.prompt || { system_prompt: '', user_prompt: '', examples: [] }}
            onChange={(value) => handleFieldChange('prompt', value)}
            schema={schema?.properties?.prompt || {}}
            error={errors.prompt}
            disabled={disabled}
            availableVariables={availableVariables}
            outputSchema={outputSchema}
            helpText={inputHelp.prompt}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

export default InputForm;