import { createRequire } from 'module'
import { extendWebpackConfig, useNuxt } from '@nuxt/kit'

const extensions = ['ts', 'tsx', 'cts', 'mts']
const typescriptRE = /\.[cm]?tsx?$/

export function setupTypescript () {
  const nuxt = useNuxt()

  nuxt.options.extensions.push(...extensions)
  nuxt.options.build.additionalExtensions.push(...extensions)

  const _require = createRequire(import.meta.url)
  const babelPlugin = _require.resolve('@babel/plugin-transform-typescript')
  nuxt.options.build.babel.plugins = nuxt.options.build.babel.plugins || []

  // Error if `@nuxt/typescript-build` is added
  if (nuxt.options.buildModules.includes('@nuxt/typescript-build')) {
    throw new Error('Please remove `@nuxt/typescript-build` from `buildModules` or set `bridge.typescript: false` to avoid conflict with bridge.')
  }

  nuxt.options.build.babel.plugins.unshift(babelPlugin)

  extendWebpackConfig((config) => {
    config.resolve.extensions!.push(...extensions.map(e => `.${e}`))
    const babelRule: any = config.module.rules.find((rule: any) => rule.test?.test('test.js'))
    config.module.rules.unshift({
      ...babelRule,
      test: typescriptRE
    })
  })
}
