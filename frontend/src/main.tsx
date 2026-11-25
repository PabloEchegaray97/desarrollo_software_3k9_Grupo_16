import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sileo'
import './styles/index.css'
import './shared/components/form-controls.css'
import App from './app/App.tsx'
import { ThemeProvider, useTheme } from './app/theme/ThemeProvider.tsx'
import { applyInitialTheme } from './app/theme/theme.ts'

applyInitialTheme()

function AppToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster position="top-center" theme={resolvedTheme} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <AppToaster />
    </ThemeProvider>
  </StrictMode>,
)
