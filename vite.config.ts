import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Use /PokepelagoClient/ as base only on GitHub Pages (CI), not localhost
  base: process.env.GITHUB_ACTIONS ? '/PokepelagoClient/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
