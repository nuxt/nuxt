import { projectSuffix, withMatrix } from '../../matrix.ts'
import { vue3542 } from './vue-3-5-42.ts'

export default withMatrix({
  ...process.env.TEST_VUE_3_5_42 && {
    buildDir: `.nuxt-vue-3-5-42-${projectSuffix}`,
    vite: { plugins: [vue3542()] },
  },
  // default title/description so unhead's client-side dev validation (#35468)
  // has no missing-title/description warnings on these title-less test pages
  app: {
    head: {
      title: 'Hydration Navigation',
      meta: [{ name: 'description', content: 'Hydration navigation test fixture' }],
    },
  },
})
