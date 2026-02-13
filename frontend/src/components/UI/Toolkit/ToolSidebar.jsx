import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
  Chip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const ToolSidebar = ({ tools, selectedToolName, onSelectTool, loading, onCreateTool, onEditTool, onDeleteTool }) => {
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
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
          Tools
        </Typography>
        {onCreateTool && (
          <Tooltip title="Create custom tool">
            <IconButton size="small" onClick={onCreateTool}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
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
                          },
                          '& .custom-actions': { opacity: 0 },
                          '&:hover .custom-actions': { opacity: 1 },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  {tool.display_name || tool.name}
                                </Typography>
                                {tool.uses_llm && (
                                  <Chip label="LLM" size="small" variant="outlined" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
                                )}
                              </Box>
                              {tool.is_custom && (
                                <Box className="custom-actions" sx={{ display: 'flex', gap: 0.5, transition: 'opacity 0.15s' }}>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => { e.stopPropagation(); onEditTool?.(tool); }}
                                    sx={{ p: 0.25 }}
                                  >
                                    <EditIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => { e.stopPropagation(); onDeleteTool?.(tool); }}
                                    sx={{ p: 0.25 }}
                                  >
                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Box>
                              )}
                            </Box>
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
