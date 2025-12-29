import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Note: StrictMode removed to prevent double API calls in development
// StrictMode causes components to mount twice intentionally to detect side effects
// In production builds, this doesn't happen
ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />,
)
