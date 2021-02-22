import { extendPreset } from '../utils'
import { NitroPreset } from '../context'
import { node } from './node'

export const dev: NitroPreset = extendPreset(node, {
  entry: '{{ _internal.runtimeDir }}/entries/dev',
  output: {
    serverDir: '{{ _nuxt.buildDir }}/nitro'
  },
  minify: false,
  externals: { trace: false },
  inlineChunks: true,
  timing: false,
  sourceMap: true
})
