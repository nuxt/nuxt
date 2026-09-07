import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix.ts'

export default withMatrix({
  devtools: { enabled: false },
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  sourcemap: false,
  compatibilityDate: 'latest',
  nitro: {
    output: {
      dir: `.output-${projectSuffix}`,
    },
  },
  vite: {
    plugins: [
      {
        name: 'test:virtual-module',
        resolveId (id) {
          if (id === 'test-virtual-module') {
            return '\0test-virtual-module'
          }
        },
        load (id) {
          if (id === '\0test-virtual-module') {
            return 'export default "virtual"'
          }
        },
      },
    ],
  },
})
