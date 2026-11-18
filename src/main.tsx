import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import '@fontsource/sora/latin-500.css'
import '@fontsource/sora/latin-700.css'
import './index.css'

registerSW({ immediate: true })
createRoot(document.getElementById('root')!).render(<App />)
