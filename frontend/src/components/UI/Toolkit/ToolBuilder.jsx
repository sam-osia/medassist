import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  Alert
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const FIELD_TYPES = ['string', 'integer', 'number', 'boolean'];
const NAME_REGEX = /^[a-z][a-z0-9_]*$/;

const emptyField = () => ({
  name: '',
  label: '',
  field_type: 'string',
  description: '',
  required: true,
  is_enum: false,
  enum_values: '',
});

const ToolBuilder = ({ open, onClose, onSave, existingTool = null }) => {
  const [toolName, setToolName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('custom');
  const [inputFields, setInputFields] = useState([]);
  const [outputFields, setOutputFields] = useState([emptyField()]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Reset form when dialog opens or existingTool changes
  useEffect(() => {
    if (!open) return;
    if (existingTool) {
      setToolName(existingTool.tool_name || '');
      setDisplayName(existingTool.display_name || '');
      setDescription(existingTool.description || '');
      setCategory(existingTool.category || 'custom');
      setInputFields(
        (existingTool.input_fields || []).map(f => ({
          ...f,
          enum_values: f.is_enum && f.enum_values ? f.enum_values.join(', ') : '',
        }))
      );
      setOutputFields(
        (existingTool.output_fields || []).map(f => ({
          ...f,
          enum_values: f.is_enum && f.enum_values ? f.enum_values.join(', ') : '',
        }))
      );
      setSystemPrompt(existingTool.prompt_defaults?.system_prompt || '');
      setUserPrompt(existingTool.prompt_defaults?.user_prompt || '');
    } else {
      setToolName('');
      setDisplayName('');
      setDescription('');
      setCategory('custom');
      setInputFields([]);
      setOutputFields([emptyField()]);
      setSystemPrompt('');
      setUserPrompt('');
    }
    setErrors({});
    setSaveError(null);
  }, [open, existingTool]);

  const validate = () => {
    const errs = {};
    if (!NAME_REGEX.test(toolName)) errs.toolName = 'Must start with lowercase letter, only a-z, 0-9, _';
    if (!displayName.trim()) errs.displayName = 'Required';
    if (outputFields.length === 0) errs.outputFields = 'At least one output field required';
    if (!systemPrompt.trim()) errs.systemPrompt = 'Required';
    if (!userPrompt.trim()) errs.userPrompt = 'Required';

    // Validate each field set
    const validateFieldSet = (fields, prefix) => {
      const names = new Set();
      fields.forEach((f, i) => {
        if (!NAME_REGEX.test(f.name)) errs[`${prefix}_${i}_name`] = 'Invalid name';
        if (!f.label.trim()) errs[`${prefix}_${i}_label`] = 'Required';
        if (names.has(f.name)) errs[`${prefix}_${i}_name`] = 'Duplicate name';
        names.add(f.name);
        if (f.is_enum) {
          const vals = f.enum_values.split(',').map(s => s.trim()).filter(Boolean);
          if (vals.length === 0) errs[`${prefix}_${i}_enum`] = 'Enum values required';
        }
      });
      if (fields.length > 20) errs[prefix] = 'Max 20 fields';
    };

    validateFieldSet(inputFields, 'input');
    validateFieldSet(outputFields, 'output');
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const serializeFields = (fields) =>
      fields.map(f => ({
        name: f.name,
        label: f.label,
        field_type: f.field_type,
        description: f.description || '',
        required: f.required,
        is_enum: f.is_enum,
        enum_values: f.is_enum
          ? f.enum_values.split(',').map(s => s.trim()).filter(Boolean)
          : null,
      }));

    const data = {
      tool_name: toolName,
      display_name: displayName,
      description,
      category,
      input_fields: serializeFields(inputFields),
      output_fields: serializeFields(outputFields),
      prompt_defaults: {
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
      },
    };

    setSaving(true);
    setSaveError(null);
    try {
      await onSave(data, existingTool);
      onClose();
    } catch (e) {
      const detail = e.response?.data?.detail;
      setSaveError(typeof detail === 'string' ? detail : JSON.stringify(detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (list, setList, idx, key, value) => {
    setList(prev => prev.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));
  };

  const removeField = (list, setList, idx) => {
    setList(prev => prev.filter((_, i) => i !== idx));
  };

  const renderFieldRows = (fields, setFields, prefix) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {fields.map((f, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Name"
            value={f.name}
            onChange={e => updateField(fields, setFields, i, 'name', e.target.value)}
            error={!!errors[`${prefix}_${i}_name`]}
            helperText={errors[`${prefix}_${i}_name`]}
            sx={{ width: 140 }}
          />
          <TextField
            size="small"
            label="Label"
            value={f.label}
            onChange={e => updateField(fields, setFields, i, 'label', e.target.value)}
            error={!!errors[`${prefix}_${i}_label`]}
            sx={{ width: 140 }}
          />
          <Select
            size="small"
            value={f.field_type}
            onChange={e => updateField(fields, setFields, i, 'field_type', e.target.value)}
            sx={{ width: 110 }}
          >
            {FIELD_TYPES.map(t => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </Select>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={f.required}
                onChange={e => updateField(fields, setFields, i, 'required', e.target.checked)}
              />
            }
            label="Req"
            sx={{ mx: 0 }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={f.is_enum}
                onChange={e => updateField(fields, setFields, i, 'is_enum', e.target.checked)}
              />
            }
            label="Enum"
            sx={{ mx: 0 }}
          />
          {f.is_enum && (
            <TextField
              size="small"
              label="Values (comma-sep)"
              value={f.enum_values}
              onChange={e => updateField(fields, setFields, i, 'enum_values', e.target.value)}
              error={!!errors[`${prefix}_${i}_enum`]}
              sx={{ width: 180 }}
            />
          )}
          <IconButton size="small" onClick={() => removeField(fields, setFields, i)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => setFields(prev => [...prev, emptyField()])}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add Field
      </Button>
    </Box>
  );

  // Available template variables from input fields
  const templateVars = inputFields.filter(f => f.name).map(f => f.name);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{existingTool ? 'Edit Custom Tool' : 'Create Custom Tool'}</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
        {saveError && <Alert severity="error">{saveError}</Alert>}

        {/* Tool Metadata */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Tool Metadata</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Tool Name (snake_case)"
            value={toolName}
            onChange={e => setToolName(e.target.value)}
            error={!!errors.toolName}
            helperText={errors.toolName}
            sx={{ width: 200 }}
          />
          <TextField
            size="small"
            label="Display Name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            error={!!errors.displayName}
            helperText={errors.displayName}
            sx={{ width: 200 }}
          />
          <TextField
            size="small"
            label="Category"
            value={category}
            onChange={e => setCategory(e.target.value)}
            sx={{ width: 140 }}
          />
        </Box>
        <TextField
          size="small"
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          multiline
          rows={2}
          fullWidth
        />

        {/* Input Fields */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Input Fields</Typography>
        {renderFieldRows(inputFields, setInputFields, 'input')}

        {/* Output Fields */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Output Fields {errors.outputFields && <Typography component="span" color="error" variant="caption"> - {errors.outputFields}</Typography>}
        </Typography>
        {renderFieldRows(outputFields, setOutputFields, 'output')}

        {/* Default Prompts */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Default Prompts</Typography>
        <TextField
          label="System Prompt"
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          multiline
          rows={4}
          fullWidth
          error={!!errors.systemPrompt}
          helperText={errors.systemPrompt}
        />
        {templateVars.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>Variables:</Typography>
            {templateVars.map(v => (
              <Chip
                key={v}
                label={`{{${v}}}`}
                size="small"
                onClick={() => setSystemPrompt(prev => prev + `{{${v}}}`)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}
        <TextField
          label="User Prompt"
          value={userPrompt}
          onChange={e => setUserPrompt(e.target.value)}
          multiline
          rows={4}
          fullWidth
          error={!!errors.userPrompt}
          helperText={errors.userPrompt}
        />
        {templateVars.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>Variables:</Typography>
            {templateVars.map(v => (
              <Chip
                key={v}
                label={`{{${v}}}`}
                size="small"
                onClick={() => setUserPrompt(prev => prev + `{{${v}}}`)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ToolBuilder;
