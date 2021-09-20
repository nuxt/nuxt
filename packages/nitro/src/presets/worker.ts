import { NitroPreset } from '../context'

export const worker: NitroPreset = {
  entry: null, // Abstract
  node: false,
  minify: true,
  externals: false,
  inlineDynamicImports: true // iffe does not support code-splitting
}
