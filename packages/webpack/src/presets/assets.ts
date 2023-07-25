import { tryResolveModule } from '@nuxt/kit'
import type { WebpackConfigContext } from '../utils/config'
import { fileName } from '../utils/config'

export async function assets (ctx: WebpackConfigContext) {
  ctx.config.module!.rules!.push(
    {
      test: /\.(png|jpe?g|gif|svg|webp)$/i,
      use: [{
        loader: await tryResolveModule('url-loader', import.meta.url) ?? 'url-loader',
        options: {
          ...ctx.userConfig.loaders.imgUrl,
          name: fileName(ctx, 'img')
        }
      }]
    },
    {
      test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/i,
      use: [{
        loader: await tryResolveModule('url-loader', import.meta.url) ?? 'url-loader',
        options: {
          ...ctx.userConfig.loaders.fontUrl,
          name: fileName(ctx, 'font')
        }
      }]
    },
    {
      test: /\.(webm|mp4|ogv)$/i,
      use: [{
        loader: await tryResolveModule('file-loader', import.meta.url) ?? 'file-loader',
        options: {
          ...ctx.userConfig.loaders.file,
          name: fileName(ctx, 'video')
        }
      }]
    }
  )
}
