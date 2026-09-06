/** Stands in for the render in development, where the dev server serves the app. */
export const fetch = (): Promise<Response> => Promise.resolve(new Response('The Nuxt server handler is only emitted by a build. In development the app is served by the Nuxt dev server.', {
  status: 503,
  headers: { 'content-type': 'text/plain;charset=utf-8' },
}))

export default { fetch }
