import { extendPreset } from '../utils'
import { SigmaPreset } from '../context'
import { lambda } from './lambda'

export const netlify: SigmaPreset = extendPreset(lambda, {
  // @ts-ignore
  output: {
    publicDir: '{{ _nuxt.rootDir }}/dist'
  },
  ignore: [
    'netlify.toml',
    '_redirects'
  ]
})
