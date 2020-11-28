import consola from 'consola'
import { extendPreset, hl, prettyPath } from '../utils'
import { SigmaPreset, SigmaContext } from '../context'
import { node } from './node'

export const server: SigmaPreset = extendPreset(node, {
  entry: '{{ _internal.runtimeDir }}/entries/server',
  externals: false,
  inlineChunks: false,
  serveStatic: true,
  minify: false,
  hooks: {
    'sigma:compiled' ({ output }: SigmaContext) {
      consola.success('Ready to run', hl('node ' + prettyPath(output.serverDir)))
    }
  }
})
