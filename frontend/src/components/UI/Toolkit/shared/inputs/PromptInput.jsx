import React, { useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import PromptDialog from '../../../Prompt/PromptDialog';

/**
 * PromptInput - Dialog-based prompt configuration input
 *
 * Opens a modal dialog for configuring system prompt, user prompt, and examples.
 *
 * @param {string} name - Field name (used as label)
 * @param {object} value - Current prompt value { system_prompt, user_prompt, examples }
 * @param {function} onChange - Callback with new value
 * @param {object} schema - JSON Schema for field
 * @param {string} error - Error message
 * @param {boolean} disabled - Disabled state
 * @param {array} availableVariables - Variables that can be inserted into prompts
 * @param {object} outputSchema - Output schema for structured response examples
 */
function PromptInput({
  name,
  value,
  onChange,
  schema = {},
  error,
  disabled = false,
  availableVariables = [],
  outputSchema = null,
  helpText,
  ...props
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Ensure value has proper structure
  const promptValue = value || {
    system_prompt: '',
    user_prompt: '',
    examples: []
  };

  const isConfigured = promptValue.system_prompt?.trim() && promptValue.user_prompt?.trim();

  const handleOpenDialog = () => {
    if (!disabled) {
      setDialogOpen(true);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleSavePrompt = (newValue) => {
    onChange(newValue);
    setDialogOpen(false);
  };

  return (
    <>
      <Box sx={{
        p: 2,
        border: '1px solid',
        borderColor: error ? 'error.main' : 'divider',
        borderRadius: 1,
        backgroundColor: 'background.paper'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {name}
            </Typography>
            <Typography variant="caption" color={error ? 'error' : 'text.secondary'}>
              {error || (isConfigured ? 'Custom prompt configured' : 'Click to configure prompt')}
            </Typography>
          </Box>
          <IconButton
            onClick={handleOpenDialog}
            color="primary"
            disabled={disabled}
            sx={{
              backgroundColor: isConfigured ? 'primary.light' : 'transparent',
              '&:hover': { backgroundColor: 'primary.light' }
            }}
          >
            <SettingsIcon />
          </IconButton>
        </Box>
        {(helpText || schema.description) && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {helpText || schema.description}
          </Typography>
        )}
      </Box>

      <PromptDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        value={promptValue}
        onChange={handleSavePrompt}
        readOnly={disabled}
        availableVariables={availableVariables}
        outputSchema={outputSchema}
      />
    </>
  );
}

export default PromptInput;