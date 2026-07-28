import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_API_URL || 'http://backend:8000'
  
  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Allow external connections (required for Docker)
      host: '0.0.0.0',
      port: 3001,
      // Proxy API requests to the FastAPI backend container
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})