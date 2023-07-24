import { resolve } from 'pathe'
import VueLoaderPlugin from 'vue-loader/dist/pluginWebpack5.js'
import webpack from 'webpack'
import VueSSRClientPlugin from '../plugins/vue/client'
import VueSSRServerPlugin from '../plugins/vue/server'
import type { WebpackConfigContext } from '../utils/config'

export function vue (ctx: WebpackConfigContext) {
  // @ts-expect-error de-default vue-loader
  ctx.config.plugins!.push(new (VueLoaderPlugin.default || VueLoaderPlugin)())

  ctx.config.module!.rules!.push({
    test: /\.vue$/i,
    loader: 'vue-loader',
    options: {
      reactivityTransform: ctx.nuxt.options.experimental.reactivityTransform,
      ...ctx.userConfig.loaders.vue
    }
  })

  if (ctx.isClient) {
    ctx.config.plugins!.push(new VueSSRClientPlugin({
      filename: resolve(ctx.options.buildDir, 'dist/server', `${ctx.name}.manifest.json`),
      nuxt: ctx.nuxt
    }))
  } else {
    ctx.config.plugins!.push(new VueSSRServerPlugin({
      filename: `${ctx.name}.manifest.json`
    }))
  }

  // Feature flags
  // https://github.com/vuejs/vue-next/tree/master/packages/vue#bundler-build-feature-flags
  // TODO: Provide options to toggle
  ctx.config.plugins!.push(new webpack.DefinePlugin({
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false'
  }))
}
