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

const NUXT_LINK_CLIENT_RE = /\b_?create(VNode|Block)\((_component_(?:NuxtLink|nuxt_link)),/
const NUXT_LINK_CLIENT_GLOBAL_RE = new RegExp(NUXT_LINK_CLIENT_RE.source, 'g')
const CREATE_NUXT_LINK = { VNode: '__nuxt_createNuxtLinkVNode', Block: '__nuxt_createNuxtLinkBlock' }
// `v-once` and `v-memo` reuse cached vnodes, which would freeze the active state of an inlined link
const CACHED_VNODES_RE = /\b_?(?:setBlockTracking|isMemoSame|withMemo)\(/

/** Creates template `<NuxtLink>` vnodes with `createNuxtLinkVNode` in client builds. */
export const NuxtLinkClientPlugin = createUnplugin(() => {
  return {
    name: 'nuxt:nuxt-link-client',
    enforce: 'post',
    transform: {
      filter: {
        id: { include: VUE_ID_RE },
        code: { include: NUXT_LINK_CLIENT_RE },
      },
      handler (code, id, meta?: unknown) {
        if (CACHED_VNODES_RE.test(code)) { return }
        const s = rolldownString(code, id, meta)
        const used = new Set<'VNode' | 'Block'>()
        s.replace(NUXT_LINK_CLIENT_GLOBAL_RE, (_, kind: 'VNode' | 'Block', name) => {
          used.add(kind)
          return `${CREATE_NUXT_LINK[kind]}(${name},`
        })
        if (!used.size) { return }
        s.prepend(genImport('#app/components/nuxt-link', [...used].map(kind => ({ name: `createNuxtLink${kind}`, as: CREATE_NUXT_LINK[kind] }))) + '\n')
        return generateTransform(s, id)
      },
    },
  }
})
