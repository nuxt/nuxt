import path from 'path'
import { readJSONSync } from 'fs-extra'
import jsonPlugin from '@rollup/plugin-json'
import commonjsPlugin from '@rollup/plugin-commonjs'
import replacePlugin from '@rollup/plugin-replace'
import aliasPlugin from '@rollup/plugin-alias'
// import nodeResolvePlugin from '@rollup/plugin-node-resolve'
import licensePlugin from 'rollup-plugin-license'
import esbuild from 'rollup-plugin-esbuild'
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
      generatedCode: {
        constBindings: true
      }
    },
    external: externals,
    plugins: [
      aliasPlugin(alias),
      replacePlugin({
        exclude: 'node_modules/**',
        delimiters: ['', ''],
        preventAssignment: true,
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
      esbuild({ target: 'es2019' }),
      commonjsPlugin({ include: /node_modules/ }),
      jsonPlugin(),
      licensePlugin({
        banner: [
          '/*!',
          ` * ${pkg.name} v${pkg.version} (c) 2016-${new Date().getFullYear()}`,
          ' * Released under the MIT License',
          ' * Repository: https://github.com/nuxt/nuxt.js',
          ' * Website: https://nuxtjs.org',
          '*/'
        ].join('\n')
      })
    ].concat(plugins)
  })
}
