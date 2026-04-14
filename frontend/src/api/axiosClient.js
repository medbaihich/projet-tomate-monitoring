import axios from 'axios'
import useAuthStore from '@/store/authStore'

// ─── Axios Instance ────────────────────────────────────────────────────────────
// baseURL "/" works in both:
//   - local dev (Vite dev server on :3000, backend on :8000 via proxy or direct)
//   - Docker (Traefik routes /api/* → backend, /* → frontend on same domain)

const apiClient = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request Interceptor ───────────────────────────────────────────────────────
// Attach the JWT access token to every outgoing request.

apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error),
)

// ─── Response Interceptor ─────────────────────────────────────────────────────
// On 401 → attempt one silent token refresh, then retry the original request.
// On refresh failure → logout and reject.

let isRefreshing = false           // guard: only one refresh call at a time
let pendingQueue = []              // requests waiting for the refresh to finish

/**
 * Flush the queue of requests that were held while refresh was in progress.
 * @param {string|null} newToken - new access token on success, null on failure
 * @param {any}         error    - rejection reason on failure
 */
const flushQueue = (newToken, error = null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(newToken)
    }
  })
  pendingQueue = []
}

apiClient.interceptors.response.use(
  // Pass through successful responses unchanged
  (response) => response,

  async (error) => {
    const originalRequest = error.config

    // Only handle 401 and only attempt one retry per request
    if (error.response?.status !== 401 || originalRequest._retried) {
      return Promise.reject(error)
    }

    // Mark this request so we don't retry it again
    originalRequest._retried = true

    // ── If a refresh is already in progress, queue this request ──────────────
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then((newToken) => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      })
    }

    // ── Start the refresh flow ────────────────────────────────────────────────
    isRefreshing = true

    const { accessToken, logout, setAuth, user } = useAuthStore.getState()

    // Retrieve the refresh token from localStorage directly.
    // It is stored by the auth flow but not in the Zustand state slice.
    const stored = JSON.parse(localStorage.getItem('auth-storage') ?? '{}')
    const refreshToken = stored?.state?.refreshToken ?? null

    if (!refreshToken) {
      // No refresh token available — cannot recover
      isRefreshing = false
      logout()
      flushQueue(null, error)
      return Promise.reject(error)
    }

    try {
      // POST /api/v1/auth/refresh/ — public endpoint, no auth header needed
      const { data } = await axios.post('/api/v1/auth/refresh/', {
        refresh: refreshToken,
      })

      const newAccessToken = data.access

      // Persist the new token into the store
      setAuth(user, newAccessToken)

      // Flush all queued requests with the new token
      flushQueue(newAccessToken)

      // Retry the original request with the new token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      // Refresh failed (expired, revoked, etc.) — log the user out
      flushQueue(null, refreshError)
      logout()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default apiClient
