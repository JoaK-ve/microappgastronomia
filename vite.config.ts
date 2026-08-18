import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// Fuente única de verdad para la versión de la aplicación: el campo
// "version" de package.json. Se inyecta en tiempo de build como una
// constante global (__APP_VERSION__) — sin librerías, sin duplicar el
// número en ningún otro archivo de código.
const pkg = JSON.parse(readFileSync(path.resolve(import.meta.dirname, './package.json'), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
