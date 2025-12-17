import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Switch,
  FormControlLabel,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Tabs,
  Tab,
  Paper,
  IconButton
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import { toolsService } from '../../../services/ApiService';
import { getFieldUIConfig } from './InputFieldRenderer';
import PromptDialog from '../Prompt/PromptDialog';
import OutputRenderer from './OutputFieldRenderer';

// Simple pretty JSON component
const PrettyJson = ({ data }) => (
  <Box component="pre" sx={{
    backgroundColor: 'surface.main',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 1,
    p: 1.5,
    overflow: 'auto',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    maxHeight: 320
  }}>
    {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
  </Box>
);

function coerceValueByType(value, type) {
  if (type === 'integer' || type === 'number') {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = type === 'integer' ? parseInt(value, 10) : parseFloat(value);
    return Number.isNaN(num) ? undefined : num;
  }
  if (type === 'boolean') {
    return Boolean(value);
  }
  return value;
}

function fieldOrder(schema) {
  if (!schema || !schema.properties) return [];
  const props = Object.keys(schema.properties);
  const req = schema.required || [];
  // required first, then others in given order; bubble mrn/csn if present
  const mrnCsn = ['mrn', 'csn'];
  const prioritized = props.sort((a, b) => {
    const aReq = req.includes(a) ? 1 : 0;
    const bReq = req.includes(b) ? 1 : 0;
    if (aReq !== bReq) return bReq - aReq;
    const aMrnCsn = mrnCsn.includes(a) ? 1 : 0;
    const bMrnCsn = mrnCsn.includes(b) ? 1 : 0;
    if (aMrnCsn !== bMrnCsn) return bMrnCsn - aMrnCsn;
    return 0;
  });
  return prioritized;
}

const ToolComponent = ({ tool }) => {
  const { name, category, description, input_schema: schema, output_schema } = tool;

  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [runError, setRunError] = useState(null);
  const [tab, setTab] = useState(0); // 0: Result, 1: Raw, 2: Request
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editingPromptField, setEditingPromptField] = useState(null);

  // Initialize default values from schema
  useEffect(() => {
    setResult(null);
    setRunError(null);
    setTab(0);
    if (!schema || !schema.properties) {
      setValues({});
      return;
    }
    const init = {};
    const order = fieldOrder(schema);
    order.forEach((key) => {
      const field = schema.properties[key];
      const def = field?.default;

      // Check if this is a prompt field (object type with 'prompt' name)
      if (field?.type === 'object' && key === 'prompt') {
        // Initialize with default PromptInput structure
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
    setValues(init);
    setErrors({});
  }, [name, schema]);

  const orderedFields = useMemo(() => fieldOrder(schema), [schema]);

  const getAvailableVariables = (fieldKey) => {
    if (!schema?.properties) return [];
    // Return all field names EXCEPT the current prompt field
    return Object.keys(schema.properties).filter(key => key !== fieldKey);
  };

  const validate = () => {
    const newErrors = {};
    const req = schema?.required || [];
    req.forEach((key) => {
      const field = schema.properties?.[key] || {};
      const type = field.type;
      const v = values[key];
      if (type === 'boolean') {
        // booleans are always either true/false; skip empty validation
      } else if (type === 'object' && key === 'prompt') {
        // Validate PromptInput: must have system_prompt and user_prompt
        if (!v?.system_prompt?.trim() || !v?.user_prompt?.trim()) {
          newErrors[key] = 'Prompt configuration required';
        }
      } else if (v === undefined || v === null || v === '') {
        newErrors[key] = 'Required';
      }
    });
    // simple numeric constraints
    orderedFields.forEach((key) => {
      const field = schema.properties?.[key];
      if (!field) return;
      const type = field.type;
      if (type === 'integer' || type === 'number') {
        const v = values[key];
        if (v !== '' && v !== undefined) {
          const num = type === 'integer' ? parseInt(v, 10) : parseFloat(v);
          if (Number.isNaN(num)) newErrors[key] = 'Must be a number';
          if (field.minimum !== undefined && num < field.minimum) newErrors[key] = `Min ${field.minimum}`;
          if (field.maximum !== undefined && num > field.maximum) newErrors[key] = `Max ${field.maximum}`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (key, field, evtOrValue) => {
    const type = field.type;
    let val;
    if (type === 'boolean') {
      val = !!evtOrValue?.target?.checked;
    } else if (field.enum) {
      val = evtOrValue?.target?.value;
    } else {
      val = evtOrValue?.target?.value;
    }
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleRun = async () => {
    setRunError(null);
    setResult(null);
    if (!validate()) return;
    // Coerce types
    const payload = {};
    orderedFields.forEach((key) => {
      const field = schema.properties?.[key] || {};
      const type = field.type;

      // Prompt objects don't need coercion, pass as-is
      if (type === 'object' && key === 'prompt') {
        payload[key] = values[key];
      } else {
        payload[key] = coerceValueByType(values[key], type);
      }
    });

    setRunning(true);
    try {
      const resp = await toolsService.runTool(name, payload);
      setResult(resp.data);
      setTab(0);
    } catch (e) {
      // Handle error detail which might be an object or string
      const detail = e.response?.data?.detail;
      let errorMessage;

      if (typeof detail === 'object' && detail !== null) {
        // Extract message from error object or stringify
        errorMessage = detail.message || JSON.stringify(detail);
      } else {
        errorMessage = detail || e.message || 'Failed to run tool';
      }

      setRunError(errorMessage);
    } finally {
      setRunning(false);
    }
  };

  const handleOpenPromptDialog = (fieldKey) => {
    setEditingPromptField(fieldKey);
    setPromptDialogOpen(true);
  };

  const handleClosePromptDialog = () => {
    setPromptDialogOpen(false);
    setEditingPromptField(null);
  };

  const handleSavePrompt = (newPromptValue) => {
    if (editingPromptField) {
      setValues(prev => ({
        ...prev,
        [editingPromptField]: newPromptValue
      }));
    }
    handleClosePromptDialog();
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{name}</Typography>
        {category && (
          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
            {category}
          </Typography>
        )}
        {description && (
          <Typography variant="body2" color="text.secondary">{description}</Typography>
        )}
      </Box>

      {/* Form */}
      {schema && schema.properties ? (
        <Grid container spacing={2}>
          {orderedFields.map((key) => {
            const field = schema.properties[key];
            const type = field?.type;
            const label = key;
            const helper = field?.description || '';

            // Get UI configuration for this field
            const uiConfig = getFieldUIConfig(name, key, field);

            // Prompt widget
            if (uiConfig.widget === 'prompt') {
              const promptValue = values[key] || { system_prompt: '', user_prompt: '', examples: [] };
              const isConfigured = promptValue.system_prompt?.trim() && promptValue.user_prompt?.trim();

              return (
                <Grid size={12} key={key}>
                  <Box sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    backgroundColor: 'background.paper'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {isConfigured
                            ? 'Custom prompt configured'
                            : 'Click to configure prompt'}
                        </Typography>
                      </Box>
                      <IconButton
                        onClick={() => handleOpenPromptDialog(key)}
                        color="primary"
                        sx={{
                          backgroundColor: isConfigured ? 'primary.light' : 'transparent',
                          '&:hover': { backgroundColor: 'primary.light' }
                        }}
                      >
                        <SettingsIcon />
                      </IconButton>
                    </Box>
                    {helper && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        {helper}
                      </Typography>
                    )}
                  </Box>
                </Grid>
              );
            }

            // Unsupported nested types for PoC
            if (type === 'object' || type === 'array') {
              return (
                <Grid size={12} key={key}>
                  <Alert severity="info">Field "{key}" of type "{type}" is not supported in this preview.</Alert>
                </Grid>
              );
            }

            // Enum → Select
            if (uiConfig.widget === 'enum') {
              return (
                <Grid size={12} key={key}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={label}
                    value={values[key] ?? ''}
                    onChange={(e) => handleChange(key, field, e)}
                    helperText={errors[key] || helper}
                    error={Boolean(errors[key])}
                  >
                    {field.enum.map((opt) => (
                      <MenuItem key={String(opt)} value={opt}>{String(opt)}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              );
            }

            // Boolean → Switch
            if (uiConfig.widget === 'boolean') {
              return (
                <Grid size={12} key={key}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(values[key])}
                        onChange={(e) => handleChange(key, field, e)}
                        color="primary"
                      />
                    }
                    label={label}
                  />
                  {helper && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5 }}>{helper}</Typography>
                  )}
                </Grid>
              );
            }

            // Textarea → Multiline TextField
            if (uiConfig.widget === 'textarea') {
              return (
                <Grid size={12} key={key}>
                  <TextField
                    fullWidth
                    multiline
                    rows={uiConfig.rows || 6}
                    size="small"
                    label={label}
                    value={values[key] ?? ''}
                    onChange={(e) => handleChange(key, field, e)}
                    helperText={errors[key] || helper}
                    error={Boolean(errors[key])}
                    placeholder={uiConfig.placeholder}
                    InputProps={{
                      readOnly: uiConfig.readOnly || false
                    }}
                  />
                </Grid>
              );
            }

            // Number → Number TextField
            if (uiConfig.widget === 'number') {
              return (
                <Grid size={12} key={key}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label={label}
                    value={values[key] ?? ''}
                    onChange={(e) => handleChange(key, field, e)}
                    helperText={errors[key] || helper}
                    error={Boolean(errors[key])}
                    inputProps={{
                      min: uiConfig.min ?? field?.minimum,
                      max: uiConfig.max ?? field?.maximum
                    }}
                  />
                </Grid>
              );
            }

            // Text → Single-line TextField (default)
            return (
              <Grid size={12} key={key}>
                <TextField
                  fullWidth
                  size="small"
                  type="text"
                  label={label}
                  value={values[key] ?? ''}
                  onChange={(e) => handleChange(key, field, e)}
                  helperText={errors[key] || helper}
                  error={Boolean(errors[key])}
                  placeholder={uiConfig.placeholder}
                  InputProps={{
                    readOnly: uiConfig.readOnly || false
                  }}
                />
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>This tool has no declared inputs.</Alert>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Button
          variant="contained"
          onClick={handleRun}
          disabled={running}
        >
          {running ? (<><CircularProgress size={18} sx={{ mr: 1 }} /> Running…</>) : 'Run'}
        </Button>
      </Box>

      {runError && (
        <Alert severity="error" sx={{ mt: 2 }}>{runError}</Alert>
      )}

      {/* Results */}
      {(result || runError) && (
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 2 }} />
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Result" />
            <Tab label="Raw" />
            <Tab label="Request" />
          </Tabs>
          {tab === 0 && (
            <OutputRenderer
              toolName={name}
              outputData={result?.result ?? result}
              outputSchema={output_schema}
            />
          )}
          {tab === 1 && (
            <PrettyJson data={result} />
          )}
          {tab === 2 && (
            <PrettyJson data={{ tool_name: name, inputs: values }} />
          )}
        </Box>
      )}

      {/* Prompt Configuration Dialog */}
      <PromptDialog
        open={promptDialogOpen}
        onClose={handleClosePromptDialog}
        value={editingPromptField ? values[editingPromptField] : null}
        onChange={handleSavePrompt}
        availableVariables={editingPromptField ? getAvailableVariables(editingPromptField) : []}
        outputSchema={output_schema}
      />
    </Box>
  );
};

export default ToolComponent;

