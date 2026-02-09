import React from 'react';

// Default highlight colors
const DEFAULT_HIGHLIGHT_BG = '#ffeb3b';
const DEFAULT_HIGHLIGHT_TEXT = '#000000';

/**
 * Insert <highlight> tags around a span found within text.
 * Handles whitespace normalization and case-insensitive matching.
 *
 * @param {string} text - The source text to search within
 * @param {string} spanText - The span/excerpt to find and highlight
 * @returns {string} Text with <highlight> tags inserted, or original text with fallback if span not found
 */
export function insertHighlightTags(text, spanText) {
  if (!text || !spanText) return text || '';

  // Normalize whitespace for matching
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const normalizedSpan = spanText.replace(/\s+/g, ' ').trim();

  // Case-insensitive search
  const lowerText = normalizedText.toLowerCase();
  const lowerSpan = normalizedSpan.toLowerCase();

  const startIdx = lowerText.indexOf(lowerSpan);
  if (startIdx === -1) {
    // Span not found - return original text with span appended
    return `${text}\n\n[Extracted span - not found verbatim in text]:\n${spanText}`;
  }

  const endIdx = startIdx + normalizedSpan.length;
  return (
    normalizedText.slice(0, startIdx) +
    '<highlight>' + normalizedText.slice(startIdx, endIdx) + '</highlight>' +
    normalizedText.slice(endIdx)
  );
}

/**
 * Render text containing <highlight> tags as React elements.
 * Returns an array of strings and styled span elements.
 *
 * @param {string} text - Text containing <highlight></highlight> tags
 * @param {Object} options - Optional styling options
 * @param {string} options.backgroundColor - Highlight background color (default: yellow)
 * @param {string} options.textColor - Highlight text color (default: black)
 * @returns {React.ReactNode[]} Array of React elements with highlighted spans
 */
export function renderHighlightedText(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return [text];
  }

  const {
    backgroundColor = DEFAULT_HIGHLIGHT_BG,
    textColor = DEFAULT_HIGHLIGHT_TEXT,
  } = options;

  // Split the text by highlight tags (with optional color attr) while preserving the tags
  const parts = text.split(/(<highlight(?:\s+color="[^"]*")?>.*?<\/highlight>)/g);

  return parts.map((part, index) => {
    // Check if this part is a highlighted section
    const match = part.match(/^<highlight(?:\s+color="([^"]*)")?>(.*)$/s);
    if (match && part.endsWith('</highlight>')) {
      const tagColor = match[1]; // undefined if no color attr
      const content = match[2].slice(0, -12); // Remove </highlight>
      return (
        <span
          key={index}
          style={{
            backgroundColor: tagColor || backgroundColor,
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
}

/**
 * Check if text contains highlight tags.
 *
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains highlight tags
 */
export function hasHighlights(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  return text.includes('<highlight>') && text.includes('</highlight>');
}

/**
 * Insert colored <highlight> tags for multiple keywords in text.
 *
 * @param {string} text - The source text
 * @param {Object} keywordColorMap - Map of keyword → hex color (e.g. { "pain": "#e57373" })
 * @returns {string} Text with <highlight color="...">...</highlight> tags inserted
 */
export function insertMultiKeywordHighlightTags(text, keywordColorMap) {
  if (!text || !keywordColorMap || Object.keys(keywordColorMap).length === 0) {
    return text || '';
  }

  // Find all occurrences of all keywords
  const matches = [];
  for (const [keyword, color] of Object.entries(keywordColorMap)) {
    if (!keyword) continue;
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    let pos = 0;
    while ((pos = lowerText.indexOf(lowerKeyword, pos)) !== -1) {
      matches.push({ start: pos, end: pos + keyword.length, color });
      pos += keyword.length;
    }
  }

  if (matches.length === 0) return text;

  // Sort by start position, then longer matches first for ties
  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Remove overlaps (first match wins)
  const filtered = [matches[0]];
  for (let i = 1; i < matches.length; i++) {
    if (matches[i].start >= filtered[filtered.length - 1].end) {
      filtered.push(matches[i]);
    }
  }

  // Build result string with highlight tags
  let result = '';
  let cursor = 0;
  for (const m of filtered) {
    result += text.slice(cursor, m.start);
    result += `<highlight color="${m.color}">${text.slice(m.start, m.end)}</highlight>`;
    cursor = m.end;
  }
  result += text.slice(cursor);

  return result;
}
