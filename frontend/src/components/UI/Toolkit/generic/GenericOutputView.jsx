import React from 'react';
import { Box } from '@mui/material';
import { TextDisplay, JsonDisplay } from '../shared/outputs';

/**
 * GenericOutputView - Schema-driven output display for unregistered tools
 *
 * Renders all output fields based on schema properties.
 * Falls back to JSON display if no schema or for complex types.
 *
 * @param {object} data - Output data from tool execution
 * @param {object} schema - JSON Schema for outputs
 * @param {string} toolName - Name of the tool (for potential customization)
 */
function GenericOutputView({
  data,
  schema,
  toolName
}) {
  // No data
  if (data === null || data === undefined) {
    return (
      <TextDisplay
        label="Result"
        value="No output"
      />
    );
  }

  // No schema - show raw JSON
  if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
    return (
      <JsonDisplay
        data={data}
        label="Result"
      />
    );
  }

  // Check if data is actually an error response
  if (typeof data === 'object' && 'error' in data) {
    return (
      <JsonDisplay
        data={data}
        label="Error"
      />
    );
  }

  const fields = Object.keys(schema.properties);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {fields.map((fieldName) => {
        const fieldSchema = schema.properties[fieldName];
        const value = data?.[fieldName];
        const type = fieldSchema?.type;

        // Complex types get JSON display
        if (type === 'object' || type === 'array') {
          return (
            <JsonDisplay
              key={fieldName}
              data={value}
              label={fieldName}
            />
          );
        }

        // Everything else gets text display
        return (
          <TextDisplay
            key={fieldName}
            label={fieldName}
            value={value}
          />
        );
      })}
    </Box>
  );
}

export default GenericOutputView;