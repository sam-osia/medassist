import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Divider,
  Card,
  IconButton,
  CircularProgress,
  Alert
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { renderEditableOutputField } from '../Toolkit/shared/outputs';

// Variable picker component
const VariablePicker = ({ variables, onInsert, readOnly = false, promptValue = null }) => {
  // Check if a variable is used in the prompt
  const isVariableUsed = (varName) => {
    if (!readOnly || !promptValue) return false;

    const templatePattern = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');

    // Check system_prompt
    if (promptValue.system_prompt && templatePattern.test(promptValue.system_prompt)) {
      return true;
    }

    // Check user_prompt
    if (promptValue.user_prompt && templatePattern.test(promptValue.user_prompt)) {
      return true;
    }

    // Check examples
    if (promptValue.examples && Array.isArray(promptValue.examples)) {
      for (const example of promptValue.examples) {
        if (example.user_input && templatePattern.test(example.user_input)) {
          return true;
        }
        if (example.assistant_response && templatePattern.test(example.assistant_response)) {
          return true;
        }
      }
    }

    return false;
  };

  return (
    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {variables.length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No variables available
        </Typography>
      ) : (
        <>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            Variables
          </Typography>
          {variables.map(varName => {
            const isUsed = isVariableUsed(varName);
            return (
              <Button
                key={varName}
                size="small"
                variant={readOnly ? (isUsed ? "contained" : "outlined") : "outlined"}
                onClick={readOnly ? undefined : () => onInsert(varName)}
                disabled={readOnly}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  ...(readOnly && !isUsed && {
                    opacity: 0.4,
                    borderStyle: 'dashed'
                  }),
                  ...(readOnly && {
                    cursor: 'default'
                  })
                }}
              >
                {varName}
              </Button>
            );
          })}
        </>
      )}
    </Box>
  );
};

