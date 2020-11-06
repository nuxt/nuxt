import { extendTarget } from '../utils'
import { SLSTarget } from '../config'
import { node } from './node'

export const vercel: SLSTarget = extendTarget(node, {
  targetDir: '{{ rootDir }}/api',
  generateIgnore: [
    'vercel.json'
  ]
})
