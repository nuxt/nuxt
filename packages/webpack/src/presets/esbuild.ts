import esbuildLoader from 'esbuild-loader'
import { WebpackConfigContext } from '../utils/config'

export function esbuild (ctx: WebpackConfigContext) {
  const { config } = ctx

  // https://esbuild.github.io/getting-started/#bundling-for-the-browser
  // https://gs.statcounter.com/browser-version-market-share
  // https://nodejs.org/en/
  const target = ctx.isServer ? 'es2019' : 'chrome85'

  // https://github.com/nuxt/framework/issues/2372
  config.optimization.minimizer.push(new (esbuildLoader as unknown as typeof import('esbuild-loader')).ESBuildMinifyPlugin())

  config.module.rules.push(
    {
      test: /\.m?[jt]s$/i,
      loader: 'esbuild-loader',
      exclude: (file) => {
        file = file.split('node_modules', 2)[1]

        // Not exclude files outside node_modules
        if (!file) {
          return false
        }

        // Item in transpile can be string or regex object
        return !ctx.transpile.some(module => module.test(file))
      },
      resolve: {
        fullySpecified: false
      },
      options: {
        loader: 'ts',
        target
      }
    },
    {
      test: /\.m?[jt]sx$/,
      loader: 'esbuild-loader',
      options: {
        loader: 'tsx',
        target
      }
    }
  )
}
