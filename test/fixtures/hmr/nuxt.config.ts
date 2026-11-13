import { withMatrix } from '../../matrix.ts'
import { virtualCounterPlugin } from './vite/virtual-counter-plugin.ts'

export default withMatrix({
  extends: ['../hmr-sibling-layer'],
  experimental: {
    inlineRouteRules: true,
  },
  vite: {
    plugins: [virtualCounterPlugin()],
  },
})
