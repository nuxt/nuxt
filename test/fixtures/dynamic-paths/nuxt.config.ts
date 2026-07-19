import { isNuxtPrepare, projectSuffix, withMatrix } from '../../matrix'

export default withMatrix({
  ...(isNuxtPrepare ? {} : { buildDir: `.nuxt-${projectSuffix}` }),
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
