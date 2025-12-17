import React from 'react';

/**
 * Parse text containing <highlight></highlight> tags and convert to React elements
 * with highlighted spans styled in yellow background.
 * 
 * @param {string} text - Text containing <highlight></highlight> tags
 * @returns {React.ReactNode[]} Array of React elements with highlighted spans
 */
export const parseHighlightedText = (text) => {
  if (!text || typeof text !== 'string') {
    return [text];
  }

  // Split the text by highlight tags while preserving the tags
  const parts = text.split(/(<highlight>.*?<\/highlight>)/g);
  
  return parts.map((part, index) => {
    // Check if this part is a highlighted section
    if (part.startsWith('<highlight>') && part.endsWith('</highlight>')) {
      // Extract the content between the tags
      const content = part.slice(11, -12); // Remove <highlight> and </highlight>
      return (
        <span
          key={index}
          style={{
            backgroundColor: '#ffeb3b', // Yellow highlighting
            color: '#000',
            fontWeight: 'bold',
            padding: '2px 4px',
            borderRadius: '3px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}
        >
          {content}
        </span>
      );
    }
    
    // Return non-highlighted text as-is
    return part;
  });
};

/**
 * Check if text contains highlight tags
 * 
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains highlight tags
 */
export const hasHighlights = (text) => {
  if (!text || typeof text !== 'string') {
    return false;
  }
  return text.includes('<highlight>') && text.includes('</highlight>');
};