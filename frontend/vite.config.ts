import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/firms-proxy': {
        target: 'https://firms.modaps.eosdis.nasa.gov',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/firms-proxy/, ''),
      },
    },
  },
})
