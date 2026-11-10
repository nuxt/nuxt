import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  features: {
    inlineStyles: false,
  },
  experimental: {
    componentIslands: true,
  },
})
