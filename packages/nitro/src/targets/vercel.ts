import { extendTarget } from '../utils'
import { SLSTarget } from '../config'
import { node } from './node'

export const vercel: SLSTarget = extendTarget(node, {
  targetDir: '{{ rootDir }}/.vercel_build_output/functions/node/api/_nuxt',
  outName: 'index.js',
  inlineChunks: false,
  generateIgnore: [
    'vercel.json'
  ]
})
