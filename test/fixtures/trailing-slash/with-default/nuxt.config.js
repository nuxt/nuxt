import { resolve } from 'path'

export default {
  target: 'static',
  rootDir: __dirname,
  srcDir: resolve(__dirname, '..'),
  router: {
    // trailingSlash: undefined
  }
}
