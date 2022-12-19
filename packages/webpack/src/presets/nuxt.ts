import type { WebpackConfigContext } from '../utils/config'
import { applyPresets } from '../utils/config'

import { assets } from './assets'
import { base } from './base'
import { esbuild } from './esbuild'
import { pug } from './pug'
import { style } from './style'
import { vue } from './vue'

export function nuxt (ctx: WebpackConfigContext) {
  applyPresets(ctx, [
    base,
    assets,
    esbuild,
    pug,
    style,
    vue
  ])
}
