import React from 'react';
import { Box, Alert } from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  TextInput,
  TextAreaInput,
  NumberInput,
  BooleanInput,
  EnumInput,
  PromptInput
} from '../shared/inputs';

/**
 * Determine field order: required fields first, then mrn/csn, then others
 */
function getFieldOrder(schema) {
  if (!schema || !schema.properties) return [];

  const props = Object.keys(schema.properties);
  const required = schema.required || [];
  const priorityFields = ['mrn', 'csn'];

  return props.sort((a, b) => {
    const aReq = required.includes(a) ? 1 : 0;
    const bReq = required.includes(b) ? 1 : 0;
    if (aReq !== bReq) return bReq - aReq;

    const aPriority = priorityFields.includes(a) ? 1 : 0;
    const bPriority = priorityFields.includes(b) ? 1 : 0;
    if (aPriority !== bPriority) return bPriority - aPriority;

    return 0;
  });
}

/**
 * Determine which input component to use based on field schema
 */
function getInputComponent(fieldName, fieldSchema) {
  const type = fieldSchema?.type;

  // Enum takes precedence
  if (Array.isArray(fieldSchema?.enum)) {
    return EnumInput;
  }

  // Boolean
  if (type === 'boolean') {
    return BooleanInput;
  }

  // Number/Integer
  if (type === 'integer' || type === 'number') {
    return NumberInput;
  }

  // Object with name 'prompt' -> PromptInput
  if (type === 'object' && fieldName === 'prompt') {
    return PromptInput;
  }

  // String - check for textarea patterns
  if (type === 'string') {
    const textareaPatterns = ['note', 'text', 'content', 'body', 'description'];
    const isMultiline = textareaPatterns.some(
      pattern => fieldName.toLowerCase().includes(pattern)
    );
    return isMultiline ? TextAreaInput : TextInput;
  }

  // Default fallback
  return TextInput;
}

/**
 * GenericInputForm - Schema-driven form generation for unregistered tools
 *
 * @param {object} schema - JSON Schema for inputs
 * @param {object} values - Current form values
 * @param {function} onChange - Callback with updated values object
 * @param {object} errors - Validation errors by field name
 * @param {boolean} disabled - Disable all inputs
 * @param {object} outputSchema - Output schema (passed to PromptInput for examples)
 */
function GenericInputForm({
  schema,
  values,
  onChange,
  errors = {},
  disabled = false,
  outputSchema = null
}) {
  // Handle no schema
  if (!schema || !schema.properties) {
    return (
      <Alert severity="info">
        This tool has no declared inputs.
      </Alert>
    );
  }

  const fieldOrder = getFieldOrder(schema);

  // Get all field names except the current one (for PromptInput variables)
  const getAvailableVariables = (currentField) => {
    return fieldOrder.filter(f => f !== currentField);
  };

  const handleFieldChange = (fieldName, newValue) => {
    onChange({
      ...values,
      [fieldName]: newValue
    });
  };

  return (
    <Box>
      <Grid container spacing={2}>
        {fieldOrder.map((fieldName) => {
          const fieldSchema = schema.properties[fieldName];
          const InputComponent = getInputComponent(fieldName, fieldSchema);
          const value = values[fieldName];
          const error = errors[fieldName];

          // Skip unsupported complex types (except prompt objects)
          const type = fieldSchema?.type;
          if ((type === 'object' && fieldName !== 'prompt') || type === 'array') {
            return (
              <Grid size={12} key={fieldName}>
                <Alert severity="info">
                  Field "{fieldName}" of type "{type}" is not supported in this form.
                </Alert>
              </Grid>
            );
          }

          // Special props for PromptInput
          const extraProps = InputComponent === PromptInput
            ? {
                availableVariables: getAvailableVariables(fieldName),
                outputSchema: outputSchema
              }
            : {};

          return (
            <Grid size={12} key={fieldName}>
              <InputComponent
                name={fieldName}
                value={value}
                onChange={(newValue) => handleFieldChange(fieldName, newValue)}
                schema={fieldSchema}
                error={error}
                disabled={disabled}
                {...extraProps}
              />
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

export default GenericInputForm;