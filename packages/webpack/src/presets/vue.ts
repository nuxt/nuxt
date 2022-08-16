import { resolve } from 'pathe'
import VueLoaderPlugin from 'vue-loader/dist/pluginWebpack5.js'
import webpack from 'webpack'
import VueSSRClientPlugin from '../plugins/vue/client'
import VueSSRServerPlugin from '../plugins/vue/server'
import { WebpackConfigContext } from '../utils/config'

export function vue (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  // @ts-ignore
  config.plugins.push(new (VueLoaderPlugin.default || VueLoaderPlugin)())

  config.module.rules.push({
    test: /\.vue$/i,
    loader: 'vue-loader',
    options: {
      reactivityTransform: ctx.nuxt.options.experimental.reactivityTransform,
      ...options.webpack.loaders.vue
    }
  })

  if (ctx.isClient) {
    config.plugins.push(new VueSSRClientPlugin({
      filename: resolve(options.buildDir, 'dist/server', `${ctx.name}.manifest.json`),
      nuxt: ctx.nuxt
    }))
  } else {
    config.plugins.push(new VueSSRServerPlugin({
      filename: `${ctx.name}.manifest.json`
    }))
  }

  // Feature flags
  // https://github.com/vuejs/vue-next/tree/master/packages/vue#bundler-build-feature-flags
  // TODO: Provide options to toggle
  config.plugins.push(new webpack.DefinePlugin({
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false'
  }))
}
