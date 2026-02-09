import React, { useMemo } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { HighlightedText } from '../../shared/outputs';
import { insertMultiKeywordHighlightTags } from '../../../../../utils/highlightUtils';

const KEYWORD_COLORS = [
  '#e57373', // red
  '#64b5f6', // blue
  '#81c784', // green
  '#ffb74d', // orange
  '#ba68c8', // purple
  '#4dd0e1', // cyan
  '#fff176', // yellow
  '#f06292', // pink
  '#a1887f', // brown
  '#90a4ae', // blue-grey
];

function OutputView({ data, schema, toolName, inputs }) {
  const counts = data?.counts || {};
  const text = inputs?.text || '';

  const { keywordColorMap, legend } = useMemo(() => {
    const map = {};
    const items = [];
    let colorIdx = 0;

    for (const [keyword, count] of Object.entries(counts)) {
      const color = KEYWORD_COLORS[colorIdx % KEYWORD_COLORS.length];
      if (count > 0) {
        map[keyword] = color;
      }
      items.push({ keyword, count, color });
      colorIdx++;
    }

    return { keywordColorMap: map, legend: items };
  }, [counts]);

  const highlightedText = useMemo(() => {
    if (!text || Object.keys(keywordColorMap).length === 0) return text;
    return insertMultiKeywordHighlightTags(text, keywordColorMap);
  }, [text, keywordColorMap]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Keyword legend */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Keywords
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {legend.map(({ keyword, count, color }) => (
            <Chip
              key={keyword}
              label={`${keyword}: ${count}`}
              size="small"
              sx={{
                backgroundColor: color,
                color: '#000',
                fontWeight: 600,
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Highlighted text */}
      {text && (
        <HighlightedText
          text={highlightedText}
          label="Analyzed Text"
        />
      )}
    </Box>
  );
}

export default OutputView;
