import React, { createContext, useContext, useState, useCallback } from 'react';

const ProcessingContext = createContext();

export const ProcessingProvider = ({ children }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [activeItems, setActiveItems] = useState({
    notes: new Set(),
    medications: new Set(),
    diagnoses: new Set(),
    flowsheets: new Set()
  });

  // Start processing
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
    setCurrentStep('Starting...');
    setActiveItems({
      notes: new Set(),
      medications: new Set(), 
      diagnoses: new Set(),
      flowsheets: new Set()
    });
  }, []);

  // Update current step
  const updateStep = useCallback((step) => {
    setCurrentStep(step);
  }, []);

  // Add item to processing
  const addProcessingItem = useCallback((type, id) => {
    if (!type || id === undefined || id === null) return;
    
    setActiveItems(prev => ({
      ...prev,
      [type]: new Set([...prev[type], String(id)])
    }));
  }, []);

  // Remove item from processing  
  const removeProcessingItem = useCallback((type, id) => {
    if (!type || id === undefined || id === null) return;
    
    setActiveItems(prev => {
      const newSet = new Set(prev[type]);
      newSet.delete(String(id));
      return {
        ...prev,
        [type]: newSet
      };
    });
  }, []);

  // Handle streaming events from any source (chat or process workflows)
  const handleStreamingEvent = useCallback((eventData) => {
    if (!eventData || typeof eventData !== 'object') return;

    // Check if event has dataItem information
    if (eventData.dataItem && eventData.dataItem.type && eventData.dataItem.id) {
      const { type, id, status } = eventData.dataItem;
      
      if (status === 'processing') {
        addProcessingItem(type, id);
      } else if (status === 'completed') {
        removeProcessingItem(type, id);
      }
    }

    // Handle general processing state
    if (eventData.type === 'llm_thinking') {
      setIsProcessing(true);
    } else if (eventData.type === 'final_result' || eventData.type === 'error') {
      setIsProcessing(false);
    }

    // Update current step if provided
    if (eventData.step || eventData.tool_name) {
      const step = eventData.step || `Processing ${eventData.tool_name}...`;
      setCurrentStep(step);
    }
  }, [addProcessingItem, removeProcessingItem]);

  // Finish processing
  const finishProcessing = useCallback(() => {
    setIsProcessing(false);
    setCurrentStep('');
    setActiveItems({
      notes: new Set(),
      medications: new Set(),
      diagnoses: new Set(), 
      flowsheets: new Set()
    });
  }, []);

  // Check if specific item is processing
  const isItemProcessing = useCallback((type, id) => {
    if (!type || id === undefined || id === null) return false;
    return activeItems[type].has(String(id));
  }, [activeItems]);

  // Get all processing items for a type
  const getProcessingItems = useCallback((type) => {
    if (!type || !activeItems[type]) return [];
    return Array.from(activeItems[type]);
  }, [activeItems]);

  // Get count of processing items for a type
  const getProcessingCount = useCallback((type) => {
    if (!type || !activeItems[type]) return 0;
    return activeItems[type].size;
  }, [activeItems]);

  const value = {
    // State
    isProcessing,
    currentStep,
    activeItems,
    
    // Actions
    startProcessing,
    updateStep,
    addProcessingItem,
    removeProcessingItem, 
    finishProcessing,
    handleStreamingEvent,
    
    // Helpers
    isItemProcessing,
    getProcessingItems,
    getProcessingCount
  };

  return (
    <ProcessingContext.Provider value={value}>
      {children}
    </ProcessingContext.Provider>
  );
};

export const useProcessing = () => {
  const context = useContext(ProcessingContext);
  if (!context) {
    throw new Error('useProcessing must be used within a ProcessingProvider');
  }
  return context;
};