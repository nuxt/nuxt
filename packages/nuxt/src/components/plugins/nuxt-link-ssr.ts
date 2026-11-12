import { createUnplugin } from 'unplugin'
import { genImport } from 'knitwork'
import { generateTransform, rolldownString } from 'rolldown-string'
import type { RolldownString } from 'rolldown-string'
import { VUE_ID_RE } from '../../core/utils/plugins.ts'

/**
 * `replace(regex, replacer)` is not supported by rolldown's native
 * MagicString, which only accepts a string replacement. Iterate the matches
 * in JS and apply positional overwrites, which both implementations support.
 */
function replaceRegexMatches (
  s: RolldownString,
  code: string,
  re: RegExp,
  replacer: (match: RegExpExecArray) => string,
): boolean {
  let matched = false
  const offset = s.offset
  re.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(code)) !== null) {
    matched = true
    const content = replacer(match)
    if (content !== match[0]) {
      s.overwrite(match.index - offset, match.index + match[0].length - offset, content)
    }
    if (match[0].length === 0) {
      re.lastIndex++
    }
  }
  re.lastIndex = 0
  return matched
}

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
        const found = replaceRegexMatches(s, code, NUXT_LINK_SSR_GLOBAL_RE, ([, name]) => `${SSR_RENDER_NUXT_LINK}(${name},`)
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
        replaceRegexMatches(s, code, NUXT_LINK_CLIENT_GLOBAL_RE, (match) => {
          const kind = match[1] as 'VNode' | 'Block'
          used.add(kind)
          return `${CREATE_NUXT_LINK[kind]}(${match[2]},`
        })
        if (!used.size) { return }
        s.prepend(genImport('#app/components/nuxt-link', [...used].map(kind => ({ name: `createNuxtLink${kind}`, as: CREATE_NUXT_LINK[kind] }))) + '\n')
        return generateTransform(s, id)
      },
    },
  }
})
