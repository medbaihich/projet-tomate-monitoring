import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import axiosClient from '@/api/axiosClient';
import azuraLogo from '@/assets/branding/azura_logo.png';
import useAuthStore from '@/store/authStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthReady = useAuthStore((state) => state.isAuthReady);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated) {
      return;
    }

    const destination = location.state?.from?.pathname || '/dashboard';
    navigate(destination, { replace: true });
  }, [isAuthReady, isAuthenticated, location.state, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const loginRes = await axiosClient.post('/api/v1/auth/login/', {
        username,
        password,
      });

      const { access, refresh } = loginRes.data;
      setAuth(null, access, refresh);

      const userRes = await axiosClient.get('/api/v1/auth/me/');
      setAuth(userRes.data, access, refresh);

      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid username or password');
      } else {
        setError(err.response?.data?.detail || 'An error occurred during login');
      }
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 1.5, sm: 2.5 },
        py: { xs: 2.5, sm: 4 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#F6FAF6',
        backgroundImage: 'linear-gradient(180deg, rgba(31, 106, 61, 0.04) 0%, rgba(255, 255, 255, 0) 26%)',
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 1080,
          overflow: 'hidden',
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 18px 42px rgba(18, 75, 47, 0.08)',
        }}
      >
        <Grid container>
          <Grid
            size={{ xs: 12, md: 5 }}
            sx={{
              position: 'relative',
              color: 'primary.contrastText',
              p: { xs: 3, md: 4.5 },
              display: 'flex',
              overflow: 'hidden',
              borderRight: { md: '1px solid rgba(255,255,255,0.08)' },
              minHeight: { xs: 320, md: 'auto' },
              background: 'linear-gradient(180deg, #B7D7A6 0%, #A8C98F 100%)',
            }}
          >
            <Stack spacing={3.5} justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
              <Box>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    mb: 3.25,
                  }}
                >
                  <Box
                    component="img"
                    src={azuraLogo}
                    alt="Azura"
                    sx={{
                      display: 'block',
                      width: { xs: 126, sm: 148 },
                      maxWidth: '100%',
                      height: 'auto',
                      objectFit: 'contain',
                    }}
                  />
                </Box>
                <Typography
                  component="h1"
                  sx={{
                    color: '#FFFFFF',
                    mb: 0.85,
                    fontFamily: '"Bebas Neue", "Inter", sans-serif',
                    fontSize: { xs: '3.3rem', sm: '4rem' },
                    lineHeight: 0.96,
                    letterSpacing: '0.03em',
                    textShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
                  }}
                >
                  SMART EYE
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255,255,255,0.92)',
                    maxWidth: 300,
                    fontSize: { xs: '0.96rem', sm: '1rem' },
                    fontWeight: 500,
                    lineHeight: 1.45,
                    letterSpacing: '-0.01em',
                    textShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                  }}
                >
                  Real-time Disease Diagnosis &amp; Quality Assessment
                </Typography>
              </Box>

              <Divider sx={{ borderColor: 'transparent' }} />
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <CardContent sx={{ p: { xs: 3, md: 4.5 } }}>
              <Stack spacing={3.25} sx={{ maxWidth: 420, mx: 'auto', py: { md: 0.5 } }}>
                <Box>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 700,
                      fontSize: 'clamp(1.9rem, 1.65rem + 0.55vw, 2.2rem)',
                      lineHeight: 1.02,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    Sign in
                  </Typography>
                </Box>

                {error ? <Alert severity="error">{error}</Alert> : null}

                <Box component="form" onSubmit={handleSubmit} sx={{ pt: 0.25 }}>
                  <Stack spacing={1.75}>
                    <TextField
                      fullWidth
                      label="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      required
                      autoFocus
                    />
                    <TextField
                      fullWidth
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                    <Button
                      fullWidth
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={isLoading}
                      sx={{ mt: 1, py: 1.45 }}
                    >
                      {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Grid>
        </Grid>
      </Card>
    </Box>
  );
}
