import { extendTarget } from '../utils'
import { SLSTarget } from '../config'
import { lambda } from './lambda'

export const netlify: SLSTarget = extendTarget(lambda, {
  outName: '_nuxt.js',
  generateIgnore: [
    'netlify.toml',
    '_redirects'
  ]
})
