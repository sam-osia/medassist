import React, { useState, useEffect, useRef } from 'react';
import './ChatComponent.css';
import { 
  Send as SendIcon,
  ArrowRight as ArrowRightIcon,
  Forum as ForumIcon
} from '@mui/icons-material';
import {
  Typography,
  Button,
  Box,
  useTheme
} from '@mui/material';
import { useProcessing } from '../../../contexts/ProcessingContext';
import { chatService } from '../../../services/ApiService';

const ChatComponent = ({ mrn, csn, collapsed = false, onToggleCollapse }) => {
  const [userMessage, setUserMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const chatHistoryRef = useRef(null);
  const theme = useTheme();

  // Helper function to convert <highlight> tags to HTML
  const convertHighlightsToHtml = (text) => {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/<highlight>(.*?)<\/highlight>/g, '<span class="chat-highlight">$1</span>');
  };

  // Use processing context for unified event handling
  const { handleStreamingEvent } = useProcessing();

  // Auto-scroll to bottom when chat history updates
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Set CSS custom properties for theme colors
  useEffect(() => {
    document.documentElement.style.setProperty('--chat-primary-color', theme.palette.primary.main);
    document.documentElement.style.setProperty('--chat-primary-dark', theme.palette.primary.dark);
  }, [theme]);

  const sendMessage = async () => {
    if (!userMessage.trim() || isStreaming) return;

    const newUserMessage = { 
      role: 'user', 
      content: userMessage.trim(),
      timestamp: new Date().toISOString()
    };
    
    const newAssistantMessage = {
      role: 'assistant',
      content: '',
      events: [],
      timestamp: new Date().toISOString(),
      isStreaming: true
    };

    // Add both user message and empty assistant message
    setChatHistory(prev => [...prev, newUserMessage, newAssistantMessage]);
    setUserMessage('');
    setIsStreaming(true);

    try {
      const response = await chatService.supervisorStream(
        userMessage.trim(),
        mrn,
        csn,
        chatHistory
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const eventData = JSON.parse(line);
            
            // Handle event through ProcessingContext for UI highlighting
            handleStreamingEvent({
              type: eventData.event,
              tool_name: eventData.tool_name,
              dataItem: eventData.dataItem,
              step: eventData.step
            });
            
            // Update the assistant message with the new event
            setChatHistory(prev => {
              const newHistory = [...prev];
              const lastMessage = newHistory[newHistory.length - 1];
              
              if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
                if (eventData.event === 'final_result') {
                  // For chat workflow, extract the chat response text
                  const content = typeof eventData.content === 'object' && eventData.content.chat_response
                    ? eventData.content.chat_response
                    : eventData.content;
                  
                  lastMessage.content = content;
                  lastMessage.isStreaming = false;
                  
                  // Also dispatch workflow complete event for results display
                  if (typeof eventData.content === 'object' && eventData.content.flags) {
                    const workflowCompleteEvent = new CustomEvent('workflowComplete', {
                      detail: {
                        type: 'workflow_complete',
                        results: eventData.content
                      }
                    });
                    window.dispatchEvent(workflowCompleteEvent);
                  }
                } else {
                  // Add event to the events array
                  lastMessage.events.push({
                    ...eventData,
                    id: Date.now() + Math.random(),
                    timestamp: new Date().toISOString()
                  });
                }
              }
              
              return newHistory;
            });

            // If final result, stop streaming
            if (eventData.event === 'final_result') {
              setIsStreaming(false);
            }
          } catch (error) {
            console.error('Error parsing stream event:', error, line);
          }
        }
      }
    } catch (error) {
      console.error('Error in supervisor stream:', error);
      
      // Update the assistant message with error
      setChatHistory(prev => {
        const newHistory = [...prev];
        const lastMessage = newHistory[newHistory.length - 1];
        
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
          lastMessage.content = `Error: ${error.message}`;
          lastMessage.isStreaming = false;
          lastMessage.isError = true;
        }
        
        return newHistory;
      });
      
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setChatHistory([]);
    setExpandedEvents(new Set());
  };

  const toggleEventExpansion = (eventId) => {
    const newExpandedEvents = new Set(expandedEvents);
    if (newExpandedEvents.has(eventId)) {
      newExpandedEvents.delete(eventId);
    } else {
      newExpandedEvents.add(eventId);
    }
    setExpandedEvents(newExpandedEvents);
  };

  const renderEvent = (event) => {
    if (event.event === 'final_result') return null;

    const { event: eventType, tool_name, args, result, message, stage } = event;
    const isExpanded = expandedEvents.has(event.id);

    const getEventSummary = () => {
      switch (eventType) {
        case 'llm_thinking':
          return 'MedAssist is thinking...';
        case 'tool_call':
          return `${tool_name} (processing...)`;
        case 'tool_result':
          return `${tool_name} (completed)`;
        case 'error':
          return `Error at ${stage}`;
        default:
          return `${eventType}`;
      }
    };

    if (eventType === 'llm_thinking') {
      return (
        <div key={event.id} className="stream-event thinking-simple">
          <div className="thinking-text">{getEventSummary()}</div>
          <div className="thinking-animation">
            <span></span><span></span><span></span>
          </div>
        </div>
      );
    }

    if (eventType === 'tool_call' || eventType === 'tool_result') {
      return (
        <div key={event.id} className="stream-event thinking-simple">
          <div 
            className="thinking-text clickable"
            onClick={() => toggleEventExpansion(event.id)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowRightIcon
              sx={{
                fontSize: 16,
                color: 'text.secondary',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            />
            {getEventSummary()}
          </div>
          {isExpanded && (
            <div className="expanded-content">
              <pre>{JSON.stringify(eventType === 'tool_call' ? args : result, null, 2)}</pre>
            </div>
          )}
        </div>
      );
    }

    if (eventType === 'error') {
      return (
        <div key={event.id} className="stream-event error">
          <div className="event-content">
            <div className="event-header">❌ Error at {stage}</div>
            <div className="error-message">{message}</div>
            {tool_name && <div className="error-tool">Tool: {tool_name}</div>}
          </div>
        </div>
      );
    }

    return (
      <div key={event.id} className="stream-event">
        <div className="event-content">
          <div className="event-header">{eventType}</div>
          <pre>{JSON.stringify(event, null, 2)}</pre>
        </div>
      </div>
    );
  };

  return (
    <div className="chat-component">
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3, pb: 2 }}>
          <ForumIcon sx={{ fontSize: 30, color: 'icon.main' }} />
          <Box>
            <Typography variant="h5" component="h2">
              MedAssist
            </Typography>
            <Typography variant="body2" color="text.secondary">
              AI-powered chatbot for medical data insights
            </Typography>
          </Box>
        </Box>

        <Box sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={clearChat}
            variant="outlined"
            color="primary"
            size="small"
          >
            New Chat
          </Button>
        </Box>
      </Box>

      <div className="chat-history" ref={chatHistoryRef}>
        {chatHistory.length === 0 ? (
          <div className="empty-chat">
            <p>Start a conversation by entering a medical query below.</p>
          </div>
        ) : (
          chatHistory.map((message, index) => (
            <div key={index} className={`message ${message.role} ${message.isError ? 'error' : ''}`}>
              <div className="message-content">
                {/* Show events if they exist */}
                {message.events && message.events.length > 0 && (
                  <div className="stream-events">
                    {message.events.map((event) => renderEvent(event))}
                  </div>
                )}
                
                {/* Show content if it exists */}
                {message.content && (
                  <div 
                    className="final-content" 
                    dangerouslySetInnerHTML={{ 
                      __html: convertHighlightsToHtml(message.content) 
                    }}
                  />
                )}
                
              </div>
            </div>
          ))
        )}
      </div>

      <div className="message-input-section">
        <div className="input-container">
          <textarea
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about patient data, request analysis, or get medical insights..."
            rows="3"
            disabled={isStreaming}
            className="message-textarea"
          />
          <Button
            onClick={sendMessage}
            disabled={!userMessage.trim() || isStreaming}
            color="primary"
            variant="contained"
            sx={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              borderRadius: '50%',
              width: 40,
              height: 40,
              minWidth: 40,
              zIndex: 1,
              boxShadow: 2,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: 3,
              }
            }}
          >
            <SendIcon sx={{ width: 20, height: 20 }} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;
