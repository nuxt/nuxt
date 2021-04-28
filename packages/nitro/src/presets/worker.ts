import { NitroPreset } from '../context'

export const worker: NitroPreset = {
  entry: null, // Abstract
  node: false,
  minify: true,
  inlineDynamicImports: true // iffe does not support code-splitting
}
