import React from 'react';
import { Typography, Paper } from '@mui/material';

/**
 * MetricCard - Prominent numeric display
 *
 * @param {string} label - Metric label
 * @param {number|string} value - Metric value
 * @param {string} color - Theme color (default: 'primary')
 * @param {string} size - Size variant: 'small', 'medium', 'large' (default: 'medium')
 * @param {string} format - Format type: 'integer', 'decimal', 'percent' (default: 'integer')
 */
function MetricCard({
  label,
  value,
  color = 'primary',
  size = 'medium',
  format = 'integer',
  ...props
}) {
  // Format the value
  const formattedValue = (() => {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'number') {
      if (format === 'percent') {
        return `${(value * 100).toFixed(1)}%`;
      }
      if (format === 'decimal') {
        return value.toFixed(2);
      }
      return Math.round(value).toLocaleString();
    }
    return String(value);
  })();

  // Size-based styles
  const sizeStyles = {
    small: {
      padding: 1.5,
      valueVariant: 'h5',
      labelVariant: 'caption'
    },
    medium: {
      padding: 2,
      valueVariant: 'h4',
      labelVariant: 'body2'
    },
    large: {
      padding: 3,
      valueVariant: 'h3',
      labelVariant: 'body1'
    }
  };

  const styles = sizeStyles[size] || sizeStyles.medium;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: styles.padding,
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 100,
        borderColor: `${color}.main`,
        backgroundColor: `${color}.lighter`,
      }}
      {...props}
    >
      <Typography
        variant={styles.valueVariant}
        sx={{
          fontWeight: 700,
          color: `${color}.main`,
          lineHeight: 1
        }}
      >
        {formattedValue}
      </Typography>
      {label && (
        <Typography
          variant={styles.labelVariant}
          color="text.secondary"
          sx={{ mt: 0.5 }}
        >
          {label}
        </Typography>
      )}
    </Paper>
  );
}

export default MetricCard;