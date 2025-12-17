import React from 'react';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';

const BreadcrumbNav = ({ breadcrumbs }) => {
  const navigate = useNavigate();

  const handleClick = (event, path) => {
    event.preventDefault();
    navigate(path);
  };

  return (
    <Breadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      sx={{ mb: 2 }}
    >
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;

        if (isLast) {
          return (
            <Typography key={index} color="text.primary" sx={{ fontWeight: 500 }}>
              {crumb.label}
            </Typography>
          );
        }

        return (
          <Link
            key={index}
            underline="hover"
            color="inherit"
            href={crumb.path}
            onClick={(e) => handleClick(e, crumb.path)}
            sx={{
              cursor: 'pointer',
              '&:hover': { color: 'primary.main' }
            }}
          >
            {crumb.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
};

export default BreadcrumbNav;
