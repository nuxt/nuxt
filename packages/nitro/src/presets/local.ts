import { extendPreset } from '../utils'
import { SigmaPreset } from '../context'
import { node } from './node'

export const local: SigmaPreset = extendPreset(node, {
  entry: '{{ _internal.runtimeDir }}/entries/local',
  // @ts-ignore
  output: {
    dir: '{{ _nuxt.rootDir }}/node_modules/.cache/sigma'
  },
  minify: false,
  externals: true,
  inlineChunks: true,
  timing: true
})
