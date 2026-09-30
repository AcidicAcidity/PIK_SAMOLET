import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// В dev-режиме запросы /api и /media проксируются на Django (localhost:8000)
const target = process.env.VITE_API_PROXY || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': target,
      '/media': target,
      '/django-admin': target,
      '/django-static': target,
    },
  },
})
