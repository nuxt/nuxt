import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix.ts'

export default withMatrix({
  devtools: { enabled: false },
  routeRules: {
    '/**': { streaming: false },
    '/client-only': { ssr: false },
    '/streamed': { streaming: true },
  },
  experimental: {
    ssrStreaming: true,
  },
  // the overlay is skipped when `test` is set, and this fixture renders it
  test: false,
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  compatibilityDate: 'latest',
  nitro: {
    output: {
      dir: `.output-${projectSuffix}`,
    },
  },
})
