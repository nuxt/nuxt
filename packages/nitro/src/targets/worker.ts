import { SLSTarget } from '../config'

export const worker: SLSTarget = {
  entry: null, // Abstract
  node: false,
  minify: true,
  hooks: {
    'rollup:before' ({ rollupConfig }) {
      rollupConfig.output.format = 'iife'
    }
  }
}
