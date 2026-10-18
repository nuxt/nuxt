/**
 * The routes the function serves, declared to Nuxt through the same registry a server
 * builder contributes to, so `$fetch('/api/hello')` is typed in the app.
 */
declare module '@nuxt/schema' {
  interface ServerRoutes {
    '/api/hello': { get: { message: string } }
  }
}

export {}
