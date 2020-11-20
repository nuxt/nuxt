import { extendPreset } from '../utils'
import { SigmaPreset } from '../context'
import { lambda } from './lambda'

export const netlify: SigmaPreset = extendPreset(lambda, {
  ignore: [
    'netlify.toml',
    '_redirects'
  ]
})
