import React from 'react';

// Default highlight colors (used when theme colors not provided)
const DEFAULT_HIGHLIGHT_BG = '#ffeb3b';
const DEFAULT_HIGHLIGHT_TEXT = '#000000';

/**
 * Parse text containing <highlight></highlight> tags and convert to React elements
 * with highlighted spans styled in yellow background.
 *
 * @param {string} text - Text containing <highlight></highlight> tags
 * @param {Object} options - Optional styling options
 * @param {string} options.backgroundColor - Highlight background color (default: theme highlight or yellow)
 * @param {string} options.textColor - Highlight text color (default: theme contrastText or black)
 * @returns {React.ReactNode[]} Array of React elements with highlighted spans
 */
export const parseHighlightedText = (text, options = {}) => {
  if (!text || typeof text !== 'string') {
    return [text];
  }

  const {
    backgroundColor = DEFAULT_HIGHLIGHT_BG,
    textColor = DEFAULT_HIGHLIGHT_TEXT,
  } = options;

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
            backgroundColor,
            color: textColor,
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