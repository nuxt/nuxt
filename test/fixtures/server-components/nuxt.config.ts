import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix'

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  experimental: {
    componentIslands: {
      selectiveClient: 'deep',
    },
    runtimeBaseURL: true,
  },
  nitro: {
    prerender: {
      routes: [
        '/prefetch/server-components',
      ],
    },
  },
})
