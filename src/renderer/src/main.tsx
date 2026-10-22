import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, loadTheme } from './prefs'
import './index.css'

applyTheme(loadTheme()) // before the first paint, so dark mode doesn't flash light

createRoot(document.getElementById('root')!).render(<App />)
