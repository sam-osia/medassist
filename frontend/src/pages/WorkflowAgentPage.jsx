import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Snackbar,
  Skeleton
} from '@mui/material';
import {
  Send as SendIcon,
  Save as SaveIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { workflowBuilderService, conversationService, workflowAgentService } from '../services/ApiService';
import StepComponent from '../components/UI/Workflow/StepComponent';
import WorkflowMessageCard from '../components/UI/Workflow/WorkflowMessageCard';
import ConversationSidebar from '../components/UI/Workflow/ConversationSidebar';
import GeneratedWorkflowPanel from '../components/UI/Workflow/GeneratedWorkflowPanel';
import { SaveWorkflowDialog } from '../components/UI/Workflow/WorkflowDialogs';
import { useTheme } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';

// Trace display component for showing orchestrator decisions and agent results
const TraceDisplay = ({ trace }) => {
  if (!trace || trace.length === 0) return null;

  return (
    <Box sx={{ mb: 1.5 }}>
      {trace.map((event, idx) => (
        <Typography
          key={idx}
          variant="body2"
          component="div"
          sx={{
            color: 'text.disabled',
            fontStyle: 'italic',
            fontSize: '0.85rem',
            mb: 0.5,
            pl: 1,
            borderLeft: '2px solid',
            borderColor: 'divider'
          }}
        >
          {event.event === 'decision' && (
            <>
              {/*<strong>{event.action}</strong>*/}
              {event.reasoning && (
                <span style={{ display: 'block', marginLeft: '8px', opacity: 0.8 }}>
                  {event.reasoning}
                </span>
              )}
            </>
          )}
          {event.event === 'agent_result' && (
            <>
              <strong>{event.agent}:</strong> {event.success ? '\u2713' : '\u2717'} {event.summary}
              {event.duration_ms && <span style={{ opacity: 0.7 }}> ({event.duration_ms}ms)</span>}
            </>
          )}
        </Typography>
      ))}
    </Box>
  );
};

// Ensures every message has a unique ID
const ensureMessageId = (message) => {
  return {
    ...message,
    id: message.id || uuidv4()
  };
};

// Recursively find a step by ID in the plan structure
const findStepById = (steps, stepId) => {
  if (!steps) return null;

  for (const step of steps) {
    // Check if this is the target step
    if (step.id === stepId) {
      return step;
    }

    // Search in nested structures
    // Loop bodies
    if (step.type === 'loop' && step.body) {
      const found = findStepById(step.body, stepId);
      if (found) return found;
    }

    // If/then branches
    if (step.type === 'if' && step.then) {
      const found = findStepById([step.then], stepId);
      if (found) return found;
    }
  }

  return null;
};

const WorkflowAgentPage = () => {
  const theme = useTheme();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [awaitingResponse, setAwaitingResponse] = useState(false);
  const [error, setError] = useState(null);

  // Conversation management state
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Saved workflows management state
  const [savedWorkflows, setSavedWorkflows] = useState([]);
  const [selectedWorkflowName, setSelectedWorkflowName] = useState(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveDialogError, setSaveDialogError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [updatingWorkflow, setUpdatingWorkflow] = useState(false);
  
  // Chat interface state
  const [conversation, setConversation] = useState({ messages: [], workflows: {} });
  const [chatInput, setChatInput] = useState('');

  // Trace state for streaming display
  const [activeTrace, setActiveTrace] = useState([]);

  // Selected workflow state - tracks which workflow is currently displayed
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);

  // Load saved workflows and conversations on component mount
  useEffect(() => {
    fetchSavedWorkflows();
    fetchConversations();
  }, []);

  // Clear success messages after 3 seconds
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);


  const fetchSavedWorkflows = async () => {
    try {
      const response = await workflowBuilderService.getAllSavedWorkflows();
      setSavedWorkflows(response.data.plans || []);
    } catch (error) {
      console.error('Error fetching saved workflows:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      const response = await conversationService.getAllConversations();
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleLoadConversation = async (convId) => {
    try {
      setLoading(true);
      const response = await conversationService.getConversation(convId);

      // Clear plan state when loading a conversation
      setSelectedWorkflowName(null);

      // Set conversation ID
      setConversationId(convId);

      // Load messages and workflows
      const messages = (response.data.messages || []).map(ensureMessageId);
      const workflows = response.data.workflows || {};
      setConversation({ messages, workflows });

      // Find last workflow reference and display it
      const lastWorkflowMsg = [...messages].reverse().find(m => m.workflow_ref);
      if (lastWorkflowMsg && workflows[lastWorkflowMsg.workflow_ref]) {
        setSelectedWorkflowId(lastWorkflowMsg.workflow_ref);
        setResult({ raw_workflow: workflows[lastWorkflowMsg.workflow_ref].raw_workflow });
      } else {
        // Clear result if no workflows in conversation
        setResult(null);
        setSelectedWorkflowId(null);
      }

      // Extract original prompt from first user message
      const firstUserMessage = messages.find(msg => msg.type === 'user');
      if (firstUserMessage) {
        setPrompt(firstUserMessage.content);
      } else {
        setPrompt('');
      }

      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error loading conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = () => {
    // Generate new UUID for conversation
    const newConversationId = uuidv4();

    // Reset all state
    setConversationId(newConversationId);
    setSelectedWorkflowName(null);
    setResult(null);
    setPrompt('');
    setError(null);
    setSaveSuccess(false);
    setUpdatingWorkflow(false);
    setSelectedWorkflowId(null);
    setConversation({ messages: [], workflows: {} });
    setChatInput('');
    setActiveTrace([]);
  };

  const handleDeleteConversation = async (convId) => {
    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      await conversationService.deleteConversation(convId);
      await fetchConversations();

      // If deleted current conversation, create new one
      if (convId === conversationId) {
        handleNewConversation();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Error deleting conversation: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleSaveWorkflow = () => {
    if (!result) return;
    setShowSaveDialog(true);
    setSaveDialogError(null);
  };

  const handleSelectSavedWorkflow = async (workflowName) => {
    try {
      setLoading(true);
      const response = await workflowBuilderService.getSavedWorkflow(workflowName);

      // Clear conversation state
      setConversationId(null);
      setConversation({ messages: [], workflows: {} });
      setSelectedWorkflowId(null);
      setPrompt('');

      // Set plan state
      setSelectedWorkflowName(workflowName);
      setResult({
        raw_workflow: response.data.raw_workflow
      });

      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error loading workflow');
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteSavedWorkflow = async (workflowName) => {
    try {
      await workflowBuilderService.deleteSavedWorkflow(workflowName);
      await fetchSavedWorkflows();

      // Clear current plan if it was deleted
      if (selectedWorkflowName === workflowName) {
        setSelectedWorkflowName(null);
        setResult(null);
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert('Error deleting workflow: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // Generate conversation ID if first message
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      currentConversationId = uuidv4();
      setConversationId(currentConversationId);
    }

    setLoading(true);
    setAwaitingResponse(true);
    setError(null);
    setResult(null);
    setSelectedWorkflowName(null); // Clear selected plan when generating new plan
    setActiveTrace([]); // Reset trace

    // Initialize chat with the original prompt before starting generation
    initializeChat(prompt.trim());

    // Add loading message to chat
    addLoadingMessage();

    try {
      const response = await workflowAgentService.processMessageStream(
        prompt.trim(),
        currentConversationId,
        0,  // mrn
        0,  // csn
        null  // dataset
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let collectedTrace = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const eventData = JSON.parse(line);

            if (eventData.event === 'decision' || eventData.event === 'agent_result') {
              collectedTrace.push(eventData);
              setActiveTrace([...collectedTrace]);
            } else if (eventData.event === 'final') {
              removeLoadingMessage();

              if (eventData.response_type === "text") {
                addMessageToConversation({
                  type: 'assistant',
                  content: eventData.text,
                  trace: collectedTrace
                });
              } else if (eventData.response_type === "workflow") {
                const workflowId = eventData.workflow_id;
                const workflowData = { raw_workflow: eventData.workflow_data.raw_workflow };

                // Add workflow to workflows dict
                addWorkflowToConversation(workflowId, workflowData);

                // Add single assistant message with workflow_ref
                addMessageToConversation({
                  type: 'assistant',
                  content: eventData.text,
                  workflow_ref: workflowId,
                  trace: collectedTrace
                });

                // Update display
                setResult(workflowData);
                setSelectedWorkflowId(workflowId);
              }
              setActiveTrace([]);
            } else if (eventData.event === 'error') {
              removeLoadingMessage();
              setError(eventData.message);
              addMessageToConversation({
                type: 'assistant',
                content: `Error: ${eventData.message}`,
                trace: eventData.partial_trace || collectedTrace
              });
              setActiveTrace([]);
            }
          } catch (parseError) {
            console.error('Error parsing stream event:', parseError, line);
          }
        }
      }

      // Refresh conversations list to show new conversation
      fetchConversations();

    } catch (err) {
      // Remove loading message on error
      removeLoadingMessage();
      setError(err.message || 'An error occurred while generating the workflow');
      setActiveTrace([]);
    } finally {
      setLoading(false);
      setAwaitingResponse(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleWorkflowUpdate = (updatedWorkflow) => {
    setResult(prevResult => ({
      ...prevResult,
      raw_workflow: updatedWorkflow.raw_workflow
    }));
  };

  const handleStepLoadingChange = (isLoading) => {
    setUpdatingWorkflow(isLoading);
  };

  const handleStepEdit = async (stepId, originalSummary, requestedSummary) => {
    // Add user message to chat showing the step edit request
    addMessageToConversation({
      type: 'user',
      content: `Change step with step ID of "${stepId}" from "${originalSummary}" to "${requestedSummary}"`
    });

    // Trigger plan updating overlay
    setUpdatingWorkflow(true);

    try {
      const response = await workflowBuilderService.editWorkflowStep(
        prompt,
        result.raw_workflow,
        stepId,
        requestedSummary
      );

      if (response.status === 200) {
        // Extract workflow data from response format
        const responseWorkflowData = response.data.plan_data;

        // Generate new workflow ID
        const newWorkflowId = `workflow_v${Object.keys(conversation.workflows).length + 1}`;
        const workflowData = { raw_workflow: responseWorkflowData.raw_workflow };

        // Add workflow to workflows dict
        addWorkflowToConversation(newWorkflowId, workflowData);

        // Add assistant response with workflow_ref
        addMessageToConversation({
          type: 'assistant',
          content: response.data.message,
          workflow_ref: newWorkflowId
        });

        // Update display
        setResult(workflowData);
        setSelectedWorkflowId(newWorkflowId);
      } else {
        throw new Error('Failed to update step');
      }
    } catch (err) {
      // Add error message to chat
      addMessageToConversation({
        type: 'assistant',
        content: 'Error updating step: ' + (err.response?.data?.detail || err.message)
      });
    } finally {
      setUpdatingWorkflow(false);
    }
  };

  const handlePromptEdit = async (stepId, newPromptValue) => {
    if (!result?.raw_workflow) return;

    // Find the step to get its summary before making API call
    const step = findStepById(result.raw_workflow.steps, stepId);
    if (!step) {
      throw new Error(`Step with ID '${stepId}' not found in plan`);
    }

    const stepSummary = step.step_summary || 'Unknown step';

    try {
      const response = await workflowBuilderService.updateStepPrompt(
        result.raw_workflow,
        stepId,
        newPromptValue
      );

      if (response.status === 200) {
        const updatedWorkflowData = response.data;

        // If in plan-only mode, auto-save the entire plan
        if (selectedWorkflowName) {
          await workflowBuilderService.saveSavedWorkflow(
            selectedWorkflowName,
            updatedWorkflowData.raw_workflow
          );
        } else {
          // In conversation mode, add to history
          // Add user message to conversation history
          addMessageToConversation({
            type: 'user',
            content: `Manually updated the prompt for step:\n${stepSummary}`
          });

          // Generate new workflow ID and add to conversation
          const newWorkflowId = `workflow_v${Object.keys(conversation.workflows).length + 1}`;
          const workflowData = { raw_workflow: updatedWorkflowData.raw_workflow };

          addWorkflowToConversation(newWorkflowId, workflowData);

          addMessageToConversation({
            type: 'assistant',
            content: 'Workflow updated',
            workflow_ref: newWorkflowId
          });

          setSelectedWorkflowId(newWorkflowId);
        }

        // Update the result state
        setResult({
          raw_workflow: updatedWorkflowData.raw_workflow
        });
      }
    } catch (err) {
      // Error is already handled in PromptDialog
      // Just re-throw to let dialog show the error
      throw new Error(err.response?.data?.detail || 'Failed to update prompt');
    }
  };

  // Chat helper functions
  const addMessageToConversation = (message) => {
    const newMessage = ensureMessageId({
      ...message,
      timestamp: new Date()
    });
    setConversation(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage]
    }));
    return newMessage;
  };

  const addWorkflowToConversation = (workflowId, workflowData) => {
    setConversation(prev => ({
      ...prev,
      workflows: {
        ...prev.workflows,
        [workflowId]: workflowData
      }
    }));
  };

  const initializeChat = (originalPrompt) => {
    if (originalPrompt && originalPrompt.trim()) {
      addMessageToConversation({
        type: 'user',
        content: originalPrompt.trim()
      });
    }
  };

  // Loading message management
  const addLoadingMessage = () => {
    const loadingMessage = {
      id: Date.now(),
      type: 'loading',
      timestamp: new Date()
    };
    setConversation(prev => ({
      ...prev,
      messages: [...prev.messages, loadingMessage]
    }));
  };

  const removeLoadingMessage = () => {
    setConversation(prev => ({
      ...prev,
      messages: prev.messages.filter(msg => msg.type !== 'loading')
    }));
  };

  // Handle workflow selection from chat
  const handleWorkflowClick = (workflowId) => {
    const workflowData = conversation.workflows[workflowId];
    if (!workflowData) return;

    // Update selection
    setSelectedWorkflowId(workflowId);

    // Update display
    setResult({
      raw_workflow: workflowData.raw_workflow
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || awaitingResponse) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setAwaitingResponse(true);
    setActiveTrace([]); // Reset trace

    // Add user message to chat
    addMessageToConversation({
      type: 'user',
      content: userMessage
    });

    // Add loading message to chat
    addLoadingMessage();

    try {
      // Use workflowAgentService for all chat interactions with streaming
      const response = await workflowAgentService.processMessageStream(
        userMessage,
        conversationId,
        0,  // mrn
        0,  // csn
        null  // dataset
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let collectedTrace = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const eventData = JSON.parse(line);

            if (eventData.event === 'decision' || eventData.event === 'agent_result') {
              collectedTrace.push(eventData);
              setActiveTrace([...collectedTrace]);
            } else if (eventData.event === 'final') {
              removeLoadingMessage();

              if (eventData.response_type === "text") {
                addMessageToConversation({
                  type: 'assistant',
                  content: eventData.text,
                  trace: collectedTrace
                });
              } else if (eventData.response_type === "workflow") {
                const workflowId = eventData.workflow_id;
                const workflowData = { raw_workflow: eventData.workflow_data.raw_workflow };

                // Add workflow to workflows dict
                addWorkflowToConversation(workflowId, workflowData);

                // Add single assistant message with workflow_ref
                addMessageToConversation({
                  type: 'assistant',
                  content: eventData.text,
                  workflow_ref: workflowId,
                  trace: collectedTrace
                });

                // Update display
                setResult(workflowData);
                setSelectedWorkflowId(workflowId);
              }
              setActiveTrace([]);
            } else if (eventData.event === 'error') {
              removeLoadingMessage();
              addMessageToConversation({
                type: 'assistant',
                content: `Error: ${eventData.message}`,
                trace: eventData.partial_trace || collectedTrace
              });
              setActiveTrace([]);
            }
          } catch (parseError) {
            console.error('Error parsing stream event:', parseError, line);
          }
        }
      }

      // Refresh conversations list to update last_message_date
      fetchConversations();

    } catch (err) {
      // Remove loading message on error
      removeLoadingMessage();

      // Add error message to chat
      addMessageToConversation({
        type: 'assistant',
        content: 'Error: ' + (err.message || 'Unknown error')
      });
      setActiveTrace([]);
    } finally {
      setAwaitingResponse(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 65px)', overflow: 'hidden' }}>
      {/* Conversation Sidebar - Always visible */}
      <ConversationSidebar
        conversations={conversations}
        currentConversationId={conversationId}
        onSelectConversation={handleLoadConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        savedWorkflows={savedWorkflows}
        selectedWorkflowName={selectedWorkflowName}
        onSelectSavedWorkflow={handleSelectSavedWorkflow}
        onDeleteSavedWorkflow={handleDeleteSavedWorkflow}
      />

      {/* Main content area */}
      <Box sx={{
        flex: 1,
        height: '100%',
        background: theme.pageGradient,
        py: 1,
        overflow: 'hidden'
      }}>
        <Box sx={{ height: '100%', px: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

          {/* Conditional Layout Based on View Mode */}
        {selectedWorkflowName && result ? (
          /* Plan-Only Mode - Centered Plan Panel */
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            minHeight: '70vh',
            px: 2,
            py: 2
          }}>
            <Box sx={{
              width: '100%',
              maxWidth: '900px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              height: 'calc(100vh - 140px)'
            }}>
              {saveSuccess && (
                <Alert severity="success">
                  Workflow saved successfully!
                </Alert>
              )}

              {error && (
                <Alert severity="error">
                  {error}
                </Alert>
              )}

              <GeneratedWorkflowPanel
                result={result}
                updatingWorkflow={updatingWorkflow}
                prompt={prompt}
                onWorkflowUpdate={handleWorkflowUpdate}
                onLoadingChange={handleStepLoadingChange}
                onStepEdit={handleStepEdit}
                onPromptEdit={handlePromptEdit}
                allowStepEditing={false}
                onSaveWorkflow={handleSaveWorkflow}
                selectedWorkflowName={selectedWorkflowName}
                awaitingResponse={awaitingResponse}
                loading={loading}
              />
            </Box>
          </Box>
        ) : !result && !awaitingResponse && conversation.messages.length === 0 ? (
          /* Centered State - No Plan Loaded */
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '70vh',
            px: 2
          }}>
            <Card sx={{ maxWidth: 600, width: '100%' }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ position: 'relative', mb: 3 }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={6}
                    label="Enter your workflow prompt"
                    placeholder="e.g., Summarize the first patient note. Then, highlight the most important information in the note that is relevant to mental health."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                    sx={{ 
                      '& .MuiInputBase-root': { 
                        resize: 'vertical',
                        overflow: 'auto',
                        pr: 6
                      }
                    }}
                  />
                  <Box sx={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <Button
                      onClick={handleSubmit}
                      disabled={!prompt.trim() || loading}
                      sx={{
                        minWidth: 'auto',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        backgroundColor: 'primary.main',
                        color: 'white',
                        '&:hover': {
                          backgroundColor: 'primary.dark'
                        },
                        '&:disabled': {
                          backgroundColor: 'action.disabled',
                          color: 'action.disabled'
                        }
                      }}
                    >
                      {loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                    </Button>
                  </Box>
                </Box>
                
                {saveSuccess && (
                  <Alert severity="success" sx={{ mt: 3 }}>
                    Workflow saved successfully!
                  </Alert>
                )}

                {error && (
                  <Alert severity="error" sx={{ mt: 3 }}>
                    {error}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Box>
        ) : (
          /* Two-Column State - Plan Loaded */
          <>
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: { xs: 3, md: 4 },
                alignItems: 'stretch',
                height: { md: 'calc(100vh - 140px)' },
                minHeight: 0
              }}
            >
            {/* Left Column - Text Inputs and Controls */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '100%' }}>

              {saveSuccess && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  Workflow saved successfully!
                </Alert>
              )}

              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              {/* Chat Interface */}
              {(conversation.messages.length > 0 || (result?.raw_workflow?.steps && !awaitingResponse)) && (
                <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '100%' }}>
                  <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', pb: 1 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                       Workflow Agent
                    </Typography>

                    {/* Message History */}
                    <Box
                      sx={{
                        flex: 1,
                        overflowY: 'auto',
                        mb: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        pr: 1,
                        minHeight: 0
                      }}
                    >
                      {conversation.messages.map((message) => {
                        if (message.type === 'loading') {
                          return (
                            <Box key={message.id}>
                              {/* Show active trace during loading */}
                              {activeTrace.length > 0 && (
                                <TraceDisplay trace={activeTrace} />
                              )}
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'flex-start',
                                  mb: 0.5
                                }}
                              >
                                <Box
                                  sx={{
                                    maxWidth: '80%',
                                    p: 1.5,
                                    borderRadius: 2,
                                    backgroundColor: 'action.hover',
                                  }}
                                >
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontStyle: 'italic' }}>
                                    Generating response...
                                  </Typography>
                                  <Skeleton
                                    variant="text"
                                    width="100%"
                                    height={20}
                                    animation="pulse"
                                    sx={{ mb: 0.5 }}
                                  />
                                  <Skeleton
                                    variant="text"
                                    width="60%"
                                    height={20}
                                    animation="pulse"
                                  />
                                </Box>
                              </Box>
                            </Box>
                          );
                        }

                        return (
                          <Box key={message.id}>
                            {/* Display trace for assistant messages */}
                            {message.type === 'assistant' && message.trace && message.trace.length > 0 && (
                              <TraceDisplay trace={message.trace} />
                            )}
                            {/* Message bubble */}
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                                mb: 0.5
                              }}
                            >
                              <Box
                                sx={{
                                  maxWidth: message.type === 'user' ? '80%' : '100%',
                                  p: 1.5,
                                  borderRadius: 2,
                                  backgroundColor: message.type === 'user'
                                    ? 'custom.alternateRow'
                                    : 'transparent',
                                  color: 'text.primary',
                                  wordBreak: 'break-word'
                                }}
                              >
                                <ReactMarkdown
                                  components={{
                                    p: ({node, ...props}) => <Typography variant="body2" component="span" {...props} />,
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              </Box>
                            </Box>
                            {/* Workflow card if this message references one */}
                            {message.workflow_ref && conversation.workflows[message.workflow_ref] && (
                              <WorkflowMessageCard
                                workflowData={conversation.workflows[message.workflow_ref]}
                                isSelected={selectedWorkflowId === message.workflow_ref}
                                onClick={() => handleWorkflowClick(message.workflow_ref)}
                                timestamp={message.timestamp}
                              />
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                    
                    {/* Chat Input */}
                    <Box component="form" onSubmit={handleSendMessage}>
                      <Box sx={{ position: 'relative' }}>
                        <TextField
                          fullWidth
                          multiline
                          maxRows={3}
                          placeholder="Type your message..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage(e);
                            }
                          }}
                          disabled={awaitingResponse}
                          sx={{ 
                            '& .MuiInputBase-root': { 
                              pr: 6
                            }
                          }}
                        />
                        <Box sx={{
                          position: 'absolute',
                          bottom: 8,
                          right: 8,
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <Button
                            type="submit"
                            disabled={!chatInput.trim() || awaitingResponse}
                            sx={{
                              minWidth: 'auto',
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              backgroundColor: 'primary.main',
                              color: 'white',
                              '&:hover': {
                                backgroundColor: 'primary.dark'
                              },
                              '&:disabled': {
                                backgroundColor: 'action.disabled',
                                color: 'action.disabled'
                              }
                            }}
                          >
                            {awaitingResponse ? <CircularProgress size={16} color="inherit" /> : <SendIcon fontSize="small" />}
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Box>

            {/* Right Column - Plan Display */}
            <GeneratedWorkflowPanel
              result={result}
              updatingWorkflow={updatingWorkflow}
              prompt={prompt}
              onWorkflowUpdate={handleWorkflowUpdate}
              onLoadingChange={handleStepLoadingChange}
              onStepEdit={handleStepEdit}
              onPromptEdit={handlePromptEdit}
              allowStepEditing={!selectedWorkflowName}
              onSaveWorkflow={handleSaveWorkflow}
              selectedWorkflowName={selectedWorkflowName}
              awaitingResponse={awaitingResponse}
              loading={loading}
            />
          </Box>
          </>
        )}
        </Box>
      </Box>

      {/* Save Workflow Dialog */}
      <SaveWorkflowDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        result={result}
        availableSavedWorkflows={savedWorkflows}
        onSaveSuccess={() => {
          setSaveSuccess(true);
          setShowSaveDialog(false);
          fetchSavedWorkflows();
        }}
        onError={(error) => setSaveDialogError(error)}
        error={saveDialogError}
      />
    </Box>
  );
};

export default WorkflowAgentPage;
