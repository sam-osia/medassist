import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toolsService } from '../services/ApiService';
import ToolComponent from '../components/UI/Toolkit/ToolComponent';
import ToolSidebar from '../components/UI/Toolkit/ToolSidebar';

const ToolkitPlaygroundPage = () => {
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
    <Box sx={{ display: 'flex', height: 'calc(100vh - 65px)' }}>
      {/* Sidebar */}
      <ToolSidebar
        tools={tools}
        selectedToolName={selectedToolName}
        onSelectTool={setSelectedToolName}
        loading={loading}
      />

      {/* Main Content Area */}
      <Box sx={{
        flex: 1,
        background: theme.pageGradient,
        py: 3,
        px: 4,
        overflow: 'hidden'
      }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, maxWidth: '900px', mx: 'auto' }}>{error}</Alert>
        )}

        <Card sx={{
          maxWidth: '900px',
          mx: 'auto',
          height: 'calc(100vh - 100px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
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
                Select a tool from the sidebar to begin.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ToolkitPlaygroundPage;
