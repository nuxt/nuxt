import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix'

const mode = process.env.NUXT_TEST_CRITICAL

// `options` exercises the object form (forwarded to beasties); `true` the boolean form.
const criticalStyles = mode === 'options'
  ? { allowRules: ['.global-unused'] }
  : mode === 'true'

const outputSuffix = mode === 'options' ? '-options' : mode === 'true' ? '-critical' : ''

export default withMatrix({
  css: ['~/assets/global.css'],
  buildDir: isNuxtPrepare ? undefined : `.nuxt-${projectSuffix}`,
  routeRules: {
    '/spa': { ssr: false },
  },
  sourcemap: false,
  features: {
    criticalStyles,
  },
  nitro: {
    output: {
      dir: `.output-${projectSuffix}${outputSuffix}`,
    },
    prerender: {
      routes: ['/spa'],
    },
  },
})
