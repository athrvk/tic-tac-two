import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window', // sockjs-client expects a Node-style global
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'build',
  },
})
