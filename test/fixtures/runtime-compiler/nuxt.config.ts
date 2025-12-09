import { withMatrix } from '../../matrix'

// https://nuxt.com/docs/3.x/api/nuxt-config
export default withMatrix({
  vue: {
    runtimeCompiler: true,
  },
  experimental: {
    externalVue: false,
  },
})
