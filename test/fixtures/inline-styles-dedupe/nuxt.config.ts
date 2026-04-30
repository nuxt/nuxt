import { withMatrix } from '../../matrix'

// Regression for https://github.com/nuxt/nuxt/issues/30435: when every CSS
// module bundled into a chunk's CSS asset has also been inlined as a `<style>`
// tag during SSR, the duplicate stylesheet `<link>` should be dropped.
const projectSuffix = [
  process.env.TEST_BUILDER,
  process.env.TEST_ENV,
  process.env.TEST_CONTEXT,
  process.env.TEST_MANIFEST,
].filter(Boolean).join('-') || 'default'

const isPrepare = process.argv.slice(2).includes('prepare')

export default withMatrix({
  ...(isPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  sourcemap: false,
  nitro: {
    output: {
      dir: `.output-${projectSuffix}`,
    },
  },
})
