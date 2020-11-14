import { SLSTarget } from '../config'

export const node: SLSTarget = {
  entry: '{{ runtimeDir }}/targets/node',
  outName: 'index.js',
  inlineChunks: false
}
