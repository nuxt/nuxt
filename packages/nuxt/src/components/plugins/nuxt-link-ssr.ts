import { createUnplugin } from 'unplugin'
import { genImport } from 'knitwork'
import { generateTransform, rolldownString } from 'rolldown-string'
import { VUE_ID_RE } from '../../core/utils/plugins.ts'

const NUXT_LINK_SSR_RE = /\b_?ssrRenderComponent\((_component_(?:NuxtLink|nuxt_link)),/
const NUXT_LINK_SSR_GLOBAL_RE = new RegExp(NUXT_LINK_SSR_RE.source, 'g')
const SSR_RENDER_NUXT_LINK = '__nuxt_ssrRenderNuxtLink'

/** Renders template `<NuxtLink>` usages with `ssrRenderNuxtLink` in server builds. */
export const NuxtLinkSsrPlugin = createUnplugin(() => {
  return {
    name: 'nuxt:nuxt-link-ssr',
    enforce: 'post',
    transform: {
      filter: {
        id: { include: VUE_ID_RE },
        code: { include: NUXT_LINK_SSR_RE },
      },
      handler (code, id, meta?: unknown) {
        const s = rolldownString(code, id, meta)
        let found = false
        s.replace(NUXT_LINK_SSR_GLOBAL_RE, (_, name) => {
          found = true
          return `${SSR_RENDER_NUXT_LINK}(${name},`
        })
        if (!found) { return }
        s.prepend(genImport('#app/components/nuxt-link-ssr-render', [{ name: 'ssrRenderNuxtLink', as: SSR_RENDER_NUXT_LINK }]) + '\n')
        return generateTransform(s, id)
      },
    },
  }
})
