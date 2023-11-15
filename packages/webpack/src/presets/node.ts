import type { WebpackConfigContext } from '../utils/config'

export function node (ctx: WebpackConfigContext) {
  ctx.config.target = 'node'
  ctx.config.node = false

  ctx.config.experiments!.outputModule = true

  ctx.config.output = {
    ...ctx.config.output,
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

  ctx.config.performance = {
    ...ctx.config.performance,
    hints: false,
    maxEntrypointSize: Infinity,
    maxAssetSize: Infinity
  }
}
