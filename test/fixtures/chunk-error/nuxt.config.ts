import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  css: ['~/assets/global.css'],
  features: {
    inlineStyles: false,
  },
  experimental: {
    restoreState: true,
  },
})
