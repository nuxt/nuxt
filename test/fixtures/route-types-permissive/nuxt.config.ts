export default defineNuxtConfig({
  devtools: { enabled: false },
  // `strictRouteTypes` is left unset: this fixture asserts the default
  experimental: { nitroAutoImports: true },
  compatibilityDate: 'latest',
})
