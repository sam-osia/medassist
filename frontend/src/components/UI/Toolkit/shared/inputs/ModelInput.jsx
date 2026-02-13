import React, { useState, useEffect } from 'react';
import { FormControl, InputLabel, Select, MenuItem, Typography, Box } from '@mui/material';
import { apiKeysService } from '../../../../../services/ApiService';

/**
 * ModelInput - Dropdown for selecting an LLM model from user's assigned keys.
 *
 * @param {string} name - Field name
 * @param {object|null} value - Current value: { key_name: "..." } or null
 * @param {function} onChange - Callback with new value
 * @param {boolean} disabled - Disabled state
 */
function ModelInput({ name, value, onChange, disabled = false }) {
  const [myKeys, setMyKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiKeysService.getMyKeys()
      .then(res => setMyKeys(res.data.keys || []))
      .catch(() => setMyKeys([]))
      .finally(() => setLoading(false));
  }, []);

  const selectedKeyName = value?.key_name || '';

  const handleChange = (e) => {
    const keyName = e.target.value;
    onChange(keyName ? { key_name: keyName } : null);
  };

  if (loading) {
    return <Typography variant="body2" color="text.secondary">Loading models...</Typography>;
  }

  if (myKeys.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        No models assigned. Ask an admin to assign API keys to your account.
      </Typography>
    );
  }

  return (
    <FormControl fullWidth disabled={disabled} size="small">
      <InputLabel>Model</InputLabel>
      <Select
        value={selectedKeyName}
        label="Model"
        onChange={handleChange}
      >
        {myKeys.map(k => (
          <MenuItem key={k.key_name} value={k.key_name}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">{k.key_name}</Typography>
              <Typography variant="caption" color="text.secondary">
                ({k.model_name} / {k.provider})
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default ModelInput;
