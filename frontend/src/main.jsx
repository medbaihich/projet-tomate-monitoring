import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { AppThemeProvider } from './theme-mode'
import App from './App'
import 'leaflet/dist/leaflet.css'
import './index.css'



createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppThemeProvider>
  </StrictMode>,
)
