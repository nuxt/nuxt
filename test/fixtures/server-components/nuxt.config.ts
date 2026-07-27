import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix'

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
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
