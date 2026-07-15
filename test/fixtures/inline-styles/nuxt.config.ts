import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix'

// Regression for https://github.com/nuxt/nuxt/issues/30435: when every CSS
// module bundled into a chunk's CSS asset has also been inlined as a `<style>`
// tag during SSR, the duplicate stylesheet `<link>` should be dropped.
// Regression for https://github.com/nuxt/nuxt/issues/31558: a regular `.vue`
// child reachable only via a server component should still have its CSS inlined.
export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  sourcemap: false,
  nitro: {
    output: {
      dir: `.output-${projectSuffix}`,
    },
  },
})
