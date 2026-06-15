import type { WebpackConfigContext } from '../utils/config.ts'
import { applyPresets } from '../utils/config.ts'

import { assets } from './assets.ts'
import { base } from './base.ts'
import { esbuild } from './esbuild.ts'
import { pug } from './pug.ts'
import { style } from './style.ts'
import { vue } from './vue.ts'

export async function nuxt (ctx: WebpackConfigContext) {
  await applyPresets(ctx, [
    base,
    assets,
    esbuild,
    pug,
    style,
    vue,
  ])
}
