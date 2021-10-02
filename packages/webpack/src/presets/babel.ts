import { createRequire } from 'module'
import { normalize } from 'pathe'
import TerserWebpackPlugin from 'terser-webpack-plugin'
import { reservedVueTags } from '../utils/reserved-tags'
import { WebpackConfigContext } from '../utils/config'

const _require = createRequire(import.meta.url)

export function babel (ctx: WebpackConfigContext) {
  const { config, options } = ctx

  const babelLoader = {
    loader: normalize(_require.resolve('babel-loader')),
    options: getBabelOptions(ctx)
  }

  config.module.rules.push({
    test: /\.m?[jt]sx?$/i,
    exclude: (file) => {
      file = file.split('node_modules', 2)[1]
      // not exclude files outside node_modules
      if (!file) {
        return false
      }
      // item in transpile can be string or regex object
      return !ctx.transpile.some(module => module.test(file))
    },
    resolve: {
      fullySpecified: false
    },
    use: babelLoader
  })

  // https://github.com/webpack-contrib/terser-webpack-plugin
  if (options.build.terser) {
    const terser = new TerserWebpackPlugin({
      // cache, TODO
      extractComments: {
        condition: 'some',
        filename: 'LICENSES'
      },
      terserOptions: {
        compress: {
          ecma: ctx.isModern ? 6 : undefined
        },
        mangle: {
          reserved: reservedVueTags
        }
      },
      ...options.build.terser as any
    })

    config.plugins.push(terser as any)
  }
}

function getBabelOptions (ctx: WebpackConfigContext) {
  const { options } = ctx

  const babelOptions: any = {
    ...options.build.babel,
    envName: ctx.name
  }

  if (babelOptions.configFile || babelOptions.babelrc) {
    return babelOptions
  }

  if (typeof babelOptions.plugins === 'function') {
    babelOptions.plugins = babelOptions.plugins(ctx)
  }

  const defaultPreset = [normalize(_require.resolve('../../babel-preset-app')), {}]

  if (typeof babelOptions.presets === 'function') {
    babelOptions.presets = babelOptions.presets(ctx, defaultPreset)
  }

  if (!babelOptions.presets) {
    babelOptions.presets = [defaultPreset]
  }

  return babelOptions
}
