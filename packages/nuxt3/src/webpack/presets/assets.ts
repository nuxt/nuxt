import { fileName, WebpackConfigContext } from '../utils/config'

export function assets (ctx: WebpackConfigContext) {
  const { options } = ctx

  ctx.config.module.rules.push(
    {
      test: /\.(png|jpe?g|gif|svg|webp)$/i,
      use: [{
        loader: 'url-loader',
        options: {
          ...options.build.loaders.imgUrl,
          name: fileName(ctx, 'img')
        }
      }]
    },
    {
      test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/i,
      use: [{
        loader: 'url-loader',
        options: {
          ...options.build.loaders.fontUrl,
          name: fileName(ctx, 'font')
        }
      }]
    },
    {
      test: /\.(webm|mp4|ogv)$/i,
      use: [{
        loader: 'file-loader',
        options: {
          ...options.build.loaders.file,
          name: fileName(ctx, 'video')
        }
      }]
    }
  )
}
