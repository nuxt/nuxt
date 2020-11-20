import { SigmaPreset, SigmaContext } from '../context'

export const worker: SigmaPreset = {
  entry: null, // Abstract
  node: false,
  hooks: {
    'sigma:rollup:before' ({ rollupConfig }: SigmaContext) {
      rollupConfig.output.format = 'iife'
    }
  }
}
