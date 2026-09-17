import { projectSuffix, withMatrix } from '../../matrix.ts'
import { unpatchedVue } from './unpatched-vue.ts'

export default withMatrix({
  ...process.env.TEST_UNPATCHED_VUE && {
    buildDir: `.nuxt-unpatched-${projectSuffix}`,
    vite: { plugins: [unpatchedVue()] },
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
