export default defineNuxtConfig({
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Pure Vite SSR',
    },
  },
  runtimeConfig: {
    public: {
      greeting: 'hello from runtime config',
    },
  },
  routeRules: {
    '/spa': { ssr: false },
    '/no-scripts': { noScripts: true },
    '/old/**': { redirect: { to: '/about', status: 301 } },
    '/moved': { redirect: '/about?from=rule#top' },
    '/guarded': { appMiddleware: 'guard' },
    '/themed': { appLayout: 'themed' },
  },
  sourcemap: false,
  compatibilityDate: 'latest',
  server: {
    builder: 'vite',
  },
})
