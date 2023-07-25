import { tryResolveModule } from '@nuxt/kit'
import type { WebpackConfigContext } from '../utils/config'

export async function pug (ctx: WebpackConfigContext) {
  ctx.config.module!.rules!.push({
    test: /\.pug$/i,
    oneOf: [
      {
        resourceQuery: /^\?vue/i,
        use: [{
          loader: await tryResolveModule('pug-plain-loader', import.meta.url) ?? 'pug-plain-loader',
          options: ctx.userConfig.loaders.pugPlain
        }]
      },
      {
        use: [
          'raw-loader',
          {
            loader: await tryResolveModule('pug-plain-loader', import.meta.url) ?? 'pug-plain-loader',
            options: ctx.userConfig.loaders.pugPlain
          }
        ]
      }
    ]
  })
}
