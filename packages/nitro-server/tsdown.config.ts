import { defineConfig } from 'tsdown'
import { failOnInvalidAnnotation } from '../../scripts/tsdown-plugins.ts'

export default defineConfig([
  {
    dts: { generator: 'oxc' },
    exports: { devExports: true },
    entry: ['src/index.ts', 'src/h3.ts', 'src/augments.ts', 'src/request-types.ts'],
    plugins: [failOnInvalidAnnotation()],
    deps: {
      onlyBundle: [],
      neverBundle: ['@nuxt/schema', '#app/types'],
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
      neverBundle: [
        '#internal/nuxt/paths',
        '#internal/dev-server-logs-options',
        '#internal/nuxt.config.mjs',
        '#internal/nuxt/app-config',
        '#internal/nuxt/nitro-config.mjs',
        '#internal/nuxt/error-channel',
        '#internal/nuxt/host',
        '#nuxt-compat/flags',
        '#nuxt-compat/import-meta',
      ],
    },
  },
  {
    // declarations for the files server auto-imports and the server tsconfig name by path,
    // named so that an extensionless path resolves them
    dts: { emitDtsOnly: true },
    outDir: 'dist/runtime/compat/',
    entry: [
      'src/runtime/compat/cache.ts',
      'src/runtime/compat/event.ts',
      'src/runtime/compat/h3-v1.ts',
      'src/runtime/compat/nitro-v2-types.ts',
      'src/runtime/compat/render.ts',
      'src/runtime/compat/runtime-config.ts',
    ],
    unbundle: true,
    outExtensions: () => ({ js: '.js' }),
    deps: {
      onlyBundle: [],
      neverBundle: [/^nitro(?:\/|$)/],
    },
  },
])
