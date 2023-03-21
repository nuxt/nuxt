import type { RspackConfigContext } from '../utils/config'

export function assets (ctx: RspackConfigContext) {
  ctx.config.module!.rules!.push(
    {
      test: /\.(png|jpe?g|gif|svg|webp)$/i,
      type: 'asset/resource'
    },
    {
      test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/i,
      type: 'asset/resource'
    },
    {
      test: /\.(webm|mp4|ogv)$/i,
      type: 'asset/resource'
    }
  )
}
