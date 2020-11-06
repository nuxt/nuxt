import { extendTarget } from '../utils'
import { SLSTarget } from '../config'
import { lambda } from './lambda'

export const netlify: SLSTarget = extendTarget(lambda, {
  generateIgnore: [
    'netlify.toml',
    '_redirects'
  ]
})
