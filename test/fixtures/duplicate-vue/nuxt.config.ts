import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix.ts'

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  build: {
    transpile: ['duplicate-vue-ui'],
  },
  nitro: {
    output: {
      dir: `.output-${projectSuffix}`,
    },
    prerender: {
      routes: ['/'],
    },
  },
})
