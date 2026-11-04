import type { Nuxt } from '@nuxt/schema'
import type { InlineConfig as ViteConfig } from 'vite'
import type { Plugin } from 'postcss'
import { resolvePostcssPlugins } from '@nuxt/kit/internal'

export async function resolveCSSOptions (nuxt: Nuxt): Promise<ViteConfig['css']> {
  return {
    postcss: {
      plugins: await resolvePostcssPlugins<Plugin>(nuxt),
    },
  }
}
