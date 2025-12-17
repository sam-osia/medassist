import React, { useEffect, useMemo, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadFull } from 'tsparticles';
import { Box } from '@mui/material';

const AuthBackground = ({ children, theme }) => {
  const [particlesReady, setParticlesReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => {
      if (isMounted) {
        setParticlesReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const primaryColor = theme?.palette?.primary?.main ?? '#1976d2';
  const secondaryColor = theme?.palette?.secondary?.main ?? '#42a5f5';

  const particlesOptions = useMemo(() => {
    return {
      background: {
        color: {
          value: primaryColor,
        },
      },
      fullScreen: {
        enable: false,
      },
      fpsLimit: 60,
      interactivity: {
        detectsOn: 'window',
        events: {
          onClick: {
            enable: true,
            mode: 'push',
          },
          onHover: {
            enable: true,
            mode: 'repulse',
          },
          resize: true,
        },
        modes: {
          push: {
            quantity: 4,
          },
          repulse: {
            distance: 120,
            duration: 0.4,
          },
        },
      },
      particles: {
        color: {
          value: secondaryColor,
        },
        links: {
          color: secondaryColor,
          distance: 140,
          enable: true,
          opacity: 0.6,
          width: 1,
        },
        move: {
          enable: true,
          outModes: {
            default: 'bounce',
          },
          speed: 2,
        },
        number: {
          density: {
            enable: true,
          },
          value: 120,
        },
        opacity: {
          value: 0.6,
        },
        shape: {
          type: 'circle',
        },
        size: {
          value: { min: 1, max: 3 },
        },
      },
      detectRetina: true,
    };
  }, [primaryColor, secondaryColor]);

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primaryColor,
        overflow: 'hidden',
      }}
    >
      {particlesReady && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          <Particles
            id="tsparticles"
            options={particlesOptions}
            style={{
              width: '100%',
              height: '100%',
            }}
          />
        </Box>
      )}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default AuthBackground;
