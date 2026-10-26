import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix.ts'

export default withMatrix({
  css: ['~/global.css'],
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  routeRules: {
    '/redirected-server-page': { redirect: '/server-page' },
  },
  experimental: {
    componentIslands: {
      selectiveClient: 'deep',
    },
  },
  nitro: {
    prerender: {
      routes: [
        '/prefetch/server-components',
        '/prerender/island-a',
        '/prerender/island-b',
      ],
    },
  },
})
