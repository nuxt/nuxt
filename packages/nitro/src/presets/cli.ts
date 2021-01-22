import consola from 'consola'
import { extendPreset, prettyPath } from '../utils'
import { NitroPreset, NitroContext } from '../context'
import { node } from './node'

export const cli: NitroPreset = extendPreset(node, {
  entry: '{{ _internal.runtimeDir }}/entries/cli',
  externals: true,
  inlineChunks: true,
  hooks: {
    'nitro:compiled' ({ output }: NitroContext) {
      consola.info('Run with `node ' + prettyPath(output.serverDir) + ' [route]`')
    }
  }
})
