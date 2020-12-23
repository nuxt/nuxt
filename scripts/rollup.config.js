import path from 'path'
import { readJSONSync } from 'fs-extra'
import jsonPlugin from '@rollup/plugin-json'
import commonjsPlugin from '@rollup/plugin-commonjs'
import replacePlugin from '@rollup/plugin-replace'
import aliasPlugin from '@rollup/plugin-alias'
// import nodeResolvePlugin from '@rollup/plugin-node-resolve'
import licensePlugin from 'rollup-plugin-license'
import { defaultsDeep } from 'lodash'

export default function rollupConfig ({
  rootDir = process.cwd(),
  plugins = [],
  input = 'src/index.js',
  replace = {},
  alias = {},
  externals = [],
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
    external: externals,
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
      // nodeResolvePlugin({
      //   preferBuiltins: true,
      //   resolveOnly: [
      //     /lodash/
      //   ]
      // }),
      commonjsPlugin({ include: /node_modules/ }),
      jsonPlugin(),
      licensePlugin({
        banner: [
          '/*!',
          ` * ${pkg.name} v${pkg.version} (c) 2016-${new Date().getFullYear()}`,
          `${(pkg.contributors || []).map(c => ` * - ${c.name}`).join('\n')}`,
          ' * - All the amazing contributors',
          ' * Released under the MIT License.',
          ' * Website: https://nuxtjs.org',
          '*/'
        ].join('\n')
      })
    ].concat(plugins)
  })
}
