import VueLoaderPlugin from 'vue-loader/dist/pluginWebpack5'
import VueSSRClientPlugin from '../plugins/vue/client'
import VueSSRServerPlugin from '../plugins/vue/server'
import { WebpackConfigContext } from '../utils/config'

export function vue (ctx: WebpackConfigContext) {
  const { options, config } = ctx

  config.plugins.push(new VueLoaderPlugin())

  config.module.rules.push({
    test: /\.vue$/i,
    loader: 'vue-loader',
    options: options.build.loaders.vue
  })

  if (ctx.isClient) {
    config.plugins.push(new VueSSRClientPlugin({
      filename: `../server/${ctx.name}.manifest.json`
    }))
  } else {
    config.plugins.push(new VueSSRServerPlugin({
      filename: `${ctx.name}.manifest.json`
    }))
  }
}
