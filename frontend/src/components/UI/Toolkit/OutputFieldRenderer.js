import React from 'react';
import { Box, Typography, TextField, Paper } from '@mui/material';

/**
 * Output Field Renderer
 *
 * Complete output rendering system including configuration, field rendering,
 * and orchestration components.
 */

// ============================================================================
// Configuration Section
// ============================================================================

// Tool-specific UI overrides
// Structure: { toolName: { fieldName: { widget, ...props } } }
export const OUTPUT_UI_CONFIG = {
  // Example usage:
  // 'keyword_count': {
  //   'formatted_text': { widget: 'highlighted-text' },
  //   'count': { widget: 'metric' }
  // },

  // Add tool-specific overrides as needed
};

/**
 * Get UI configuration for a specific output field
 *
 * @param {string} toolName - The name of the tool
 * @param {string} fieldName - The name of the field
 * @param {object} fieldSchema - The JSON Schema for the field
 * @returns {object} UI config with widget type and optional props
 */
export function getOutputUIConfig(toolName, fieldName, fieldSchema) {
  // 1. Check for tool-specific override first
  if (OUTPUT_UI_CONFIG[toolName]?.[fieldName]) {
    return OUTPUT_UI_CONFIG[toolName][fieldName];
  }

  // 2. For now: everything is basic text
  // Future: add pattern-based inference like InputFieldRenderer
  return { widget: 'text' };
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Render an output field based on its widget configuration (read-only display)
 *
 * @param {string} fieldName - The name of the field
 * @param {*} value - The value to display
 * @param {object} config - The UI config from getOutputUIConfig
 * @param {object} schema - The JSON Schema for the field
 * @returns {React.Element} Rendered field component
 */
export function renderOutputField(fieldName, value, config, schema) {
  const { widget = 'text' } = config;

  // Helper to safely convert value to string
  const valueToString = (val) => {
    if (val === null || val === undefined) {
      return '';
    }
    if (typeof val === 'object') {
      return JSON.stringify(val, null, 2);
    }
    return String(val);
  };

  // Basic text display for everything (for now)
  if (widget === 'text') {
    return (
      <Box sx={{ mb: 2 }} key={fieldName}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
          {fieldName}
        </Typography>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {valueToString(value)}
        </Typography>
      </Box>
    );
  }

  // Fallback for any undefined widget types
  return (
    <Box sx={{ mb: 2 }} key={fieldName}>
      <Typography variant="subtitle2" color="text.secondary">
        {fieldName}
      </Typography>
      <Typography variant="body2">
        {valueToString(value)}
      </Typography>
    </Box>
  );
}

/**
 * Render an editable output field for forms (e.g., in examples)
 *
 * @param {string} fieldName - The name of the field
 * @param {*} value - The current value
 * @param {function} onChange - Callback when value changes
 * @param {object} schema - The JSON Schema for the field
 * @returns {React.Element} Rendered editable field component
 */
export function renderEditableOutputField(fieldName, value, onChange, schema) {
  // POC: Simple TextField for everything
  // Future: Use getOutputUIConfig() to render smart widgets based on type

  return (
    <Box sx={{ mb: 1.5 }} key={fieldName}>
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

// ============================================================================
// Orchestrator Component
// ============================================================================

/**
 * OutputRenderer Component
 *
 * Orchestrates the display of tool output based on output schema.
 * Handles fallback cases and iterates through structured output fields.
 */
function OutputRenderer({ toolName, outputData, outputSchema }) {
  // Helper to safely stringify any data
  const safeStringify = (data) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  };

  // No schema or data - show raw JSON fallback
  if (!outputSchema || !outputData) {
    return (
      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {safeStringify(outputData)}
        </pre>
      </Paper>
    );
  }

  const properties = outputSchema.properties || {};

  // No properties defined - fallback to raw display
  if (Object.keys(properties).length === 0) {
    return (
      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {safeStringify(outputData)}
        </pre>
      </Paper>
    );
  }

  // Check if outputData is actually an error response
  if (outputData && typeof outputData === 'object' && 'error' in outputData) {
    return (
      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {safeStringify(outputData)}
        </pre>
      </Paper>
    );
  }

  // Structured display: iterate over schema properties
  return (
    <Box>
      {Object.entries(properties).map(([fieldName, fieldSchema]) => {
        const config = getOutputUIConfig(toolName, fieldName, fieldSchema);
        const value = outputData?.[fieldName];

        return (
          <React.Fragment key={fieldName}>
            {renderOutputField(fieldName, value, config, fieldSchema)}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

export default OutputRenderer;
