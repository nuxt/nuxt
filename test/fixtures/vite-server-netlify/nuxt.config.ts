import netlify from '@netlify/vite-plugin'

export default defineNuxtConfig({
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Nuxt on Netlify',
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
    // `build.enabled` wraps the server build in a function, and wants a `fetch` default export
    plugins: [netlify({ build: { enabled: true } })],
  },
  server: {
    builder: 'vite',
  },
})
