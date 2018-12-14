import { resolve } from 'path'

export default {
  srcDir: resolve(__dirname),
  plugins: [
    '~/plugins/test.ts'
  ],
  build: {
    typescript: true
  }
}
