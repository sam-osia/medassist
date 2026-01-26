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
import { planningService, conversationService, workflowAgentService } from '../services/ApiService';
import StepComponent from '../components/UI/Planning/StepComponent';
import PlanMessageCard from '../components/UI/Planning/PlanMessageCard';
import ConversationSidebar from '../components/UI/Planning/ConversationSidebar';
import GeneratedPlanPanel from '../components/UI/Planning/GeneratedPlanPanel';
import { SavePlanDialog } from '../components/UI/Planning/PlanDialogs';
import { useTheme } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';

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

const PlanningAgentPage = () => {
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

  // Plan management state
  const [plans, setPlans] = useState([]);
  const [selectedPlanName, setSelectedPlanName] = useState(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveDialogError, setSaveDialogError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState(false);
  
  // Chat interface state
  const [conversationHistory, setConversationHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // Selected message state - tracks which message is currently displayed
  const [selectedMessageId, setSelectedMessageId] = useState(null);

  // Load plans and conversations on component mount
  useEffect(() => {
    fetchPlans();
    fetchConversations();
  }, []);

  // Clear success messages after 3 seconds
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);


  const fetchPlans = async () => {
    try {
      const response = await planningService.getAllPlans();
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
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
      setSelectedPlanName(null);

      // Set conversation ID
      setConversationId(convId);

      // Load messages
      const normalizedHistory = (response.data.messages || []).map(ensureMessageId);
      setConversationHistory(normalizedHistory);

      // Find last plan and display it
      const planMessages = normalizedHistory.filter(msg => msg.type === 'plan');
      if (planMessages.length > 0) {
        const lastPlanMessage = planMessages[planMessages.length - 1];
        setResult({
          raw_plan: lastPlanMessage.planData.raw_plan
        });
        setSelectedMessageId(lastPlanMessage.id);
      } else {
        // Clear result if no plans in conversation
        setResult(null);
        setSelectedMessageId(null);
      }

      // Extract original prompt from first user message
      const firstUserMessage = normalizedHistory.find(msg => msg.type === 'user');
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
    setSelectedPlanName(null);
    setResult(null);
    setPrompt('');
    setError(null);
    setSaveSuccess(false);
    setUpdatingPlan(false);
    setSelectedMessageId(null);
    setConversationHistory([]);
    setChatInput('');
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

  const handleSavePlan = () => {
    if (!result) return;
    setShowSaveDialog(true);
    setSaveDialogError(null);
  };

  const handleSelectPlan = async (planName) => {
    try {
      setLoading(true);
      const response = await planningService.getPlan(planName);

      // Clear conversation state
      setConversationId(null);
      setConversationHistory([]);
      setSelectedMessageId(null);
      setPrompt('');

      // Set plan state
      setSelectedPlanName(planName);
      setResult({
        raw_plan: response.data.raw_plan
      });

      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error loading plan');
    } finally {
      setLoading(false);
    }
  };


  const handleDeletePlan = async (planName) => {
    try {
      await planningService.deletePlan(planName);
      await fetchPlans();

      // Clear current plan if it was deleted
      if (selectedPlanName === planName) {
        setSelectedPlanName(null);
        setResult(null);
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Error deleting plan: ' + (error.response?.data?.detail || error.message));
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
    setSelectedPlanName(null); // Clear selected plan when generating new plan

    // Initialize chat with the original prompt before starting generation
    initializeChat(prompt.trim());

    // Add loading message to chat
    addLoadingMessage();

    try {
      const response = await workflowAgentService.processMessage(
        prompt.trim(),
        currentConversationId,
        0,  // mrn
        0,  // csn
        null  // dataset
      );

      // Remove loading message
      removeLoadingMessage();

      // Handle different response types
      if (response.data.response_type === "text") {
        // Add only assistant text message
        addMessageToHistory({
          type: 'assistant',
          content: response.data.message
        });
      } else if (response.data.response_type === "workflow") {
        // Extract workflow data from response
        const workflowData = response.data.workflow_data;

        // Set result for right panel display
        setResult({
          raw_plan: workflowData.raw_plan
        });

        // Add assistant message
        addMessageToHistory({
          type: 'assistant',
          content: response.data.message
        });

        // Add plan object to chat (using workflow_data as planData for compatibility)
        addPlanToHistory({ raw_plan: workflowData.raw_plan }, response.data.message);
      }

      // Refresh conversations list to show new conversation
      fetchConversations();

    } catch (err) {
      // Remove loading message on error
      removeLoadingMessage();
      setError(err.response?.data?.detail || 'An error occurred while generating the workflow');
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

  const handlePlanUpdate = (updatedPlan) => {
    setResult(prevResult => ({
      ...prevResult,
      raw_plan: updatedPlan.raw_plan
    }));
  };

  const handleStepLoadingChange = (isLoading) => {
    setUpdatingPlan(isLoading);
  };

  const handleStepEdit = async (stepId, originalSummary, requestedSummary) => {
    // Add user message to chat showing the step edit request
    addMessageToHistory({
      type: 'user',
      content: `Change step with step ID of "${stepId}" from "${originalSummary}" to "${requestedSummary}"`
    });

    // Trigger plan updating overlay
    setUpdatingPlan(true);

    try {
      const response = await planningService.editPlanStep(
        prompt,
        result.raw_plan,
        stepId,
        requestedSummary
      );

      if (response.status === 200) {
        // Extract plan data from new response format
        const planData = response.data.plan_data;
        
        // Update the plan with the new generated plan
        setResult({
          raw_plan: planData.raw_plan,
          formatted_plan: planData.formatted_plan
        });

        // Add assistant response to chat
        addMessageToHistory({
          type: 'assistant',
          content: response.data.message
        });

        // Add plan object to chat
        addPlanToHistory(planData, response.data.message);
      } else {
        throw new Error('Failed to update step');
      }
    } catch (err) {
      // Add error message to chat
      addMessageToHistory({
        type: 'assistant',
        content: 'Error updating step: ' + (err.response?.data?.detail || err.message)
      });
    } finally {
      setUpdatingPlan(false);
    }
  };

  const handlePromptEdit = async (stepId, newPromptValue) => {
    if (!result?.raw_plan) return;

    // Find the step to get its summary before making API call
    const step = findStepById(result.raw_plan.steps, stepId);
    if (!step) {
      throw new Error(`Step with ID '${stepId}' not found in plan`);
    }

    const stepSummary = step.step_summary || 'Unknown step';

    try {
      const response = await planningService.updateStepPrompt(
        result.raw_plan,
        stepId,
        newPromptValue
      );

      if (response.status === 200) {
        const updatedPlanData = response.data;

        // If in plan-only mode, auto-save the entire plan
        if (selectedPlanName) {
          await planningService.savePlan(
            selectedPlanName,
            updatedPlanData.raw_plan
          );
        } else {
          // In conversation mode, add to history
          // Add user message to conversation history
          addMessageToHistory({
            type: 'user',
            content: `Manually updated the prompt for step:\n${stepSummary}`
          });

          // Create plan data object for conversation history
          const planData = {
            raw_plan: updatedPlanData.raw_plan
          };

          // Add plan to conversation history
          addPlanToHistory(planData, 'Plan updated');
        }

        // Update the result state
        setResult({
          raw_plan: updatedPlanData.raw_plan
        });
      }
    } catch (err) {
      // Error is already handled in PromptDialog
      // Just re-throw to let dialog show the error
      throw new Error(err.response?.data?.detail || 'Failed to update prompt');
    }
  };

  // Chat helper functions
  const addMessageToHistory = (message) => {
    const newMessage = ensureMessageId({
      ...message,
      timestamp: new Date()
    });
    setConversationHistory(prev => [...prev, newMessage]);
  };

  const initializeChat = (originalPrompt) => {
    if (originalPrompt && originalPrompt.trim()) {
      addMessageToHistory({
        type: 'user',
        content: originalPrompt.trim()
      });
    }
  };

  // Add plan message to chat history
  const addPlanToHistory = (planData, message = 'Plan generated') => {
    const planMessage = ensureMessageId({
      type: 'plan',
      planData: planData,
      message: message,
      timestamp: new Date()
    });
    setConversationHistory(prev => [...prev, planMessage]);

    // Set this plan as selected
    setSelectedMessageId(planMessage.id);
  };

  // Loading message management
  const addLoadingMessage = () => {
    const loadingMessage = {
      id: Date.now(),
      type: 'loading',
      timestamp: new Date()
    };
    setConversationHistory(prev => [...prev, loadingMessage]);
  };

  const removeLoadingMessage = () => {
    setConversationHistory(prev => prev.filter(msg => msg.type !== 'loading'));
  };

  // Handle plan selection from chat
  const handlePlanClick = (messageId) => {
    // Find the message by its ID
    const message = conversationHistory.find(m => m.id === messageId);
    if (!message || message.type !== 'plan') return;

    // Update selection
    setSelectedMessageId(messageId);

    // Update display
    setResult({
      raw_plan: message.planData.raw_plan
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || awaitingResponse) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setAwaitingResponse(true);

    // Add user message to chat
    addMessageToHistory({
      type: 'user',
      content: userMessage
    });

    // Add loading message to chat
    addLoadingMessage();

    try {
      // Use workflowAgentService for all chat interactions
      const response = await workflowAgentService.processMessage(
        userMessage,
        conversationId,
        0,  // mrn
        0,  // csn
        null  // dataset
      );

      // Remove loading message
      removeLoadingMessage();

      // Handle different response types
      if (response.data.response_type === "text") {
        // Add only assistant text message
        addMessageToHistory({
          type: 'assistant',
          content: response.data.message
        });
      } else if (response.data.response_type === "workflow") {
        // Extract workflow data from response
        const workflowData = response.data.workflow_data;

        // Set result for right panel display
        setResult({
          raw_plan: workflowData.raw_plan
        });

        // Add assistant message
        addMessageToHistory({
          type: 'assistant',
          content: response.data.message
        });

        // Add plan object to chat (using workflow_data as planData for compatibility)
        addPlanToHistory({ raw_plan: workflowData.raw_plan }, response.data.message);
      }

      // Refresh conversations list to update last_message_date
      fetchConversations();

    } catch (err) {
      // Remove loading message on error
      removeLoadingMessage();

      // Add error message to chat
      addMessageToHistory({
        type: 'assistant',
        content: 'Error: ' + (err.response?.data?.detail || err.message)
      });
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
        plans={plans}
        selectedPlanName={selectedPlanName}
        onSelectPlan={handleSelectPlan}
        onDeletePlan={handleDeletePlan}
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
        {selectedPlanName && result ? (
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
                  Plan saved successfully!
                </Alert>
              )}

              {error && (
                <Alert severity="error">
                  {error}
                </Alert>
              )}

              <GeneratedPlanPanel
                result={result}
                updatingPlan={updatingPlan}
                prompt={prompt}
                onPlanUpdate={handlePlanUpdate}
                onLoadingChange={handleStepLoadingChange}
                onStepEdit={handleStepEdit}
                onPromptEdit={handlePromptEdit}
                allowStepEditing={false}
                onSavePlan={handleSavePlan}
                selectedPlanName={selectedPlanName}
                awaitingResponse={awaitingResponse}
                loading={loading}
              />
            </Box>
          </Box>
        ) : !result && !awaitingResponse && conversationHistory.length === 0 ? (
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
                    Plan saved successfully!
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
                  Plan saved successfully!
                </Alert>
              )}

              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              {/* Chat Interface */}
              {(conversationHistory.length > 0 || (result?.raw_plan?.steps && !awaitingResponse)) && (
                <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '100%' }}>
                  <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', pb: 1 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                       Planning Agent
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
                      {conversationHistory.map((message) => {
                        if (message.type === 'plan') {
                          return (
                            <PlanMessageCard
                              key={message.id}
                              planData={message.planData}
                              isSelected={selectedMessageId === message.id}
                              onClick={() => handlePlanClick(message.id)}
                              timestamp={message.timestamp}
                            />
                          );
                        }
                        
                        if (message.type === 'loading') {
                          return (
                            <Box
                              key={message.id}
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
                          );
                        }
                        
                        return (
                          <Box
                            key={message.id}
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
            <GeneratedPlanPanel
              result={result}
              updatingPlan={updatingPlan}
              prompt={prompt}
              onPlanUpdate={handlePlanUpdate}
              onLoadingChange={handleStepLoadingChange}
              onStepEdit={handleStepEdit}
              onPromptEdit={handlePromptEdit}
              allowStepEditing={!selectedPlanName}
              onSavePlan={handleSavePlan}
              selectedPlanName={selectedPlanName}
              awaitingResponse={awaitingResponse}
              loading={loading}
            />
          </Box>
          </>
        )}
        </Box>
      </Box>

      {/* Save Plan Dialog */}
      <SavePlanDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        result={result}
        availablePlans={plans}
        onSaveSuccess={() => {
          setSaveSuccess(true);
          setShowSaveDialog(false);
          fetchPlans();
        }}
        onError={(error) => setSaveDialogError(error)}
        error={saveDialogError}
      />
    </Box>
  );
};

export default PlanningAgentPage;
