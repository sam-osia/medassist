import React from 'react';
import { Box, Typography, Link } from '@mui/material';
import dataLogo from '../../../assets/logos/data-logo-black.png';

const textItemSx = {
  display: 'inline-flex',
  alignItems: 'flex-end',
  lineHeight: 1,
  height: '1em',
  whiteSpace: 'nowrap'
};

const BrandingFooter = () => (
  <Box
    sx={{
      textAlign: 'center',
      py: 2,
      borderTop: '1px solid',
      borderColor: 'divider',
      mt: 3
    }}
  >
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        gap: 1.25,
        fontSize: (theme) => theme.typography.body2?.fontSize || '0.875rem',
        lineHeight: 1
      }}
    >
      <Typography variant="body2" component="span" color="text.secondary" sx={textItemSx}>
        Powered by
      </Typography>
      <Link
        href="https://prompter.uhndata.io/"
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          ...textItemSx,
          color: 'text.primary',
          fontWeight: 'bold',
          fontFamily: 'Syncopate, monospace',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline'
          }
        }}
      >
        PROMPTER
      </Link>
      <Typography variant="body2" component="span" color="text.secondary" sx={textItemSx}>
        built
      </Typography>
      <Typography variant="body2" component="span" color="text.secondary" sx={textItemSx}>
        by
      </Typography>
      <Link
        href="https://uhndata.io"
        target="_blank"
        rel="noopener noreferrer"
        sx={textItemSx}
      >
        <Box
          component="img"
          src={dataLogo}
          alt="DATA logo"
          sx={{ height: '1em', width: 'auto', display: 'block' }}
        />
      </Link>
    </Box>
  </Box>
);

export default BrandingFooter;
