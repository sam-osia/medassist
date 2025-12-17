/**
 * Input Field Renderer
 *
 * Tool-specific UI mappings for form field rendering.
 * Only define exceptions here - most fields are handled by smart inference.
 */

// Tool-specific UI overrides
// Structure: { toolName: { fieldName: { widget, ...props } } }
export const FIELD_UI_CONFIG = {
  // Example usage:
  // 'summarize_patient_note': {
  //   'note_text': { widget: 'textarea', rows: 10 },
  //   'criteria': { widget: 'text' } // Override: don't make this textarea
  // },

  // Add tool-specific overrides as needed
};

/**
 * Get UI configuration for a specific field
 *
 * @param {string} toolName - The name of the tool
 * @param {string} fieldName - The name of the field
 * @param {object} fieldSchema - The JSON Schema for the field
 * @returns {object} UI config with widget type and optional props
 */
export function getFieldUIConfig(toolName, fieldName, fieldSchema) {
  // 1. Check for tool-specific override first
  if (FIELD_UI_CONFIG[toolName]?.[fieldName]) {
    return FIELD_UI_CONFIG[toolName][fieldName];
  }

  // 2. Pattern-based inference (handles most cases automatically)
  const type = fieldSchema.type;

  // Handle enum fields
  if (Array.isArray(fieldSchema.enum)) {
    return { widget: 'enum' };
  }

  // Handle boolean fields
  if (type === 'boolean') {
    return { widget: 'boolean' };
  }

  // Handle string fields with pattern detection
  if (type === 'string') {
    // Multiline patterns: contains 'note', ends with '_text', or is 'text'
    if (
      fieldName.includes('note') ||
      fieldName.endsWith('_text') ||
      fieldName === 'text'
    ) {
      return { widget: 'textarea', rows: 6 };
    }

    // Default string = single-line text
    return { widget: 'text' };
  }

  // Handle numeric fields
  if (type === 'integer' || type === 'number') {
    return { widget: 'number' };
  }

  // Handle PromptInput object type - check for $ref or type='object'
  if (fieldName === 'prompt' && (type === 'object' || fieldSchema.$ref)) {
    return { widget: 'prompt' };
  }

  // Fallback to text input
  return { widget: 'text' };
}
