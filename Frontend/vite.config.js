import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createServiceUrlConfig } from './src/config/serviceUrls.js'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, projectRoot, 'VITE_')
  createServiceUrlConfig(environment)

  return {
    plugins: [react(), tailwindcss()],
  }
})
