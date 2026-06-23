import { withMatrix } from '../../matrix'

// Regression fixture for nuxt/nuxt#24035: `buildAssetsDir` ('abc') collides
// with a source directory of the same name that contains a CSS file
// referenced via the `@/` alias.
export default withMatrix({
  app: { buildAssetsDir: 'abc' },
  css: ['@/abc/main.css'],
})
