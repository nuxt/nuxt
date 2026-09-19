import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import { VUE_ID_RE } from '../../core/utils/plugins.ts'

const NUXT_LINK_SSR_RE = /\b(_?ssrRenderComponent)\((_component_(?:NuxtLink|nuxt_link)),/
const NUXT_LINK_SSR_GLOBAL_RE = new RegExp(NUXT_LINK_SSR_RE.source, 'g')

/** Renders template `<NuxtLink>` usages with the component's `__ssrRender` when it defines one. */
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
        s.replace(NUXT_LINK_SSR_GLOBAL_RE, (_, render, name) => `(${name}.__ssrRender || ${render})(${name},`)
        return generateTransform(s, id)
      },
    },
  }
})
