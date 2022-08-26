import { fileName, WebpackConfigContext } from '../utils/config'

export function assets (ctx: WebpackConfigContext) {
  ctx.config.module!.rules!.push(
    {
      test: /\.(png|jpe?g|gif|svg|webp)$/i,
      use: [{
        loader: 'url-loader',
        options: {
          ...ctx.options.webpack.loaders.imgUrl,
          name: fileName(ctx, 'img')
        }
      }]
    },
    {
      test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/i,
      use: [{
        loader: 'url-loader',
        options: {
          ...ctx.options.webpack.loaders.fontUrl,
          name: fileName(ctx, 'font')
        }
      }]
    },
    {
      test: /\.(webm|mp4|ogv)$/i,
      use: [{
        loader: 'file-loader',
        options: {
          ...ctx.options.webpack.loaders.file,
          name: fileName(ctx, 'video')
        }
      }]
    }
  )
}
