import { NitroPreset, NitroContext } from '../context'

export const worker: NitroPreset = {
  entry: null, // Abstract
  node: false,
  hooks: {
    'nitro:rollup:before' ({ rollupConfig }: NitroContext) {
      rollupConfig.output.format = 'iife'
    }
  }
}
