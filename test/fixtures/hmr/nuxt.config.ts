import { withMatrix } from '../../matrix'
import { virtualCounterPlugin } from './vite/virtual-counter-plugin'

export default withMatrix({
  experimental: {
    inlineRouteRules: true,
  },
  vite: {
    plugins: [virtualCounterPlugin()],
  },
})
