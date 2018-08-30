import json from 'rollup-plugin-json'
import commonjs from 'rollup-plugin-commonjs'
import license from 'rollup-plugin-license'
import defaultsDeep from 'lodash/defaultsDeep'

export default function rollupFactory({ pkg, input, plugins = [], options }) {
  return defaultsDeep({}, options, {
    input,
    output: {
      file: `dist/${pkg.name}.js`,
      format: 'cjs',
      sourcemap: true
    },
    external: [
      // Dependencies that will be installed alongise with the nuxt package
      ...Object.keys(pkg.dependencies),

      // Builtin node modules
      'path',
      'fs',
      'module',
      'crypto',
      'util',

      // Dependencies of nuxt-legacy
      '@babel/polyfill'
    ],
    plugins: [
      commonjs(),
      json(),
      license({
        banner: [
          `/*!`,
          ` * ${pkg.name} v${pkg.version} (c) 2016-${new Date().getFullYear()}`,
          `${pkg.contributors.map(c => ` * - ${c.name}`).join('\n')}`,
          ` * - All the amazing contributors`,
          ` * Released under the MIT License.`,
          ` * Website: https://nuxtjs.org`,
          `*/`
        ].join('\n')
      })
    ].concat(plugins)
  })
}
