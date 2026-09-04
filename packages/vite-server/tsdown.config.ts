import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: { oxc: true },
  entry: ['src/index.ts'],
  deps: {
    onlyBundle: [],
    neverBundle: ['@nuxt/schema'],
  },
})
