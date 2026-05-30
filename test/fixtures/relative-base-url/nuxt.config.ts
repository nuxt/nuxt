import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix'

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  app: {
    baseURL: './',
  },
  css: ['~/assets/main.css'],
  nitro: {
    output: {
      dir: `.output-${projectSuffix}`,
    },
  },
})
