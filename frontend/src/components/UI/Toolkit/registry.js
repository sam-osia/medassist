/**
 * Tool Registry
 *
 * Central registry for tool-specific UI components.
 * Tools not registered here will use generic fallback components.
 *
 * To add a new custom tool:
 * 1. Create tools/<tool_name>/InputForm.jsx (or use null for generic)
 * 2. Create tools/<tool_name>/OutputView.jsx (or use null for generic)
 * 3. Add entry to TOOL_REGISTRY below
 */

// Tool-specific components
import KeywordCountInputForm from './tools/keyword_count/InputForm';
import KeywordCountOutputView from './tools/keyword_count/OutputView';

import IdentifyFlagInputForm from './tools/identify_flag/InputForm';
import IdentifyFlagOutputView from './tools/identify_flag/OutputView';

import AnalyzeNoteInputForm from './tools/analyze_note_with_span_and_reason/InputForm';
import AnalyzeNoteOutputView from './tools/analyze_note_with_span_and_reason/OutputView';

// Generic fallback components
import GenericInputForm from './generic/GenericInputForm';
import GenericOutputView from './generic/GenericOutputView';

/**
 * Tool Registry
 *
 * Each entry can have:
 * - InputForm: Custom input form component (null = use GenericInputForm)
 * - OutputView: Custom output view component (null = use GenericOutputView)
 */
const TOOL_REGISTRY = {
  keyword_count: {
    InputForm: KeywordCountInputForm,
    OutputView: KeywordCountOutputView,
  },
  identify_flag: {
    InputForm: IdentifyFlagInputForm,
    OutputView: IdentifyFlagOutputView,
  },
  analyze_note_with_span_and_reason: {
    InputForm: AnalyzeNoteInputForm,
    OutputView: AnalyzeNoteOutputView,
  },
  // Add more tools here as needed
  // example_tool: {
  //   InputForm: null,  // Use generic
  //   OutputView: ExampleToolOutputView,
  // },
};

/**
 * Get the input form component for a tool
 *
 * @param {string} toolName - The tool name
 * @returns {React.Component} InputForm component
 */
export function getInputForm(toolName) {
  const config = TOOL_REGISTRY[toolName];
  return config?.InputForm || GenericInputForm;
}

/**
 * Get the output view component for a tool
 *
 * @param {string} toolName - The tool name
 * @returns {React.Component} OutputView component
 */
export function getOutputView(toolName) {
  const config = TOOL_REGISTRY[toolName];
  return config?.OutputView || GenericOutputView;
}

/**
 * Check if a tool has custom components registered
 *
 * @param {string} toolName - The tool name
 * @returns {boolean} True if tool has any custom components
 */
export function isRegisteredTool(toolName) {
  return toolName in TOOL_REGISTRY;
}

/**
 * Get the full registry config for a tool
 *
 * @param {string} toolName - The tool name
 * @returns {object|null} Tool config or null if not registered
 */
export function getToolConfig(toolName) {
  return TOOL_REGISTRY[toolName] || null;
}

/**
 * List all registered tool names
 *
 * @returns {string[]} Array of registered tool names
 */
export function listRegisteredTools() {
  return Object.keys(TOOL_REGISTRY);
}

export default TOOL_REGISTRY;
