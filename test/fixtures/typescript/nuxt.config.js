import { resolve } from 'path'

export default {
  typescript: true,
  srcDir: resolve(__dirname),
  plugins: [
    '~/plugins/test.ts'
  ]
}
