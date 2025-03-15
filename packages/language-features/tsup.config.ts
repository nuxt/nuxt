import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    './src/index.ts',
  ],
  format: [
    'cjs',
  ],
  clean: true,
  shims: false,
  splitting: false,
  outDir: 'dist',
  dts: true,
  external: [
    '@vue/language-core',
    'muggle-string',
  ],
  esbuildOptions: (options) => {
    options.footer = {
      // This will ensure we can continue writing this plugin
      // as a modern ECMA module, while still publishing this as a CommonJS
      // library with a default export, as that's how a VueLanguagePlugin is expected to look.
      // @see https://github.com/evanw/esbuild/issues/1182#issuecomment-1011414271
      js: 'module.exports = module.exports.default;',
    }
  },
})
