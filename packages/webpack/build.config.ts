import { copyFile } from 'node:fs/promises'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index'
  ],
  dependencies: [
    '@nuxt/kit',
    'unplugin',
    'webpack-virtual-modules',
    'postcss',
    'postcss-loader',
    'vue-loader',
    'css-loader',
    'file-loader',
    'style-resources-loader',
    'url-loader',
    'vue'
  ],
  externals: [
    '@nuxt/schema',
    'h3'
  ],
  hooks: {
    // TODO: move to workspace root when https://github.com/unjs/unbuild/issues/195
    async 'build:done' () {
      for (const file of ['LICENSE', 'README.md']) {
        await copyFile(`../../${file}`, `./${file}`)
      }
    }
  }
})
