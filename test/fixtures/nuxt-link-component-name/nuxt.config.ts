import { withMatrix } from '../../matrix'

// Regression fixture for nuxt/nuxt#26718: `experimental.defaults.nuxtLink.componentName`
// must rename the auto-imported NuxtLink component (registration honours the option).
export default withMatrix({
  experimental: {
    defaults: {
      nuxtLink: {
        componentName: 'NuxtLinkDefault',
      },
    },
  },
})
