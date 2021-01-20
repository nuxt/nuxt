import { extendPreset } from '../utils'
import { SigmaPreset } from '../context'
import { node } from './node'

export const local: SigmaPreset = extendPreset(node, {
  entry: '{{ _internal.runtimeDir }}/entries/local',
  output: {
    serverDir: '{{ _nuxt.buildDir }}/sigma'
  },
  minify: false,
  externals: {
    trace: false
  },
  inlineChunks: true,
  timing: false,
  sourceMap: true
})
