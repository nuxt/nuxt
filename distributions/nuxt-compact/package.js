
import { resolve } from 'path'

const internalPackages = [
  'builder',
  'cli',
  'config',
  'core',
  'generator',
  'server',
  'utils',
  'vue-app',
  'vue-renderer',
  'webpack'
]

const alias = {}
const dependencies = {}
for (const name of internalPackages) {
  alias['@nuxt/' + name] = resolve(__dirname, `../../packages/${name}/src/index.js`)
  const pkg = require(resolve(__dirname, `../../packages/${name}/package.json`))
  Object.assign(dependencies, pkg.dependencies || {})
}
for (const name in alias) {
  delete dependencies[name]
}

export default {
  build: true,
  hooks: {
    async 'build:extend' (pkg, { config }) {
      Object.assign(pkg.pkg.dependencies, dependencies)
      await pkg.writePackage()
      config.externals = (config.externals || []).concat(...Object.keys(dependencies), 'jsdom', 'lodash')
      // console.log(config)
    },
    'build:extendRollup' (pkg, { rollupConfig }) {
      rollupConfig.inlineDynamicImports = true
      rollupConfig.plugins.unshift({
        resolveId (id) {
          if (alias[id]) {
            return alias[id]
          }
          return null
        }
      })
    },
    async 'build:done' (pkg) {
      const mono = pkg.load('../..')
      await pkg.copyFilesFrom(mono, ['LICENSE'])

      const vueApp = pkg.load('../../packages/vue-app')
      await pkg.copyFilesFrom(vueApp, ['template'])

      const babelPresetApp = pkg.load('../../packages/babel-preset-app')
      await pkg.copyFilesFrom(babelPresetApp, ['src'], 'dist/babel-preset-app/')
    }
  }
}
