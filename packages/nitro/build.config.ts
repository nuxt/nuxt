import type { BuildConfig } from 'unbuild'

export default <BuildConfig>{
  declaration: true,
  entries: [
    'src/index',
    'src/compat',
    { input: 'src/runtime/', format: 'esm', declaration: false }
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
    'vue-server-renderer',
    '@vue/server-renderer',
    'vue'
  ]
}
