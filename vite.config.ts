import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

const frontendRoot = fileURLToPath(new URL('./frontend', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  root: frontendRoot,
  publicDir: fileURLToPath(new URL('./frontend/public', import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
})
