import { extendPreset } from '../utils'
import { SigmaPreset } from '../context'
import { node } from './node'

export const local: SigmaPreset = extendPreset(node, {
  entry: '{{ _internal.runtimeDir }}/entries/local',
  output: {
    serverDir: '{{ output.dir }}/.local'
  },
  minify: false,
  externals: true,
  inlineChunks: true,
  timing: false,
  sourceMap: true
})
