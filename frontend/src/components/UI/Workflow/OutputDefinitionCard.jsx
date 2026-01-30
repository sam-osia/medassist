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
        {/* Header: Label + Type Chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {definition.label}
          </Typography>
          <Chip
            label={definition.output_type}
            size="small"
            color={definition.output_type === 'direct' ? 'primary' : 'secondary'}
          />
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
          {definition.output_fields?.map(field => (
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

        {/* Evidence Schema Section */}
        {definition.evidence_schema && (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 1.5, display: 'block' }}>
              EVIDENCE SCHEMA
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {definition.evidence_schema.type === 'direct' ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={definition.evidence_schema.resource_type} size="small" />
                  {definition.evidence_schema.fields?.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      ({definition.evidence_schema.fields.map(f => f.name).join(', ')})
                    </Typography>
                  )}
                </Box>
              ) : (
                // Aggregated: show sources
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {definition.evidence_schema.sources?.map((source, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={source.resource_type} size="small" />
                      <Typography variant="caption" color="text.secondary">
                        → {source.role}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </>
        )}

        {/* Value Mappings Section (if mapping exists) */}
        {mapping && mapping.value_sources?.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 1.5, display: 'block' }}>
              VALUE MAPPINGS
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {mapping.value_sources.map((vs, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {vs.output_field}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">←</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                    {vs.variable_path}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}

        {/* Evidence Sources Section (if mapping has evidence_sources) */}
        {mapping && mapping.evidence_sources?.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 1.5, display: 'block' }}>
              EVIDENCE SOURCES
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {mapping.evidence_sources.map((es, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {es.step_id}
                  </Typography>
                  <Chip label={es.resource_type} size="small" variant="outlined" />
                  <Chip label={es.role} size="small" color="info" variant="outlined" />
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
