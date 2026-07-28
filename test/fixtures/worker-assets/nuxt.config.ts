import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix'

// Regression fixture for nuxt/nuxt#22966: an asset imported from both the app
// and a web worker should be emitted once, not under two differently-named copies.
export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  nitro: {
    output: {
      dir: `.output-${projectSuffix}`,
    },
  },
  vite: {
    build: {
      // ensure the small test asset is emitted as a file rather than inlined
      assetsInlineLimit: 0,
    },
  },
})
