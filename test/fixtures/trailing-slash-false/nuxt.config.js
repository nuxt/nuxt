import { resolve } from 'path'

export default {
  srcDir: resolve(__dirname, '../trailing-slash'),
  router: {
    trailingSlash: false
  }
}
