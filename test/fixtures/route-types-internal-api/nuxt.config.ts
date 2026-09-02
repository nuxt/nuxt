export default defineNuxtConfig({
  devtools: { enabled: false },
  // the engine is selected on its own, so it can be turned off under a compatibility version that
  // would otherwise enable it
  future: { compatibilityVersion: 5 },
  experimental: { routeTypedFetch: false, nitroAutoImports: true },
  compatibilityDate: 'latest',
})
