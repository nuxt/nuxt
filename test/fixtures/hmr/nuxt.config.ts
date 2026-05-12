import { withMatrix } from '../../matrix'
import { virtualCounterPlugin } from './vite/virtual-counter-plugin'

export default withMatrix({
  experimental: {
    nitroAutoImports: true,
    inlineRouteRules: true,
  },
  vite: {
    plugins: [virtualCounterPlugin()],
  },
})
