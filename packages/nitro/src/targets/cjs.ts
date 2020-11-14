import { extendTarget } from '../utils'
import { SLSTarget } from '../config'
import { node } from './node'

export const cjs: SLSTarget = extendTarget(node, {
  entry: '{{ runtimeDir }}/targets/cjs',
  minify: false,
  externals: true,
  inlineChunks: true
})
