import type { WebpackConfigContext } from '../utils/config'

export function pug (ctx: WebpackConfigContext) {
  ctx.config.module!.rules!.push({
    test: /\.pug$/i,
    oneOf: [
      {
        resourceQuery: /^\?vue/i,
        use: [{
          loader: 'pug-plain-loader',
          options: ctx.userConfig.loaders.pugPlain
        }]
      },
      {
        use: [
          'raw-loader',
          {
            loader: 'pug-plain-loader',
            options: ctx.userConfig.loaders.pugPlain
          }
        ]
      }
    ]
  })
}
