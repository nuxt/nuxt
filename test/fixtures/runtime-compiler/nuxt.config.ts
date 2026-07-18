import { withMatrix } from '../../matrix'

// https://nuxt.com/docs/4.x/api/nuxt-config
export default withMatrix({
  // default title/description so unhead's client-side dev validation (#35468)
  // has no missing-title/description warnings on these title-less test pages
  app: {
    head: {
      title: 'Nuxt Runtime Compiler',
      meta: [{ name: 'description', content: 'Runtime compiler test fixture' }],
    },
  },
  vue: {
    runtimeCompiler: true,
  },
  experimental: {
    nitroAutoImports: true,
  },
})
