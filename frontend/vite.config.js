import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'frontend',
    ],
    watch: {
      usePolling: process.env.VITE_USE_POLLING === 'true',
      interval: Number(process.env.VITE_WATCH_INTERVAL || 1000),
      ignored: [
        '**/.git/**',
        '**/dist/**',
        '**/node_modules/**',
      ],
    },
    hmr: {
      host: 'localhost',
      protocol: 'ws',
      clientPort: 80,
    },
  },
})
