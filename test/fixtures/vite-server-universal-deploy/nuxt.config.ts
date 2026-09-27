import universalDeploy, { compat } from '@universal-deploy/vite'

export default defineNuxtConfig({
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Nuxt on Universal Deploy',
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
      // registers the render in the universal-deploy store, for an adapter to build against
      compat({ entry: '#server-entry' }),
      universalDeploy(),
    ],
  },
  server: {
    builder: 'vite',
  },
})
