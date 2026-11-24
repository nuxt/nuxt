export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Pure Vite SPA',
    },
  },
  spaLoadingTemplate: true,
  runtimeConfig: {
    public: {
      greeting: 'hello from runtime config',
    },
  },
  sourcemap: false,
  compatibilityDate: 'latest',
  vite: {
    plugins: [{
      name: 'respond-to-every-request',
      apply: 'serve',
      configureServer: server => () => {
        server.middlewares.use((_req, res) => {
          res.statusCode = 404
          res.end()
        })
      },
    }],
  },
  // the badge is skipped when `test` is set
  test: false,
  server: {
    builder: 'vite',
  },
})
