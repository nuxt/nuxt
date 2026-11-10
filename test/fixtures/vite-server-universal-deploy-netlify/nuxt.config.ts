import netlify from '@netlify/vite-plugin'
import universalDeploy, { compat } from '@universal-deploy/vite'

export default defineNuxtConfig({
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Nuxt on Universal Deploy and Netlify',
    },
  },
  runtimeConfig: {
    public: {
      greeting: 'hello from runtime config',
    },
  },
  sourcemap: false,
  compatibilityDate: 'latest',
  vite: {
    plugins: [
      compat({ entry: '#server-entry' }),
      universalDeploy(),
      netlify({ build: { enabled: true } }),
    ],
  },
  server: {
    builder: 'vite',
  },
})
