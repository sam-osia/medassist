import React, { useState } from 'react';
import {
  Container,
  Paper,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Lock as LockIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../contexts/AuthProvider';
import { useNavigate } from 'react-router-dom';

import AuthBackground from '../components/UI/Auth/AuthBackground';

const AuthPage = ({ onAuthSuccess }) => {
    const [username, setUsername] = useState('sam.osia');
    const [password, setPassword] = useState('saman123');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const theme = useTheme();
    const navigate = useNavigate();
    const { login } = useAuth();


    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await login(username, password);

            if (result.success) {
                // Redirect to home page on successful login
                navigate('/');
            } else {
                setError(result.error || 'Login failed');
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

  return (
    <AuthBackground theme={theme}>
      <Container component="main" maxWidth="sm">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%'
          }}
        >
          <Typography
            variant="h4"
            component="div"
            sx={{
              color: 'text.primary',
              fontWeight: 'bold',
              fontFamily: 'Syncopate, monospace',
              mb: 4
            }}
          >
            MedAssist AI
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ width: '100%' }}
          >
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <PersonIcon
                    sx={{
                      color: 'primary.main',
                      mr: 1
                    }}
                  />
                ),
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <LockIcon
                    sx={{
                      color: 'primary.main',
                      mr: 1
                    }}
                  />
                ),
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{
                mt: 3,
                mb: 2,
                height: 48,
                fontSize: '1.1rem'
              }}
              disabled={loading || !username.trim() || !password.trim()}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In'
              )}
            </Button>
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ mt: 2 }}
          >
            Medical Records System
          </Typography>
        </Paper>
        </Box>
      </Container>
    </AuthBackground>
  );
};

export default AuthPage;