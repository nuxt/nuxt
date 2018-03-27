import istanbul from 'rollup-plugin-istanbul'

import config from './rollup.config'

export default config({
  name: 'nuxt-test',
  input: './lib/nuxt.js',
  plugins: [
    istanbul()
  ]
})
