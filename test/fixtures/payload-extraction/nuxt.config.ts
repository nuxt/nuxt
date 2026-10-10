import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix.ts'

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  sourcemap: false,
  experimental: {
    payloadExtraction: 'always',
  },
  nitro: {
    output: {
      dir: `.output-${projectSuffix}`,
    },
  },
})
