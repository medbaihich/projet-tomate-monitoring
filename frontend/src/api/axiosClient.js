import axios from 'axios'
import useAuthStore from '@/store/authStore'

// Axios instance
// baseURL "/" works in both:
//   - local dev when requests stay same-origin
//   - Docker/Traefik where /api/* routes to the backend on the same host
const apiClient = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json',
  },
})

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

// On 401, attempt one silent token refresh, then retry the original request.
// On refresh failure, log out and reject.
let isRefreshing = false
let pendingQueue = []

/**
 * Flush requests that were held while refresh was in progress.
 * @param {string|null} newToken
 * @param {any} error
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
  (response) => response,

  async (error) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retried) {
      return Promise.reject(error)
    }

    originalRequest._retried = true

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then((newToken) => {
        originalRequest.headers = originalRequest.headers ?? {}
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      })
    }

    isRefreshing = true

    const { logout, setAuth, user, refreshToken } = useAuthStore.getState()

    if (!refreshToken) {
      isRefreshing = false
      logout()
      flushQueue(null, error)
      return Promise.reject(error)
    }

    try {
      const { data } = await axios.post('/api/v1/auth/refresh/', {
        refresh: refreshToken,
      })

      const newAccessToken = data.access
      setAuth(user, newAccessToken)
      flushQueue(newAccessToken)

      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      flushQueue(null, refreshError)
      logout()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default apiClient
