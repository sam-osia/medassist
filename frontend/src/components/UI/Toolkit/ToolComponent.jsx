    import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import { toolsService } from '../../../services/ApiService';
import { getInputForm, getOutputView } from './registry';

/**
 * Coerce form values to proper types based on schema
 */
function coerceValues(values, schema) {
  if (!schema || !schema.properties) return values;

  const coerced = {};
  Object.keys(values).forEach((key) => {
    const field = schema.properties[key];
    const type = field?.type;
    const value = values[key];

    // Objects (like prompt) pass through as-is
    if (type === 'object') {
      coerced[key] = value;
      return;
    }

    // Booleans
    if (type === 'boolean') {
      coerced[key] = Boolean(value);
      return;
    }

    // Numbers/Integers
    if (type === 'integer' || type === 'number') {
      if (value === '' || value === null || value === undefined) {
        coerced[key] = undefined;
        return;
      }
      const num = type === 'integer' ? parseInt(value, 10) : parseFloat(value);
      coerced[key] = Number.isNaN(num) ? undefined : num;
      return;
    }

    // Arrays (like keywords) - pass through
    if (Array.isArray(value)) {
      coerced[key] = value;
      return;
    }

    // Everything else
    coerced[key] = value;
  });

  return coerced;
}

/**
 * Initialize form values from schema
 */
function initializeValues(schema) {
  if (!schema || !schema.properties) return {};

  const init = {};
  Object.keys(schema.properties).forEach((key) => {
    const field = schema.properties[key];
    const def = field?.default;

    // Prompt fields get special initialization
    if (field?.type === 'object' && key === 'prompt') {
      init[key] = {
        system_prompt: '',
        user_prompt: '',
        examples: []
      };
    } else if (def !== undefined) {
      init[key] = def;
    } else {
      init[key] = '';
    }
  });

  return init;
}

/**
 * Validate form values against schema
 */
function validateValues(values, schema) {
  const errors = {};
  const required = schema?.required || [];

  required.forEach((key) => {
    const field = schema?.properties?.[key] || {};
    const type = field.type;
    const v = values[key];

    // Booleans are always valid (true/false)
    if (type === 'boolean') {
      return;
    }

    // Prompt objects need system_prompt and user_prompt
    if (type === 'object' && key === 'prompt') {
      if (!v?.system_prompt?.trim() || !v?.user_prompt?.trim()) {
        errors[key] = 'Prompt configuration required';
      }
      return;
    }

    // Arrays need at least one item
    if (type === 'array' || Array.isArray(v)) {
      if (!v || v.length === 0) {
        errors[key] = 'Required';
      }
      return;
    }

    // Everything else
    if (v === undefined || v === null || v === '') {
      errors[key] = 'Required';
    }
  });

  // Numeric constraints
  Object.keys(schema?.properties || {}).forEach((key) => {
    const field = schema.properties[key];
    const type = field?.type;
    const v = values[key];

    if ((type === 'integer' || type === 'number') && v !== '' && v !== undefined) {
      const num = type === 'integer' ? parseInt(v, 10) : parseFloat(v);
      if (Number.isNaN(num)) {
        errors[key] = 'Must be a number';
      } else {
        if (field.minimum !== undefined && num < field.minimum) {
          errors[key] = `Minimum: ${field.minimum}`;
        }
        if (field.maximum !== undefined && num > field.maximum) {
          errors[key] = `Maximum: ${field.maximum}`;
        }
      }
    }
  });

  return errors;
}

/**
 * ToolComponent
 *
 * Main component for rendering tool input forms and output displays.
 * Uses the registry to get appropriate InputForm and OutputView components.
 */
const ToolComponent = ({ tool }) => {
  const { name, display_name, category, description, user_description, input_schema: schema, output_schema, input_help } = tool;

  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [runError, setRunError] = useState(null);

  // Get registered components or fallbacks
  const InputForm = getInputForm(name);
  const OutputView = getOutputView(name);

  // Initialize/reset values when tool changes
  useEffect(() => {
    setResult(null);
    setRunError(null);
    setValues(initializeValues(schema));
    setErrors({});
  }, [name, schema]);

  const handleValuesChange = (newValues) => {
    setValues(newValues);
    // Clear errors for changed fields
    const changedKeys = Object.keys(newValues).filter(
      k => newValues[k] !== values[k]
    );
    if (changedKeys.length > 0) {
      setErrors(prev => {
        const updated = { ...prev };
        changedKeys.forEach(k => delete updated[k]);
        return updated;
      });
    }
  };

  const handleRun = async () => {
    setRunError(null);
    setResult(null);

    // Validate
    const validationErrors = validateValues(values, schema);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    // Coerce values to proper types
    const payload = coerceValues(values, schema);

    setRunning(true);
    try {
      const resp = await toolsService.runTool(name, payload);
      setResult(resp.data);
    } catch (e) {
      // Handle error detail which might be an object or string
      const detail = e.response?.data?.detail;
      let errorMessage;

      if (typeof detail === 'object' && detail !== null) {
        errorMessage = detail.message || JSON.stringify(detail);
      } else {
        errorMessage = detail || e.message || 'Failed to run tool';
      }

      setRunError(errorMessage);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {display_name || name}
        </Typography>
        {(user_description || description) && (
          <Typography variant="body2" color="text.secondary">
            {user_description || description}
          </Typography>
        )}
      </Box>

      {/* Input Form */}
      <InputForm
        schema={schema}
        values={values}
        onChange={handleValuesChange}
        errors={errors}
        disabled={running}
        outputSchema={output_schema}
        inputHelp={input_help || {}}
      />

      {/* Run Button */}
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Button
          variant="contained"
          onClick={handleRun}
          disabled={running}
        >
          {running ? (
            <>
              <CircularProgress size={18} sx={{ mr: 1 }} />
              Running...
            </>
          ) : (
            'Run'
          )}
        </Button>
      </Box>

      {/* Error Display */}
      {runError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {runError}
        </Alert>
      )}

      {/* Output Display */}
      {result?.ok && (
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
            Result
          </Typography>
          <OutputView
            data={result.result}
            schema={output_schema}
            toolName={name}
            inputs={values}
          />
        </Box>
      )}

      {/* Handle non-ok results (shouldn't happen but just in case) */}
      {result && !result.ok && !runError && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {result.error?.message || 'Tool execution returned an error'}
        </Alert>
      )}
    </Box>
  );
};

export default ToolComponent;
