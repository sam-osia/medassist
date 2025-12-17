import React, { useEffect, useMemo, useState } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  List, 
  ListItemButton, 
  ListItemText, 
  Divider, 
  Alert, 
  CircularProgress, 
  Card, 
  CardContent
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { getPageGradient } from '../App';
import { toolsService } from '../services/ApiService';
import ToolComponent from '../components/UI/Toolkit/ToolComponent';

const ToolPlaygroundPage = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tools, setTools] = useState([]);
  const [selectedToolName, setSelectedToolName] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await toolsService.getCatalog();
        if (!mounted) return;
        const { tools: toolList = [] } = resp.data || {};
        setTools(toolList);
        if (toolList.length > 0) {
          setSelectedToolName(toolList[0].name);
        }
      } catch (e) {
        setError(e.response?.data?.detail || e.message || 'Failed to load tool catalog');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCatalog();
    return () => { mounted = false; };
  }, []);

  const selectedTool = useMemo(() => {
    if (!selectedToolName) return null;
    return tools.find(t => t.name === selectedToolName) || null;
  }, [selectedToolName, tools]);

  return (
    <Box sx={{
      height: '100vh',
      background: getPageGradient(theme),
      py: 2,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Container maxWidth="lg" sx={{ mt: 2, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Toolkit Playground
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        <Box sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'stretch',
          flex: 1,
          minHeight: 0
        }}>
          {/* Sidebar */}
          <Card sx={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <CardContent sx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <Box sx={{ p: 2, pb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Tools
                </Typography>
              </Box>
              <Divider />
              {loading ? (
                <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                (() => {
                  // Group tools by category
                  const grouped = tools.reduce((acc, t) => {
                    const cat = t.category || 'Uncategorized';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(t);
                    return acc;
                  }, {});
                  const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
                  return (
                    <Box sx={{ overflowY: 'auto', flex: 1 }}>
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
                                  onClick={() => setSelectedToolName(tool.name)}
                                  sx={{
                                    alignItems: 'flex-start',
                                    py: 1.1,
                                    px: 2,
                                    '&.Mui-selected': { backgroundColor: 'rgba(25, 118, 210, 0.08)' }
                                  }}
                                >
                                  <ListItemText
                                    primary={
                                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                        {tool.name}
                                      </Typography>
                                    }
                                    secondary={
                                      tool.description ? (
                                        <Typography variant="caption" color="text.secondary">
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
                    </Box>
                  );
                })()
              )}
            </CardContent>
          </Card>

          {/* Main Panel */}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <CardContent sx={{ flex: 1, overflowY: 'auto' }}>
                {selectedTool ? (
                  <ToolComponent tool={selectedTool} />
                ) : loading ? (
                  <Box sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <CircularProgress size={24} />
                    <Typography>Loading tools…</Typography>
                  </Box>
                ) : (
                  <Typography variant="body1" color="text.secondary">
                    Select a tool from the left to begin.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default ToolPlaygroundPage;
