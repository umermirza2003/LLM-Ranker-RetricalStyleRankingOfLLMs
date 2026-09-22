import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Match Node server port from server/.env so Vite proxy hits the same process as `node index.js`. */
function resolveApiOrigin() {
  if (process.env.VITE_API_PORT && String(process.env.VITE_API_PORT).trim() !== '') {
    return `http://127.0.0.1:${Number(process.env.VITE_API_PORT)}`
  }
  const envPath = path.resolve(__dirname, '../server/.env')
  let port = 5000
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, 'utf8')
    const m = text.match(/^\s*PORT\s*=\s*(\d+)/m)
    if (m) port = Number(m[1])
  }
  return `http://127.0.0.1:${port}`
}

const API_ORIGIN = resolveApiOrigin()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/providers': { target: API_ORIGIN, changeOrigin: true },
      '/ask': { target: API_ORIGIN, changeOrigin: true },
      '/rank-responses': { target: API_ORIGIN, changeOrigin: true },
      '/custom-ranking': { target: API_ORIGIN, changeOrigin: true },
      '/api': { target: API_ORIGIN, changeOrigin: true },
      '/dataset-train': { target: API_ORIGIN, changeOrigin: true },
      '/health': { target: API_ORIGIN, changeOrigin: true },
    },
  },
})
