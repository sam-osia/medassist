import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Divider
} from '@mui/material';

const OutputDefinitionCard = ({ definition, mapping }) => {
  return (
    <Card variant="outlined" sx={{ backgroundColor: 'action.hover' }}>
      <CardContent>
        {/* Header: Label + Tool Name Chip (if present) */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {definition.label}
          </Typography>
          {definition.tool_name && (
            <Chip
              label={definition.tool_name}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {/* Name (monospace) */}
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          {definition.name}
        </Typography>

        {/* Description (if present) */}
        {definition.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {definition.description}
          </Typography>
        )}

        <Divider sx={{ my: 1.5 }} />

        {/* Output Fields Section */}
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          OUTPUT FIELDS
        </Typography>
        <Box sx={{ mt: 0.5 }}>
          {definition.fields?.map(field => (
            <Box key={field.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {field.name}
              </Typography>
              <Chip label={field.type} size="small" variant="outlined" sx={{ height: 20 }} />
              {field.description && (
                <Typography variant="caption" color="text.secondary">
                  — {field.description}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* Field Mappings Section (if mapping exists) */}
        {mapping && mapping.field_mappings?.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 1.5, display: 'block' }}>
              FIELD MAPPINGS
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {mapping.field_mappings.map((fm, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {fm.field_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">←</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                    {fm.variable_path}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}

        {/* Evidence Section (if mapping has evidence) */}
        {mapping && mapping.evidence?.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 1.5, display: 'block' }}>
              EVIDENCE
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {mapping.evidence.map((ev, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                  <Chip label={ev.resource_type} size="small" variant="outlined" />
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    {ev.id_path}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OutputDefinitionCard;
