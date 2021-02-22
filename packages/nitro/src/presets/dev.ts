import { extendPreset } from '../utils'
import { NitroPreset } from '../context'
import { node } from './node'

export const dev: NitroPreset = extendPreset(node, {
  entry: '{{ _internal.runtimeDir }}/entries/dev',
  output: {
    serverDir: '{{ _nuxt.buildDir }}/nitro'
  },
  externals: { trace: false },
  inlineDynamicImports: true, // externals plugin limitation
  sourceMap: true
})
