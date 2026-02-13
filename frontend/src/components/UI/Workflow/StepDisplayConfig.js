/**
 * Step Display Configuration
 *
 * Tool-specific display mappings for step input rendering.
 * Configure how individual step inputs should be displayed in the Planning page.
 *
 * Available display types:
 * - text: Plain text display (default)
 * - badge: Highlighted chip/badge
 * - link: Clickable link that opens a dialog
 * - truncated: Long text with "show more" toggle
 */

// Tool-specific display overrides
// Structure: { toolName: { fieldName: { display, ...props } } }
export const STEP_DISPLAY_CONFIG = {
  // Example usage (when ready to add configs):
  // 'read_patient_note': {
  //   'note_id': { display: 'link', linkText: 'Note #{value}' },
  //   'mrn': { display: 'badge' }
  // }
};

/**
 * Get display configuration for a specific step input field
 *
 * @param {string} toolName - The name of the tool
 * @param {string} fieldName - The name of the input field
 * @param {any} fieldValue - The value of the field (for type inference)
 * @returns {object} Display config with display type and optional props
 */
export function getStepDisplayConfig(toolName, fieldName, fieldValue) {
  // 1. Check for tool-specific override
  if (STEP_DISPLAY_CONFIG[toolName]?.[fieldName]) {
    return STEP_DISPLAY_CONFIG[toolName][fieldName];
  }

  // 2. Detect prompt objects
  if (fieldName === 'prompt' && typeof fieldValue === 'object' && fieldValue !== null) {
    return { display: 'prompt-icon' };
  }

  // 3. Detect model objects
  if (fieldName === 'model' && typeof fieldValue === 'object' && fieldValue !== null) {
    return { display: 'model-picker' };
  }
  if (fieldName === 'model' && fieldValue === null) {
    return { display: 'model-picker-empty' };
  }

  // 4. Default fallback: plain text
  return { display: 'text' };
}
