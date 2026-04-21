import axios from 'axios'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isAuthReady: false,
      isRestoring: false,
      hasHydrated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set((state) => ({
          user,
          accessToken,
          refreshToken: refreshToken || state.refreshToken,
          isAuthenticated: Boolean(user && accessToken),
          isAuthReady: true,
          isRestoring: false,
        })),

      setHydrated: () =>
        set({
          hasHydrated: true,
        }),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isAuthReady: true,
          isRestoring: false,
        }),

      restoreSession: async () => {
        const { accessToken, refreshToken, isRestoring, clearAuth, setAuth } = get()

        if (isRestoring) {
          return
        }

        if (!accessToken && !refreshToken) {
          clearAuth()
          return
        }

        set({
          isRestoring: true,
          isAuthReady: false,
        })

        try {
          let activeAccessToken = accessToken

          if (activeAccessToken) {
            try {
              const { data: user } = await axios.get('/api/v1/auth/me/', {
                headers: {
                  Authorization: `Bearer ${activeAccessToken}`,
                },
              })

              setAuth(user, activeAccessToken, refreshToken)
              return
            } catch {
              activeAccessToken = null
            }
          }

          if (!refreshToken) {
            clearAuth()
            return
          }

          const { data: refreshData } = await axios.post('/api/v1/auth/refresh/', {
            refresh: refreshToken,
          })

          activeAccessToken = refreshData.access

          const { data: user } = await axios.get('/api/v1/auth/me/', {
            headers: {
              Authorization: `Bearer ${activeAccessToken}`,
            },
          })

          setAuth(user, activeAccessToken, refreshToken)
        } catch {
          clearAuth()
        }
      },

      logout: () => get().clearAuth(),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          state?.clearAuth()
          return
        }

        state?.setHydrated()
      },
    },
  ),
)

export default useAuthStore
