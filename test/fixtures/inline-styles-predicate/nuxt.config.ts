import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix.ts'

// Regression for a `features.inlineStyles` predicate that inlines a shared CSS
// source for one page but not another: the page that does not inline it must
// keep its stylesheet link.
export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  sourcemap: false,
  features: {
    inlineStyles: (id?: string) => !!id && id.includes('.vue') && !id.includes('not-inlined'),
  },
  nitro: {
    output: {
      dir: `.output-${projectSuffix}`,
    },
  },
})
