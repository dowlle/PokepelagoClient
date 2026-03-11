import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Use /PokepelagoClient/beta/ for beta deploys, /PokepelagoClient/ for main CI, / for localhost
  base: process.env.DEPLOY_TARGET === 'beta'
    ? '/PokepelagoClient/beta/'
    : process.env.GITHUB_ACTIONS
      ? '/PokepelagoClient/'
      : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    __IS_BETA__: process.env.DEPLOY_TARGET === 'beta',
  },
})
