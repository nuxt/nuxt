import { MODES } from '../../utils'

export default () => ({
  [MODES.universal]: {
    build: {
      ssr: true
    },
    render: {
      ssr: true
    }
  } as const,
  [MODES.spa]: {
    build: {
      ssr: false
    },
    render: {
      ssr: false
    }
  } as const
})
