import { builder, withMatrix } from '../../matrix'
import { virtualCounterPlugin } from './vite/virtual-counter-plugin'

export default withMatrix({
  extends: ['../hmr-sibling-layer'],
  experimental: {
    nitroAutoImports: true,
    inlineRouteRules: true,
  },
  // `virtual:hmr-counter` is a Vite plugin module and the regression it guards
  // (#30169) is Vite-only. webpack/Rspack don't resolve the `virtual:` scheme,
  // so exclude the page there rather than ship a bespoke scheme handler.
  ...builder === 'vite'
    ? { vite: { plugins: [virtualCounterPlugin()] } }
    : { ignore: ['**/virtual-module.vue', '**/jsx.vue'] },
})
