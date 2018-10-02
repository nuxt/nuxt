import config from './packages/nuxt-build/rollup.config'

export default config({
  rootDir: __dirname,
  input: './lib/index.js'
})
