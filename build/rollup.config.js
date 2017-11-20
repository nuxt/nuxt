// Some parts brought from https://github.com/vuejs/vue/blob/dev/build/config.js
const { resolve } = require('path')
const rollupBabel = require('rollup-plugin-babel')
const rollupAlias = require('rollup-plugin-alias')
const rollupCommonJS = require('rollup-plugin-commonjs')
const rollupReplace = require('rollup-plugin-replace')
const rollupNodeResolve = require('rollup-plugin-node-resolve')
const packageJson = require('../package.json')

const dependencies = Object.keys(packageJson.dependencies)
const version = packageJson.version || process.env.VERSION

// -----------------------------
// Banner
// -----------------------------
const banner =
  '/*!\n' +
  ' * Nuxt.js v' + version + '\n' +
  ' * Released under the MIT License.\n' +
  ' */'

// -----------------------------
// Aliases
// -----------------------------
const rootDir = resolve(__dirname, '..')
const libDir = resolve(rootDir, 'lib')
const distDir = resolve(rootDir, 'dist')

const aliases = {
  core: resolve(libDir, 'core/index.js'),
  builder: resolve(libDir, 'builder/index.js'),
  common: resolve(libDir, 'common/index.js'),
  utils: resolve(libDir, 'common/utils.js'),
  app: resolve(libDir, 'app')
}

// -----------------------------
// Builds
// -----------------------------
const builds = {
  nuxt: {
    entry: resolve(libDir, 'index.js'),
    file: resolve(distDir, 'nuxt.js')
  },
  core: {
    entry: resolve(libDir, 'core/index.js'),
    file: resolve(distDir, 'core.js')
  }
}

// -----------------------------
// Default config
// -----------------------------
function genConfig (opts) {
  const config = {
    input: opts.entry,
    output: {
      file: opts.file,
      format: 'cjs',
      sourcemap: true
    },
    external: ['fs', 'path', 'http', 'module', 'vue-server-renderer/server-plugin', 'vue-server-renderer/client-plugin']
      .concat(dependencies, opts.external),
    banner: opts.banner || banner,
    name: opts.modulename || 'Nuxt',
    plugins: [
      rollupAlias(Object.assign({
        resolve: ['.js', '.json', '.jsx', '.ts']
      }, aliases, opts.alias)),

      rollupNodeResolve({ preferBuiltins: true }),

      rollupCommonJS(),

      rollupBabel(Object.assign({
        exclude: 'node_modules/**',
        plugins: [
          ['transform-runtime', { 'helpers': false, 'polyfill': false }],
          'transform-async-to-generator',
          'array-includes',
          'external-helpers'
        ],
        presets: [
          ['env', {
            targets: {
              node: '6.11.0'
            },
            modules: false
          }]
        ],
        'env': {
          'test': {
            'plugins': [ 'istanbul' ]
          }
        }
      }, opts.babel)),

      rollupReplace({ __VERSION__: version })
    ].concat(opts.plugins || [])
  }

  if (opts.env) {
    config.plugins.push(rollupReplace({
      'process.env.NODE_ENV': JSON.stringify(opts.env)
    }))
  }

  return config
}

if (process.env.TARGET) {
  module.exports = genConfig(builds[process.env.TARGET])
} else {
  exports.getBuild = name => genConfig(builds[name])
  exports.getAllBuilds = () => Object.keys(builds).map(name => genConfig(builds[name]))
}
