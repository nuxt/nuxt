import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix.ts'

export default withMatrix({
  css: ['~/global.css'],
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  experimental: {
    componentIslands: 'vue-onigiri',
    runtimeBaseURL: true,
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
