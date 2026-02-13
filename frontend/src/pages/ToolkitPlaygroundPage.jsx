import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toolsService, customToolsService } from '../services/ApiService';
import ToolComponent from '../components/UI/Toolkit/ToolComponent';
import ToolSidebar from '../components/UI/Toolkit/ToolSidebar';
import ToolBuilder from '../components/UI/Toolkit/ToolBuilder';

const ToolkitPlaygroundPage = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tools, setTools] = useState([]);
  const [selectedToolName, setSelectedToolName] = useState(null);

  // ToolBuilder state
  const [toolBuilderOpen, setToolBuilderOpen] = useState(false);
  const [editingTool, setEditingTool] = useState(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await toolsService.getCatalog();
      const { tools: toolList = [] } = resp.data || {};
      setTools(toolList);
      if (toolList.length > 0 && !selectedToolName) {
        setSelectedToolName(toolList[0].name);
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to load tool catalog');
    } finally {
      setLoading(false);
    }
  }, [selectedToolName]);

  useEffect(() => {
    fetchCatalog();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTool = useMemo(() => {
    if (!selectedToolName) return null;
    return tools.find(t => t.name === selectedToolName) || null;
  }, [selectedToolName, tools]);

  // Custom tool CRUD handlers
  const handleCreateTool = () => {
    setEditingTool(null);
    setToolBuilderOpen(true);
  };

  const handleEditTool = async (tool) => {
    // tool here is the catalog metadata — we need the full manifest for editing
    // Find the tool_id from the catalog name by fetching the custom tools list
    try {
      const resp = await customToolsService.list();
      const customTools = resp.data?.tools || [];
      const full = customTools.find(t => t.tool_name === tool.name);
      if (full) {
        setEditingTool(full);
        setToolBuilderOpen(true);
      }
    } catch (e) {
      setError('Failed to load tool for editing');
    }
  };

  const handleDeleteTool = async (tool) => {
    if (!window.confirm(`Delete custom tool "${tool.display_name || tool.name}"?`)) return;
    try {
      const resp = await customToolsService.list();
      const customTools = resp.data?.tools || [];
      const full = customTools.find(t => t.tool_name === tool.name);
      if (full) {
        await customToolsService.delete(full.tool_id);
        if (selectedToolName === tool.name) {
          setSelectedToolName(null);
        }
        await fetchCatalog();
      }
    } catch (e) {
      setError('Failed to delete tool');
    }
  };

  const handleSaveCustomTool = async (data, existingTool) => {
    if (existingTool) {
      await customToolsService.update(existingTool.tool_id, data);
    } else {
      await customToolsService.create(data);
    }
    await fetchCatalog();
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 65px)' }}>
      {/* Sidebar */}
      <ToolSidebar
        tools={tools}
        selectedToolName={selectedToolName}
        onSelectTool={setSelectedToolName}
        loading={loading}
        onCreateTool={handleCreateTool}
        onEditTool={handleEditTool}
        onDeleteTool={handleDeleteTool}
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
                <Typography>Loading tools...</Typography>
              </Box>
            ) : (
              <Typography variant="body1" color="text.secondary">
                Select a tool from the sidebar to begin.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* ToolBuilder Dialog */}
      <ToolBuilder
        open={toolBuilderOpen}
        onClose={() => setToolBuilderOpen(false)}
        onSave={handleSaveCustomTool}
        existingTool={editingTool}
      />
    </Box>
  );
};

export default ToolkitPlaygroundPage;
