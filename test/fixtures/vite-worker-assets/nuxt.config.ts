import { withMatrix } from '../../matrix'

export default withMatrix({
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
})
