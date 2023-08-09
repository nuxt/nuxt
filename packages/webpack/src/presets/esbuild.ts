import { EsbuildPlugin } from 'esbuild-loader'
import type { WebpackConfigContext } from '../utils/config'

export function esbuild (ctx: WebpackConfigContext) {
  // https://esbuild.github.io/getting-started/#bundling-for-the-browser
  // https://gs.statcounter.com/browser-version-market-share
  // https://nodejs.org/en/
  const target = ctx.isServer ? 'es2020' : 'chrome85'

  // https://github.com/nuxt/nuxt/issues/13052
  ctx.config.optimization!.minimizer!.push(new EsbuildPlugin())

  ctx.config.module!.rules!.push(
    {
      test: /\.m?[jt]s$/i,
      loader: 'esbuild-loader',
      exclude: (file) => {
        // Not exclude files outside node_modules
        file = file.split('node_modules', 2)[1]
        if (!file) { return false }

        return !ctx.transpile.some(module => module.test(file))
      },
      resolve: {
        fullySpecified: false
      },
      options: {
        target,
        ...ctx.nuxt.options.webpack.loaders.esbuild,
        loader: 'ts'
      }
    },
    {
      test: /\.m?[jt]sx$/,
      loader: 'esbuild-loader',
      options: {
        target,
        ...ctx.nuxt.options.webpack.loaders.esbuild,
        loader: 'tsx'
      }
    }
  )
}
