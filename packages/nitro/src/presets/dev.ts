import { extendPreset } from '../utils'
import { SigmaPreset } from '../context'
import { node } from './node'

export const dev: SigmaPreset = extendPreset(node, {
  entry: '{{ _internal.runtimeDir }}/entries/dev',
  minify: false,
  externals: true,
  inlineChunks: true,
  timing: true
})
