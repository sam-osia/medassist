import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  TextField,
  IconButton,
  FormControlLabel,
  Switch
} from '@mui/material';
import { ExpandMore, ExpandLess, ChevronRight, Send, CheckCircle } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { caboodleService } from '../services/ApiService';

const QueryInput = ({ onSubmit }) => {
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!query.trim()) return;
    setSending(true);
    try {
      await onSubmit(query);
      setQuery('');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Paper sx={{ mb: 4, p: 2 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Ask about the Caboodle data dictionary..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={sending}
          size="small"
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={sending || !query.trim()}
        >
          {sending ? <CircularProgress size={24} /> : <Send />}
        </IconButton>
      </Box>
    </Paper>
  );
};

const CaboodlePage = () => {
  const theme = useTheme();
  const [tables, setTables] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableDetails, setTableDetails] = useState(null);
  const [expandedChildren, setExpandedChildren] = useState({});
  const [expandedVariables, setExpandedVariables] = useState({});
  const [llmResults, setLlmResults] = useState(null);
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // Fetch complete dictionary on mount
  useEffect(() => {
    const fetchTables = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await caboodleService.getTables();
        setTables(response.data.tables || {});
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load Caboodle tables');
      } finally {
        setLoading(false);
      }
    };

    fetchTables();
  }, []);

  // Select table and get details from local state
  const handleTableClick = (tableName) => {
    setSelectedTable(tableName);
    setExpandedVariables({});

    // Get table details from local state (already loaded)
    const details = tables[tableName];
    setTableDetails(details || null);
  };

  // Toggle children visibility for parent tables
  const toggleChildren = (tableName, e) => {
    e.stopPropagation();
    setExpandedChildren(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  // Toggle variable properties visibility
  const toggleVariable = (variableName) => {
    setExpandedVariables(prev => ({
      ...prev,
      [variableName]: !prev[variableName]
    }));
  };

  // Get parent tables (tables that have children or no children) - memoized to avoid re-calculating on every render
  const parentTables = useMemo(() => {
    let filtered = Object.entries(tables).filter(([name, data]) => {
      // Include if it has children or if it's not a child of another table
      const hasChildren = data.children && data.children.length > 0;
      const isChild = Object.values(tables).some(t => t.children && t.children.includes(name));
      return hasChildren || !isChild;
    });

    // Apply "show only selected" filter
    if (showOnlySelected && llmResults) {
      const selectedTableNames = Object.keys(llmResults);

      filtered = filtered.filter(([name, data]) => {
        // Include if table itself is selected
        if (selectedTableNames.includes(name)) return true;

        // Include if any child is selected (to maintain hierarchy)
        if (data.children && data.children.length > 0) {
          return data.children.some(child => selectedTableNames.includes(child));
        }

        return false;
      });
    }

    return filtered;
  }, [tables, showOnlySelected, llmResults]);

  // Render properties as a table
  const renderPropertiesTable = (properties) => {
    if (!properties || Object.keys(properties).length === 0) {
      return <Typography variant="body2" color="text.secondary">No properties available</Typography>;
    }

    return (
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Property</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(properties).map(([key, value]) => (
              <TableRow key={key}>
                <TableCell sx={{ width: '40%' }}>{key}</TableCell>
                <TableCell>
                  {Array.isArray(value) ? value.join(', ') : String(value || 'N/A')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Render variables as a list with expandable properties
  const renderVariablesList = (variables) => {
    if (!variables || Object.keys(variables).length === 0) {
      return <Typography variant="body2" color="text.secondary">No variables available</Typography>;
    }

    // Get selected variables for current table
    const selectedVariables = llmResults && selectedTable ? llmResults[selectedTable] || [] : [];

    return (
      <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
        {Object.entries(variables).map(([varName, varData]) => {
          const isVariableSelected = selectedVariables.includes(varName);

          return (
            <React.Fragment key={varName}>
              <ListItemButton
                onClick={() => toggleVariable(varName)}
                sx={{
                  py: 1.5,
                  borderLeft: isVariableSelected ? '4px solid' : 'none',
                  borderLeftColor: 'success.main',
                  bgcolor: isVariableSelected ? 'success.light' : 'inherit'
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isVariableSelected && <CheckCircle fontSize="small" color="success" />}
                      <Typography variant="body1" sx={{ fontWeight: isVariableSelected ? 600 : 500 }}>
                        {varName}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {varData.definition || 'No definition available'}
                    </Typography>
                  }
                />
                {expandedVariables[varName] ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
              <Collapse in={expandedVariables[varName]} unmountOnExit>
                <Box sx={{ pl: 4, pr: 2, pb: 2, bgcolor: 'action.hover' }}>
                  {varData.properties && Object.keys(varData.properties).length > 0 ? (
                    <Table size="small">
                      <TableBody>
                        {Object.entries(varData.properties).map(([propKey, propValue]) => (
                          <TableRow key={propKey}>
                            <TableCell sx={{ border: 'none', width: '40%', fontWeight: 500 }}>
                              {propKey}
                            </TableCell>
                            <TableCell sx={{ border: 'none' }}>
                              {Array.isArray(propValue) ? propValue.join(', ') : String(propValue || 'N/A')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No properties available
                    </Typography>
                  )}
                </Box>
              </Collapse>
              <Divider />
            </React.Fragment>
          );
        })}
      </List>
    );
  };

  return (
    <Box
      sx={{
        height: 'calc(100vh - 65px)',
        background: theme.pageGradient,
        py: 4,
        overflow: 'hidden'
      }}
    >
      <Container maxWidth="xl">
        {/* Chat Input */}
        <QueryInput onSubmit={async (q) => {
          try {
            const response = await caboodleService.llmCall(q);
            setLlmResults(response.data.results || null);
            setShowOnlySelected(true);
          } catch (err) {
            setError(err.response?.data?.detail || 'Failed to send query');
          }
        }} />

        {/* Loading State */}
        {loading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '200px'
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {/* Error State */}
        {error && !loading && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Main Content */}
        {!loading && !error && (
          <Box sx={{ display: 'flex', gap: 3, minHeight: '600px' }}>
            {/* Left Panel - Table Navigation */}
            <Paper
              sx={{
                width: '30%',
                maxHeight: '80vh',
                overflow: 'auto',
                p: 2
              }}
            >
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Tables
              </Typography>

              {/* Show Only Selected Toggle */}
              {llmResults && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={showOnlySelected}
                      onChange={(e) => setShowOnlySelected(e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Show only selected ({Object.keys(llmResults).length})
                    </Typography>
                  }
                  sx={{ mb: 2 }}
                />
              )}

              <List>
                {parentTables.map(([tableName, tableData]) => {
                  const isTableSelected = llmResults && llmResults[tableName];
                  const hasSelectedChildren = llmResults && tableData.children?.some(child => llmResults[child]);
                  const isParentGrayed = !isTableSelected && hasSelectedChildren;

                  // Filter children if showing only selected
                  const visibleChildren = showOnlySelected && llmResults && tableData.children
                    ? tableData.children.filter(child => llmResults[child])
                    : tableData.children;

                  return (
                    <React.Fragment key={tableName}>
                      <ListItemButton
                        onClick={() => handleTableClick(tableName)}
                        selected={selectedTable === tableName}
                        disabled={isParentGrayed}
                        sx={{
                          borderRadius: 1,
                          opacity: isParentGrayed ? 0.5 : 1,
                          '&.Mui-disabled': {
                            opacity: 0.5
                          }
                        }}
                      >
                        <ListItemText
                          primary={<Typography>{tableName}</Typography>}
                          secondary={
                            tableData.definition
                              ? tableData.definition.slice(0, 60) + (tableData.definition.length > 60 ? '...' : '')
                              : null
                          }
                        />
                        {visibleChildren && visibleChildren.length > 0 && (
                          <Box onClick={(e) => toggleChildren(tableName, e)}>
                            {expandedChildren[tableName] ? <ExpandLess /> : <ChevronRight />}
                          </Box>
                        )}
                      </ListItemButton>

                      {/* Children */}
                      {visibleChildren && visibleChildren.length > 0 && (
                        <Collapse in={expandedChildren[tableName] || (hasSelectedChildren && showOnlySelected)} unmountOnExit>
                          <List component="div" disablePadding>
                            {visibleChildren.map((childName) => (
                                <ListItemButton
                                  key={childName}
                                  onClick={() => handleTableClick(childName)}
                                  selected={selectedTable === childName}
                                  sx={{
                                    pl: 4,
                                    borderRadius: 1
                                  }}
                                >
                                  <ListItemText
                                    primary={<Typography>{childName}</Typography>}
                                    secondary={
                                      tables[childName]?.definition
                                        ? tables[childName].definition.slice(0, 50) + (tables[childName].definition.length > 50 ? '...' : '')
                                        : null
                                    }
                                  />
                                </ListItemButton>
                            ))}
                          </List>
                        </Collapse>
                      )}
                    </React.Fragment>
                  );
                })}
              </List>
            </Paper>

            {/* Right Panel - Table Details */}
            <Paper
              sx={{
                flex: 1,
                maxHeight: '80vh',
                overflow: 'auto',
                p: 3
              }}
            >
              {!selectedTable && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%'
                  }}
                >
                  <Typography variant="h6" color="text.secondary">
                    Select a table to view details
                  </Typography>
                </Box>
              )}

              {selectedTable && tableDetails && (
                <Box>
                  {/* Table Name */}
                  <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>
                    {selectedTable}
                  </Typography>

                  {/* Definition */}
                  {tableDetails.definition && (
                    <Typography variant="body1" sx={{ mb: 3 }}>
                      {tableDetails.definition}
                    </Typography>
                  )}

                  {/* Properties Section */}
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Properties
                  </Typography>
                  {renderPropertiesTable(tableDetails.properties)}

                  {/* Variables Section */}
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Variables
                  </Typography>
                  {renderVariablesList(tableDetails.variables)}
                </Box>
              )}
            </Paper>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default CaboodlePage;
