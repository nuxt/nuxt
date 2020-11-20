
import { SigmaPreset } from '../context'

export const lambda: SigmaPreset = {
  entry: '{{ _internal.runtimeDir }}/entries/lambda',
  inlineChunks: false
}