const PromptDialog = ({ open, onClose, value, onChange, readOnly = false, availableVariables = [], outputSchema = null }) => {
  const [localValue, setLocalValue] = useState({
    system_prompt: '',
    user_prompt: '',
    examples: []
  });
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const userPromptRef = useRef(null);

  // Sync local state with prop value when dialog opens
  useEffect(() => {
    if (open && value) {
      setLocalValue({
        system_prompt: value.system_prompt || '',
        user_prompt: value.user_prompt || '',
        examples: value.examples || []
      });
    } else if (open && !value) {
      // Initialize with empty values if no value provided
      setLocalValue({
        system_prompt: '',
        user_prompt: '',
        examples: []
      });
    }
  }, [open, value]);

  // Check if we have structured output
  const hasStructuredOutput = outputSchema?.properties &&
                              Object.keys(outputSchema.properties).length > 0;

  // Validation check
  const isValid = () => {
    return localValue.system_prompt?.trim() && localValue.user_prompt?.trim();
  };

  // Handle save
  const handleSave = async () => {
    if (!isValid()) {
      setShowErrors(true);
      return;
    }

    if (onChange) {
      setSaving(true);
      setSaveError(null);
      try {
        await onChange(localValue);
        setShowErrors(false);
        onClose();
      } catch (error) {
        setSaveError(error.message || 'Failed to save prompt');
      } finally {
        setSaving(false);
      }
    } else {
      setShowErrors(false);
      onClose();
    }
  };

  // Handle cancel/close
  const handleClose = () => {
    // Reset local state to original value on cancel
    if (value) {
      setLocalValue({
        system_prompt: value.system_prompt || '',
        user_prompt: value.user_prompt || '',
        examples: value.examples || []
      });
    }
    setShowErrors(false);
    onClose();
  };

  // Handle adding a new example
  const handleAddExample = () => {
    setLocalValue(prev => ({
      ...prev,
      examples: [...(prev.examples || []), { user_input: '', assistant_response: hasStructuredOutput ? {} : '' }]
    }));
  };

  // Handle removing an example
  const handleRemoveExample = (index) => {
    setLocalValue(prev => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index)
    }));
  };

  // Handle changing an example field
  const handleExampleChange = (index, field, value) => {
    setLocalValue(prev => ({
      ...prev,
      examples: prev.examples.map((ex, i) =>
        i === index ? { ...ex, [field]: value } : ex
      )
    }));
  };

  // Handle changing a structured field in assistant_response
  const handleStructuredFieldChange = (exampleIndex, fieldName, value) => {
    setLocalValue(prev => ({
      ...prev,
      examples: prev.examples.map((ex, i) =>
        i === exampleIndex
          ? {
              ...ex,
              assistant_response: {
                ...(ex.assistant_response || {}),
                [fieldName]: value
              }
            }
          : ex
      )
    }));
  };

  // Handle inserting a variable into user_prompt
  const insertVariable = (varName) => {
    const input = userPromptRef.current?.querySelector('textarea');
    if (!input) return;

    const cursorPos = input.selectionStart || localValue.user_prompt.length;
    const currentText = localValue.user_prompt || '';
    const beforeCursor = currentText.substring(0, cursorPos);
    const afterCursor = currentText.substring(cursorPos);

    const newText = beforeCursor + `{{${varName}}}` + afterCursor;

    setLocalValue(prev => ({
      ...prev,
      user_prompt: newText
    }));

    // Set cursor position after the inserted variable
    setTimeout(() => {
      const newPos = cursorPos + varName.length + 4; // +4 for {{}}
      input.setSelectionRange(newPos, newPos);
      input.focus();
    }, 0);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Configure Prompt</DialogTitle>
      <DialogContent>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          {/* System Prompt Field */}
          <TextField
            fullWidth
            multiline
            rows={6}
            label="System Prompt"
            value={localValue.system_prompt || ''}
            onChange={(e) => setLocalValue(prev => ({ ...prev, system_prompt: e.target.value }))}
            disabled={readOnly}
            error={showErrors && !localValue.system_prompt?.trim()}
            helperText={
              showErrors && !localValue.system_prompt?.trim()
                ? "System prompt is required"
                : "Instructions for the AI model's behavior and role"
            }
            placeholder="You are a helpful medical assistant..."
          />

          {/* User Prompt Field with Variable Picker */}
          <Box>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="User Prompt"
              value={localValue.user_prompt || ''}
              onChange={(e) => setLocalValue(prev => ({ ...prev, user_prompt: e.target.value }))}
              disabled={readOnly}
              error={showErrors && !localValue.user_prompt?.trim()}
              helperText={
                showErrors && !localValue.user_prompt?.trim()
                  ? "User prompt is required"
                  : "The main prompt sent to the AI. Use {{variable}} to insert values."
              }
              placeholder="Analyze the following note: {{note}}"
              ref={userPromptRef}
            />
            {availableVariables.length > 0 && (
              <VariablePicker
                variables={availableVariables}
                onInsert={insertVariable}
                readOnly={readOnly}
                promptValue={localValue}
              />
            )}
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Examples Section */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Examples (Optional)
              </Typography>
              {!readOnly && (
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddExample}
                  size="small"
                  variant="outlined"
                >
                  Add Example
                </Button>
              )}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Few-shot examples help guide the AI's response format
            </Typography>

            {/* Examples List */}
            {localValue.examples && localValue.examples.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {localValue.examples.map((example, index) => (
                  <Card key={index} variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Example {index + 1}
                      </Typography>
                      {!readOnly && (
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveExample(index)}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="User Input"
                        value={example.user_input || ''}
                        onChange={(e) => handleExampleChange(index, 'user_input', e.target.value)}
                        disabled={readOnly}
                        placeholder="Example user message..."
                      />
                      {hasStructuredOutput ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                            Expected Response Structure
                          </Typography>
                          {Object.entries(outputSchema.properties).map(([fieldName, fieldSchema]) => (
                            renderEditableOutputField(
                              fieldName,
                              example.assistant_response?.[fieldName],
                              (newValue) => handleStructuredFieldChange(index, fieldName, newValue),
                              fieldSchema
                            )
                          ))}
                        </Box>
                      ) : (
                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          label="Assistant Response"
                          value={example.assistant_response || ''}
                          onChange={(e) => handleExampleChange(index, 'assistant_response', e.target.value)}
                          disabled={readOnly}
                          placeholder="Expected assistant response..."
                        />
                      )}
                    </Box>
                  </Card>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                No examples added yet
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={readOnly || !isValid() || saving}
          startIcon={saving ? <CircularProgress size={20} /> : null}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PromptDialog;
