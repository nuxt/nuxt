import { builder, isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix'

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
  // `import.meta.glob` and `?url` asset queries are Vite-only.
  ...(builder === 'vite' ? {} : { ignore: ['**/dynamic-assets.vue'] }),
  css: ['~/assets/global.css'],
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
