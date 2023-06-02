import type { RspackConfigContext } from '../utils/config'

export function pug (ctx: RspackConfigContext) {
  // ctx.config.module!.rules!.push({
  //   test: /\.pug$/i,
  //   oneOf: [
  //     {
  //       resourceQuery: /^\?vue/i,
  //       use: [{
  //         loader: 'pug-plain-loader',
  //         options: ctx.options.webpack.loaders.pugPlain
  //       }]
  //     },
  //     {
  //       use: [
  //         'raw-loader',
  //         {
  //           loader: 'pug-plain-loader',
  //           options: ctx.options.webpack.loaders.pugPlain
  //         }
  //       ]
  //     }
  //   ]
  // })
}
