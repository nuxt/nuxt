import { WebpackConfigContext } from '../utils/config'

export function node (ctx: WebpackConfigContext) {
  const { config } = ctx

  config.target = 'node'
  config.node = false

  config.resolve.mainFields = ['main', 'module']

  config.output = {
    ...config.output,
    chunkFilename: '[name].cjs',
    library: {
      type: 'commonjs2'
    }
  }

  config.performance = {
    ...config.performance,
    hints: false,
    maxEntrypointSize: Infinity,
    maxAssetSize: Infinity
  }
}
