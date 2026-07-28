import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix'

export default withMatrix({
  devtools: { enabled: false },
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  pages: false,
  sourcemap: false,
  compatibilityDate: 'latest',
  nitro: {
    output: {
      dir: `.output-${projectSuffix}`,
    },
  },
})
