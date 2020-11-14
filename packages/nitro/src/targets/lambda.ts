
import { SLSTarget } from '../config'

export const lambda: SLSTarget = {
  entry: '{{ runtimeDir }}/targets/lambda',
  outName: '_nuxt.js',
  inlineChunks: false
}
