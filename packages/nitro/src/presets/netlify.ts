import { extendPreset } from '../utils'
import { NitroPreset } from '../context'
import { lambda } from './lambda'

export const netlify: NitroPreset = extendPreset(lambda, {
  output: {
    publicDir: '{{ _nuxt.rootDir }}/dist'
  },
  ignore: [
    'netlify.toml',
    '_redirects'
  ]
})
