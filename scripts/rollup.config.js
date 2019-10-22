import path from 'path'
import { readJSONSync } from 'fs-extra'
import jsonPlugin from 'rollup-plugin-json'
import commonjsPlugin from 'rollup-plugin-commonjs'
import licensePlugin from 'rollup-plugin-license'
import replacePlugin from 'rollup-plugin-replace'
import aliasPlugin from 'rollup-plugin-alias'
import nodeResolvePlugin from 'rollup-plugin-node-resolve'
import defaultsDeep from 'lodash/defaultsDeep'
import consola from 'consola'

import { builtins } from './builtins'

export default function rollupConfig ({
  rootDir = process.cwd(),
  plugins = [],
  input = 'src/index.js',
  replace = {},
  alias = {},
  resolve = {
    only: [
      /lodash/
    ]
  },
  ...options
}, pkg) {
  if (!pkg) {
    pkg = readJSONSync(path.resolve(rootDir, 'package.json'))
  }

  const name = path.basename(pkg.name.replace('-edge', ''))

  return defaultsDeep({}, options, {
    input: path.resolve(rootDir, input),
    output: {
      dir: path.resolve(rootDir, 'dist'),
      entryFileNames: `${name}.js`,
      chunkFileNames: `${name}-[name].js`,
      format: 'cjs',
      preferConst: true
    },
    external: [
      // Dependencies that will be installed alongise with the nuxt package
      ...Object.keys(pkg.dependencies || {}),
      // Builtin node modules
      ...builtins
    ],
    plugins: [
      aliasPlugin(alias),
      replacePlugin({
        exclude: 'node_modules/**',
        delimiters: ['', ''],
        values: {
          __NODE_ENV__: process.env.NODE_ENV,
          ...replace
        }
      }),
      nodeResolvePlugin(resolve),
      commonjsPlugin(),
      jsonPlugin(),
      licensePlugin({
        banner: [
          `/*!`,
          ` * ${pkg.name} v${pkg.version} (c) 2016-${new Date().getFullYear()}`,
          `${(pkg.contributors || []).map(c => ` * - ${c.name}`).join('\n')}`,
          ` * - All the amazing contributors`,
          ` * Released under the MIT License.`,
          ` * Website: https://nuxtjs.org`,
          `*/`
        ].join('\n')
      })
    ].concat(plugins),
    onwarn (warning, warn) {
      if (warning.plugin === 'rollup-plugin-license') {
        return
      }
      consola.warn(warning)
    }
  })
}
