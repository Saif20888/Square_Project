import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // The Spring Boot backend's CORS only trusts http://localhost:5173, so this
  // app MUST run on 5173. strictPort makes Vite fail loudly if 5173 is taken
  // instead of silently drifting to 5174 (which the backend would then block).
  server: { port: 5173, strictPort: true },
})