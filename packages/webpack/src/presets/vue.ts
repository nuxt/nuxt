import { resolve } from 'pathe'
import VueLoaderPlugin from 'vue-loader/dist/pluginWebpack5'
import { DefinePlugin } from 'webpack'
import NuxtSetupTransformerPlugin from '../plugins/transform-setup'
import VueSSRClientPlugin from '../plugins/vue/client'
import VueSSRServerPlugin from '../plugins/vue/server'
import { WebpackConfigContext } from '../utils/config'

export function vue (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  config.plugins.push(new VueLoaderPlugin())

  config.module.rules.push({
    test: /\.vue$/i,
    loader: 'vue-loader',
    options: {
      // workaround for https://github.com/vuejs/vue-next/issues/4666
      compilerOptions: {
        ssrRuntimeModuleName: 'vue/server-renderer/index.mjs'
      },
      ...options.build.loaders.vue
    }
  })

  if (ctx.isClient) {
    config.plugins.push(new VueSSRClientPlugin({
      filename: resolve(options.buildDir, 'dist/server', `${ctx.name}.manifest.json`)
    }))
  } else {
    config.plugins.push(new VueSSRServerPlugin({
      filename: `${ctx.name}.manifest.json`
    }))
  }

  config.plugins.push(new NuxtSetupTransformerPlugin())

  // Feature flags
  // https://github.com/vuejs/vue-next/tree/master/packages/vue#bundler-build-feature-flags
  // TODO: Provide options to toggle
  config.plugins.push(new DefinePlugin({
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false'
  }))
}
