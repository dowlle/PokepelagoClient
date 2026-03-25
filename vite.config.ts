import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // Use /PokepelagoClient/beta/ for beta deploys, /PokepelagoClient/ for main CI, / for localhost
    base: env.DEPLOY_TARGET === 'beta'
      ? '/PokepelagoClient/beta/'
      : env.GITHUB_ACTIONS
        ? '/PokepelagoClient/'
        : '/',
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      __IS_BETA__: env.DEPLOY_TARGET === 'beta',
      __TWITCH_ENABLED__: env.VITE_TWITCH_CHAT === 'true',
    },
  }
})
