import { withMatrix } from '../../matrix'

export default withMatrix({
  features: {
    inlineStyles: false,
  },
  experimental: {
    componentIslands: true,
  },
})
