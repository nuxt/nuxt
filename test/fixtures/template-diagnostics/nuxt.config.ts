import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix.ts'

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  nitro: {
    output: {
      dir: `.output-${projectSuffix}`,
    },
  },
})
