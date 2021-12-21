import { extendPreset } from '../utils'
import { NitroPreset } from '../context'
import { node } from './node'

export const server: NitroPreset = extendPreset(node, {
  entry: '{{ _internal.runtimeDir }}/entries/server',
  serveStatic: true,
  commands: {
    preview: 'node {{ output.serverDir }}/index.mjs'
  }
})
