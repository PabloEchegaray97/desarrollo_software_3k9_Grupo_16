import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/index.css'
import App from './app/App.tsx'
import { ThemeProvider } from './app/theme/ThemeProvider.tsx'
import { applyInitialTheme } from './app/theme/theme.ts'

applyInitialTheme()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
