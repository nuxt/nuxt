export default defineNuxtConfig({
  devtools: { enabled: false },
  // `routeTypedFetch` without `compatibilityVersion: 5`: the engine is selected on its own.
  // `strictRouteTypes` is left unset, so this fixture asserts its default
  experimental: { routeTypedFetch: true, nitroAutoImports: true },
  compatibilityDate: 'latest',
})
