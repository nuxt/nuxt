import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix.ts'

export default withMatrix({
  devtools: { enabled: false },
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  compatibilityDate: 'latest',
  nitro: {
    esbuild: {
      options: { target: 'esnext' },
    },
    output: {
      dir: `.output-${projectSuffix}`,
    },
  },
})
