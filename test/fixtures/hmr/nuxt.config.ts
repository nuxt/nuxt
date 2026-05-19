import { withMatrix } from '../../matrix'
import { virtualCounterPlugin } from './vite/virtual-counter-plugin'

export default withMatrix({
  extends: ['../hmr-sibling-layer'],
  experimental: {
    inlineRouteRules: true,
  },
  vite: {
    plugins: [virtualCounterPlugin()],
  },
})
