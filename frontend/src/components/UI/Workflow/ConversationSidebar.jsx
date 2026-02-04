import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Delete as DeleteIcon,
  BorderColor as BorderColorIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const ConversationSidebar = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  savedWorkflows,
  selectedWorkflowName,
  onSelectSavedWorkflow,
  onDeleteSavedWorkflow
}) => {
  const theme = useTheme();
  const [conversationMenuAnchor, setConversationMenuAnchor] = useState(null);
  const [workflowMenuAnchor, setWorkflowMenuAnchor] = useState(null);
  const [menuConversationId, setMenuConversationId] = useState(null);
  const [menuWorkflowName, setMenuWorkflowName] = useState(null);

  // Format date to relative time
  const formatDate = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  return (
    <Box
      sx={{
        width: 250,
        height: '100%',
        borderRight: 1,
        borderColor: 'divider',
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header with New Conversation button */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<BorderColorIcon />}
          onClick={onNewConversation}
          sx={{ mb: 1 }}
        >
          New Conversation
        </Button>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
          Conversations
        </Typography>
      </Box>

      {/* Scrollable content area for both conversations and plans */}
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* Conversations list */}
        {conversations.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No conversations yet
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {conversations.map((conversation) => (
              <ListItem
                key={conversation.conversation_id}
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuConversationId(conversation.conversation_id);
                      setConversationMenuAnchor(e.currentTarget);
                    }}
                    sx={{
                      opacity: 0.6,
                      '&:hover': {
                        opacity: 1
                      }
                    }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                }
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider'
                }}
              >
                <ListItemButton
                  selected={currentConversationId === conversation.conversation_id}
                  onClick={() => onSelectConversation(conversation.conversation_id)}
                  sx={{
                    py: 1.5,
                    pr: 6,  // Make room for delete button
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
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: currentConversationId === conversation.conversation_id ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          lineHeight: 1.3,
                          mb: 0.5
                        }}
                      >
                        {conversation.title || 'Untitled Conversation'}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: '0.7rem' }}
                      >
                        {formatDate(conversation.last_message_date || conversation.created_date)}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        {/* Saved Workflows Section */}
        <Box sx={{ borderTop: 1, borderColor: 'divider', mt: 0 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
              Saved Workflows
            </Typography>
          </Box>

          {savedWorkflows && savedWorkflows.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                No workflows saved yet
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {savedWorkflows && savedWorkflows.map((workflow) => (
                <ListItem
                  key={workflow.workflow_name || workflow.plan_name}
                  disablePadding
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuWorkflowName(workflow.workflow_name || workflow.plan_name);
                        setWorkflowMenuAnchor(e.currentTarget);
                      }}
                      sx={{
                        opacity: 0.6,
                        '&:hover': {
                          opacity: 1
                        }
                      }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  }
                  sx={{
                    borderBottom: 1,
                    borderColor: 'divider'
                  }}
                >
                  <ListItemButton
                    selected={selectedWorkflowName === (workflow.workflow_name || workflow.plan_name)}
                    onClick={() => onSelectSavedWorkflow(workflow.workflow_name || workflow.plan_name)}
                    sx={{
                      py: 1.5,
                      pr: 6,
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
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: selectedWorkflowName === (workflow.workflow_name || workflow.plan_name) ? 600 : 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.3,
                            mb: 0.5
                          }}
                        >
                          {workflow.workflow_name || workflow.plan_name}
                        </Typography>
                      }
                      secondary={
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontSize: '0.7rem' }}
                        >
                          {formatDate(workflow.last_modified_date || workflow.created_date)}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Box>

      {/* Conversation Menu */}
      <Menu
        anchorEl={conversationMenuAnchor}
        open={Boolean(conversationMenuAnchor)}
        onClose={() => {
          setConversationMenuAnchor(null);
          setMenuConversationId(null);
        }}
      >
        <MenuItem
          onClick={() => {
            if (window.confirm('Are you sure you want to delete this conversation?')) {
              onDeleteConversation(menuConversationId);
            }
            setConversationMenuAnchor(null);
            setMenuConversationId(null);
          }}
          sx={{
            color: 'error.main'
          }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Saved Workflow Menu */}
      <Menu
        anchorEl={workflowMenuAnchor}
        open={Boolean(workflowMenuAnchor)}
        onClose={() => {
          setWorkflowMenuAnchor(null);
          setMenuWorkflowName(null);
        }}
      >
        <MenuItem
          onClick={() => {
            if (window.confirm(`Are you sure you want to delete the workflow "${menuWorkflowName}"?`)) {
              onDeleteSavedWorkflow(menuWorkflowName);
            }
            setWorkflowMenuAnchor(null);
            setMenuWorkflowName(null);
          }}
          sx={{
            color: 'error.main'
          }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ConversationSidebar;
