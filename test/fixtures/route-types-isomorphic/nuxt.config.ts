export default defineNuxtConfig({
  devtools: { enabled: false },
  routeRules: { '/cached/**': { swr: 600 } },
  // `routeTypedFetch` is left unset: `compatibilityVersion: 5` is what turns it on here
  future: { compatibilityVersion: 5 },
  experimental: { strictRouteTypes: 'isomorphic', nitroAutoImports: true },
  compatibilityDate: 'latest',
  nitro: { compressPublicAssets: { gzip: true } },
})
