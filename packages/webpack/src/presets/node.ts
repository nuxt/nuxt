import type { WebpackConfigContext } from '../utils/config'

export function node (ctx: WebpackConfigContext) {
  const { config } = ctx

  config.target = 'node'
  config.node = false

  config.experiments.outputModule = true

  config.output = {
    ...config.output,
    chunkFilename: '[name].mjs',
    chunkFormat: 'module',
    chunkLoading: 'import',
    module: true,
    environment: {
      module: true,
      arrowFunction: true,
      bigIntLiteral: true,
      const: true,
      destructuring: true,
      dynamicImport: true,
      forOf: true
    },
    library: {
      type: 'module'
    }
  }

  config.performance = {
    ...config.performance,
    hints: false,
    maxEntrypointSize: Infinity,
    maxAssetSize: Infinity
  }
}
