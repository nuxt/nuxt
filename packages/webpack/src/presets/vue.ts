import VueLoaderPlugin from 'vue-loader/dist/pluginWebpack5.js'
import { resolveModulePath } from 'exsolve'
import VueSSRClientPlugin from '../plugins/vue/client.ts'
import VueSSRServerPlugin from '../plugins/vue/server.ts'
import type { WebpackConfigContext } from '../utils/config.ts'

import { webpack } from '#builder'

export function vue (ctx: WebpackConfigContext) {
  // @ts-expect-error de-default vue-loader
  ctx.config.plugins!.push(new (VueLoaderPlugin.default || VueLoaderPlugin)())

  ctx.config.module!.rules!.push({
    test: /\.vue$/i,
    loader: 'vue-loader',
    options: { ...ctx.userConfig.loaders.vue, isServerBuild: ctx.isServer },
  })

  if (ctx.isClient) {
    ctx.config.plugins!.push(new VueSSRClientPlugin({ nuxt: ctx.nuxt }))
  } else {
    ctx.config.plugins!.push(new VueSSRServerPlugin({
      filename: `${ctx.name}.manifest.json`,
    }))

    const loaderPath = resolveModulePath('#vue-module-identifier', { from: import.meta.url })
    ctx.config.module!.rules!.push({
      test: /\.vue$/i,
      enforce: 'post',
      use: [{
        loader: loaderPath,
        options: { srcDir: ctx.nuxt.options.srcDir },
      }],
    })
  }

  // Feature flags
  // https://github.com/vuejs/vue-next/tree/master/packages/vue#bundler-build-feature-flags
  // TODO: Provide options to toggle
  ctx.config.plugins!.push(new webpack.DefinePlugin({
    '__VUE_OPTIONS_API__': 'true',
    '__VUE_PROD_DEVTOOLS__': 'false',
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': ctx.nuxt.options.debug && ctx.nuxt.options.debug.hydration,
  }))
}
