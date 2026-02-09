import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import OutputDefinitionCard from './OutputDefinitionCard';

const OutputDefinitionsSection = ({ definitions }) => {
  return (
    <Box sx={{ mt: 2 }}>
      {/* Section Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mb: 1.5,
        pb: 1,
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Output Definitions
        </Typography>
        <Chip
          label={definitions.length}
          size="small"
          sx={{ height: 20, minWidth: 24 }}
        />
      </Box>

      {/* Cards Container */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {definitions.map(definition => (
          <OutputDefinitionCard
            key={definition.id}
            definition={definition}
          />
        ))}
      </Box>
    </Box>
  );
};

export default OutputDefinitionsSection;
