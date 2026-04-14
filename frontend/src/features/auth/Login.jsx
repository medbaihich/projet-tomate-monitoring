import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Paper, Alert, CircularProgress } from '@mui/material';
import axiosClient from '@/api/axiosClient';
import useAuthStore from '@/store/authStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Login to get tokens
      const loginRes = await axiosClient.post('/api/v1/auth/login/', {
        username,
        password,
      });
      
      const { access, refresh } = loginRes.data;

      // Temporary save tokens in store so the next request automatically uses the access token
      setAuth(null, access, refresh);

      // 2. Fetch current user using the token we just received
      const userRes = await axiosClient.get('/api/v1/auth/me/');
      
      // 3. Store full user in Zustand
      setAuth(userRes.data, access, refresh);

      // 4. Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid username or password');
      } else {
        setError(err.response?.data?.detail || 'An error occurred during login');
      }
      // On failure, ensure we clear any partial state
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh', 
        bgcolor: 'background.default',
        p: 2
      }}
    >
      <Paper elevation={3} sx={{ p: { xs: 3, md: 5 }, width: '100%', maxWidth: 450, borderRadius: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center" fontWeight="bold">
          🍅 Tomato Monitoring
        </Typography>
        <Typography variant="subtitle1" gutterBottom align="center" color="text.secondary" sx={{ mb: 4 }}>
          Sign in to your account
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Username"
            variant="outlined"
            margin="normal"
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
            variant="outlined"
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
          />
          <Button
            fullWidth
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            disabled={isLoading}
            sx={{ mt: 3, mb: 1, py: 1.5 }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
