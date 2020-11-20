import consola from 'consola'
import { extendPreset, prettyPath } from '../utils'
import { SigmaPreset, SigmaContext } from '../context'
import { node } from './node'

export const cli: SigmaPreset = extendPreset(node, {
  entry: '{{ _internal.runtimeDir }}/entries/cli',
  externals: true,
  inlineChunks: true,
  hooks: {
    'sigma:compiled' ({ output }: SigmaContext) {
      consola.info('Run with `node ' + prettyPath(output.serverDir) + ' [route]`')
    }
  }
})
