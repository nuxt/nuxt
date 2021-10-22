import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  emitCJS: false,
  entries: [
    'src/index',
    { input: 'src/runtime/', outDir: 'dist/runtime', format: 'esm' },
    { input: 'src/runtime/', outDir: 'dist/runtime', format: 'cjs', declaration: false }
  ],
  dependencies: [
    '@cloudflare/kv-asset-handler',
    '@netlify/functions',
    '@nuxt/devalue',
    'connect',
    'destr',
    'ohmyfetch',
    'ora',
    'vue-bundle-renderer',
    'vue-server-renderer'
  ]
})
