import { extendPreset } from '../utils'
import { SigmaPreset } from '../context'
import { node } from './node'

export const dev: SigmaPreset = extendPreset(node, {
  entry: '{{ _internal.runtimeDir }}/entries/dev',
  // @ts-ignore
  output: {
    dir: '{{ _nuxt.rootDir }}/node_modules/.cache/sigma',
    publicDir: false,
    clean: false
  },
  minify: false,
  externals: true,
  inlineChunks: true,
  timing: true
})
