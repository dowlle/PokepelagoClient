import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isBeta = env.DEPLOY_TARGET === 'beta'
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
      {
        name: 'pokepelago-search-metadata',
        transformIndexHtml() {
          if (isBeta) {
            return [{
              tag: 'meta',
              attrs: { name: 'robots', content: 'noindex, nofollow' },
              injectTo: 'head',
            }]
          }

          return [
            {
              tag: 'link',
              attrs: { rel: 'canonical', href: 'https://pokepelago.ap-pie.com/' },
              injectTo: 'head',
            },
            {
              tag: 'script',
              attrs: { type: 'application/ld+json' },
              children: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebApplication',
                name: 'Poképelago',
                alternateName: 'Pokepelago',
                url: 'https://pokepelago.ap-pie.com/',
                description: 'Guess and catch Pokémon in your browser with Poképelago. Connect to an Archipelago multiworld, or play standalone.',
                applicationCategory: 'GameApplication',
                operatingSystem: 'Any operating system with a web browser',
                isAccessibleForFree: true,
                offers: {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'EUR',
                },
                isPartOf: {
                  '@type': 'WebSite',
                  name: 'Archipelago Pie',
                  url: 'https://ap-pie.com/',
                },
              }),
              injectTo: 'head',
            },
          ]
        },
      },
    ],
    define: {
      __IS_BETA__: isBeta,
      __TWITCH_ENABLED__: env.VITE_TWITCH_CHAT === 'true',
    },
  }
})
