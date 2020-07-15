import { MODES } from 'nuxt/utils'

export default () => ({
  [MODES.universal]: {
    build: {
      ssr: true
    },
    render: {
      ssr: true
    }
  },
  [MODES.spa]: {
    build: {
      ssr: false
    },
    render: {
      ssr: false
    }
  }
})
