import { defineConfig } from 'tsdown'
import { failOnInvalidAnnotation } from '../../scripts/tsdown-plugins.ts'

export default defineConfig([
  {
    dts: { generator: 'oxc' },
    entry: ['src/index.ts'],
    plugins: [failOnInvalidAnnotation()],
    deps: {
      onlyBundle: [],
      neverBundle: ['@nuxt/schema'],
    },
  },
  {
    dts: false,
    outDir: 'dist/runtime/',
    entry: 'src/runtime/**/*',
    unbundle: true,
    plugins: [failOnInvalidAnnotation()],
    deps: {
      onlyBundle: [],
      neverBundle: [],
    },
  },
])
