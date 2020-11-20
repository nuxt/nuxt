import { SigmaPreset } from '../context'

export const node: SigmaPreset = {
  entry: '{{ _internal.runtimeDir }}/entries/node',
  inlineChunks: false
}
