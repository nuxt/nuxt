import config from './scripts/rollup.config'
import pkg from './package.json'

export default config({
  pkg,
  input: './lib/nuxt.js'
})
