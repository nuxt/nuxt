import { builder, isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix.ts'

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  // `import.meta.glob` and `?url` asset queries are Vite-only.
  ...(builder === 'vite' ? {} : { ignore: ['**/dynamic-assets.vue'] }),
  css: ['~/assets/global.css'],
  routeRules: {
    '/api/prerendered-fetch': { prerender: true },
    '/api/echo': { headers: { 'x-echo': '1' } },
  },
  features: {
    inlineStyles: id => !!id && !id.includes('assets.vue'),
  },
  experimental: {
    runtimeBaseURL: true,
  },
  vite: {
    logLevel: 'silent',
    build: {
      assetsInlineLimit: 100, // keep SVG as assets URL
    },
  },
})
