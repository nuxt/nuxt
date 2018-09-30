import path from 'path'
import { readJSONSync } from 'fs-extra'
import json from 'rollup-plugin-json'
import commonjs from 'rollup-plugin-commonjs'
import license from 'rollup-plugin-license'
import defaultsDeep from 'lodash/defaultsDeep'
import builtins from './builtins'

export default function rollupConfigFactory({
  rootDir = process.cwd(),
  plugins = [],
  input = 'src/index.js',
  ...options
}) {
  const pkg = readJSONSync(path.resolve(rootDir, 'package.json'))

  return defaultsDeep({}, options, {
    input: path.resolve(rootDir, input),
    output: {
      file: path.resolve(rootDir, 'dist', `${pkg.name.replace('-edge', '')}.js`),
      format: 'cjs',
      sourcemap: true
    },
    external: [
      // Dependencies that will be installed alongside the nuxt package
      ...Object.keys(pkg.dependencies || {}),
      // Builtin node modules
      ...builtins,
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
