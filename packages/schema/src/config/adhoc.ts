import { defineResolvers } from '../utils/definition'

export default defineResolvers({
  components: {
    $resolve: (val) => {
      if (Array.isArray(val)) {
        return { dirs: val }
      }
      if (val === false) {
        return { dirs: [] }
      }
      return {
        dirs: [{ path: '~/components/global', global: true }, '~/components'],
        ...typeof val === 'object' ? val : {},
      }
    },
  },

  imports: {
    global: false,
    scan: true,
    dirs: [],
  },

  pages: undefined,

  telemetry: undefined,

  devtools: {},
})
