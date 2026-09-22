import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Load theme from localStorage on app start - default to light
const savedTheme = localStorage.getItem("llm-ranker-theme") || "light"
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark")
} else {
  document.documentElement.classList.remove("dark")
  // Ensure light theme is set as default
  localStorage.setItem("llm-ranker-theme", "light")
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

