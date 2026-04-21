import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import PageHeader from '@/components/ui/PageHeader';
import PanelCard from '@/components/ui/PanelCard';
import { changeMyPassword, fetchMyProfile, updateMyProfile } from '@/features/account/api';
import useAuthStore from '@/store/authStore';

function toFieldErrorMap(error) {
  const payload = error?.response?.data;
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return {};
  }

  return Object.entries(payload).reduce((accumulator, [key, value]) => {
    if (Array.isArray(value)) {
      accumulator[key] = value.join(' ');
    } else if (typeof value === 'string') {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
}

function resolveErrorMessage(error, fallbackMessage) {
  const payload = error?.response?.data;

  if (typeof payload?.detail === 'string' && payload.detail.trim()) {
    return payload.detail;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function formatRoleLabel(roleName) {
  const normalized = (roleName || '').trim().toLowerCase();
  if (!normalized) {
    return 'Operator';
  }

  return normalized === 'admin'
    ? 'Administrator'
    : normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function ProfileSummaryCard({ profile }) {
  const roleName = profile?.role?.name || '';
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  const displayName = fullName || profile?.username || 'User';

  return (
    <PanelCard
      title="Account overview"
      subtitle="Your authenticated account identity as currently returned by the backend."
      badge={formatRoleLabel(roleName)}
      minHeight={220}
    >
      <Stack spacing={1.5}>
        <Stack spacing={0.6}>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            {displayName}
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip icon={<PersonOutlineRoundedIcon />} size="small" label={profile?.username || 'Unknown user'} />
            <Chip
              icon={<VerifiedUserRoundedIcon />}
              size="small"
              variant="outlined"
              label={profile?.role?.name || 'No role assigned'}
            />
          </Stack>
        </Stack>

        <Stack spacing={1.05}>
          <Stack spacing={0.3}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Email
            </Typography>
            <Typography variant="body2">{profile?.email || 'No email provided'}</Typography>
          </Stack>

          <Stack spacing={0.3}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Role
            </Typography>
            <Typography variant="body2">{formatRoleLabel(profile?.role?.name)}</Typography>
          </Stack>

          <Stack spacing={0.3}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Account ID
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {profile?.id || 'N/A'}
            </Typography>
          </Stack>
        </Stack>
      </Stack>
    </PanelCard>
  );
}

export default function AccountPage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const storedUser = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);

  const [profileForm, setProfileForm] = useState({
    email: storedUser?.email || '',
    first_name: storedUser?.first_name || '',
    last_name: storedUser?.last_name || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_new_password: '',
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [profileNotice, setProfileNotice] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['auth-profile'],
    queryFn: fetchMyProfile,
    initialData: storedUser ?? undefined,
    onSuccess: (nextProfile) => {
      setProfileForm({
        email: nextProfile.email || '',
        first_name: nextProfile.first_name || '',
        last_name: nextProfile.last_name || '',
      });

      if (accessToken) {
        setAuth(nextProfile, accessToken, refreshToken);
      }
    },
  });

  const hasProfileChanges = useMemo(
    () => (
      (profile?.email || '') !== profileForm.email
      || (profile?.first_name || '') !== profileForm.first_name
      || (profile?.last_name || '') !== profileForm.last_name
    ),
    [profile, profileForm],
  );

  const updateProfileMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (updatedProfile) => {
      setProfileErrors({});
      setProfileNotice('');
      setSuccessMessage('Profile updated successfully.');
      queryClient.setQueryData(['auth-profile'], updatedProfile);
      setProfileForm({
        email: updatedProfile.email || '',
        first_name: updatedProfile.first_name || '',
        last_name: updatedProfile.last_name || '',
      });
      if (accessToken) {
        setAuth(updatedProfile, accessToken, refreshToken);
      }
    },
    onError: (mutationError) => {
      setProfileErrors(toFieldErrorMap(mutationError));
      setProfileNotice(resolveErrorMessage(mutationError, 'Unable to update your profile.'));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: changeMyPassword,
    onSuccess: (response) => {
      setPasswordErrors({});
      setPasswordNotice('');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_new_password: '',
      });
      setSuccessMessage(response?.detail || 'Password changed successfully.');
    },
    onError: (mutationError) => {
      setPasswordErrors(toFieldErrorMap(mutationError));
      setPasswordNotice(resolveErrorMessage(mutationError, 'Unable to change your password.'));
    },
  });

  const handleProfileInputChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((currentState) => ({
      ...currentState,
      [name]: value,
    }));
  };

  const handlePasswordInputChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((currentState) => ({
      ...currentState,
      [name]: value,
    }));
  };

  const handleProfileSubmit = (event) => {
    event.preventDefault();
    setProfileErrors({});
    setProfileNotice('');
    updateProfileMutation.mutate(profileForm);
  };

  const handlePasswordSubmit = (event) => {
    event.preventDefault();
    setPasswordErrors({});
    setPasswordNotice('');
    changePasswordMutation.mutate(passwordForm);
  };

  if (isLoading && !profile) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary">Loading your account...</Typography>
        </Stack>
      </Box>
    );
  }

  if (isError && !profile) {
    return (
      <Alert
        severity="error"
        action={(
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        )}
      >
        {resolveErrorMessage(error, 'Failed to load your account details.')}
      </Alert>
    );
  }

  return (
    <>
      <Stack spacing={1.75}>
        <PageHeader
          eyebrow="Account"
          title="My Profile"
          subtitle="View your account identity, update your personal information, and change your password without leaving the main workspace."
        />

        <Grid container spacing={1.75} alignItems="stretch">
          <Grid size={{ xs: 12, xl: 4 }}>
            <ProfileSummaryCard profile={profile} />
          </Grid>

          <Grid size={{ xs: 12, xl: 8 }}>
            <PanelCard
              title="Personal information"
              subtitle="Only your own profile fields can be edited here. Role is shown for reference and remains read-only."
              badge="Self service"
            >
              <Stack spacing={1.4}>
                {profileNotice ? <Alert severity="error">{profileNotice}</Alert> : null}

                <Box component="form" onSubmit={handleProfileSubmit}>
                  <Grid container spacing={1.25}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Username"
                        value={profile?.username || ''}
                        disabled
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Role"
                        value={formatRoleLabel(profile?.role?.name)}
                        disabled
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="First name"
                        name="first_name"
                        value={profileForm.first_name}
                        onChange={handleProfileInputChange}
                        error={Boolean(profileErrors.first_name)}
                        helperText={profileErrors.first_name || ' '}
                        disabled={updateProfileMutation.isPending}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Last name"
                        name="last_name"
                        value={profileForm.last_name}
                        onChange={handleProfileInputChange}
                        error={Boolean(profileErrors.last_name)}
                        helperText={profileErrors.last_name || ' '}
                        disabled={updateProfileMutation.isPending}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        label="Email"
                        name="email"
                        type="email"
                        value={profileForm.email}
                        onChange={handleProfileInputChange}
                        error={Boolean(profileErrors.email)}
                        helperText={profileErrors.email || ' '}
                        disabled={updateProfileMutation.isPending}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Stack direction="row" justifyContent="flex-end" spacing={0.75}>
                        <Button
                          type="submit"
                          variant="contained"
                          startIcon={<SaveRoundedIcon />}
                          disabled={!hasProfileChanges || updateProfileMutation.isPending}
                        >
                          {updateProfileMutation.isPending ? 'Saving...' : 'Save changes'}
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </Box>
              </Stack>
            </PanelCard>
          </Grid>
        </Grid>

        <Grid container spacing={1.75}>
          <Grid size={{ xs: 12, xl: 8 }}>
            <PanelCard
              title="Change password"
              subtitle="Update your password securely using your current password and a confirmed new password."
              badge="Security"
            >
              <Stack spacing={1.4}>
                {passwordNotice ? <Alert severity="error">{passwordNotice}</Alert> : null}

                <Box component="form" onSubmit={handlePasswordSubmit}>
                  <Grid container spacing={1.25}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        label="Current password"
                        name="current_password"
                        type="password"
                        value={passwordForm.current_password}
                        onChange={handlePasswordInputChange}
                        error={Boolean(passwordErrors.current_password)}
                        helperText={passwordErrors.current_password || ' '}
                        disabled={changePasswordMutation.isPending}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        label="New password"
                        name="new_password"
                        type="password"
                        value={passwordForm.new_password}
                        onChange={handlePasswordInputChange}
                        error={Boolean(passwordErrors.new_password)}
                        helperText={passwordErrors.new_password || ' '}
                        disabled={changePasswordMutation.isPending}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        label="Confirm new password"
                        name="confirm_new_password"
                        type="password"
                        value={passwordForm.confirm_new_password}
                        onChange={handlePasswordInputChange}
                        error={Boolean(passwordErrors.confirm_new_password)}
                        helperText={passwordErrors.confirm_new_password || ' '}
                        disabled={changePasswordMutation.isPending}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Stack direction="row" justifyContent="flex-end">
                        <Button
                          type="submit"
                          variant="contained"
                          color="primary"
                          startIcon={<LockResetRoundedIcon />}
                          disabled={changePasswordMutation.isPending}
                        >
                          {changePasswordMutation.isPending ? 'Updating...' : 'Change password'}
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </Box>
              </Stack>
            </PanelCard>
          </Grid>
        </Grid>
      </Stack>

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />
    </>
  );
}
