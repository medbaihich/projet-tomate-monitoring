import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Auth store — manages authentication state across the app.
 *
 * State:
 *   user            — current user object from GET /api/v1/auth/me/
 *                     shape: { id, username, email, first_name, last_name, role }
 *   accessToken     — JWT access token (persisted in localStorage)
 *   isAuthenticated — derived boolean, true when accessToken is present
 *
 * Actions:
 *   setAuth(user, token) — called after a successful login or token refresh
 *   logout()             — clears all auth state and removes token from storage
 */
const useAuthStore = create(
  persist(
    (set) => ({
      // ── State ──────────────────────────────────────────────
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      // ── Actions ────────────────────────────────────────────

      /**
       * setAuth — store the authenticated user and access token.
       * Called after POST /api/v1/auth/login/ or POST /api/v1/auth/refresh/
       *
       * @param {object} user  - user object from GET /api/v1/auth/me/
       * @param {string} token - JWT access token string
       */
      setAuth: (user, accessToken, refreshToken) =>
        set((state) => ({
          user,
          accessToken,
          refreshToken: refreshToken || state.refreshToken,
          isAuthenticated: true,
        })),

      /**
       * logout — clear all auth state.
       * The persist middleware automatically removes the stored key from localStorage.
       */
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),

    {
      name: 'auth-storage',        // localStorage key
      partialize: (state) => ({    // only persist tokens and auth status, not the full user object
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)

export default useAuthStore
