import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  CircularProgress
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

const ToolSidebar = ({ tools, selectedToolName, onSelectTool, loading }) => {
  const theme = useTheme();

  // Group tools by category
  const grouped = tools.reduce((acc, t) => {
    const cat = t.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <Box sx={{
      width: 350,
      height: 'calc(100vh - 65px)',
      borderRight: 1,
      borderColor: 'divider',
      backgroundColor: theme.palette.background.paper,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header Section */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
          Tools
        </Typography>
      </Box>

      {/* Scrollable Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            {categories.map((cat, idx) => (
              <Box key={cat}>
                {idx > 0 && <Divider />}
                <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {cat}
                  </Typography>
                </Box>
                <List dense disablePadding>
                  {grouped[cat]
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((tool) => (
                      <ListItemButton
                        key={tool.name}
                        selected={tool.name === selectedToolName}
                        onClick={() => onSelectTool(tool.name)}
                        sx={{
                          alignItems: 'flex-start',
                          py: 1.5,
                          px: 2,
                          '&.Mui-selected': {
                            backgroundColor: theme.palette.action.selected,
                            '&:hover': {
                              backgroundColor: theme.palette.action.selected
                            }
                          }
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {tool.display_name || tool.name}
                            </Typography>
                          }
                          secondary={
                            tool.description ? (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {tool.description}
                              </Typography>
                            ) : null
                          }
                        />
                      </ListItemButton>
                    ))}
                </List>
              </Box>
            ))}
            {tools.length === 0 && !loading && (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No tools available
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default ToolSidebar;
