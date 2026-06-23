import { resolveTags } from 'unhead/utils'
import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'

// subset of the resolved unhead tag shape we forward to the client
interface SerialisablePrefetchLink {
  rel: string
  href: string
  [key: string]: string | boolean
}

const FORWARDED_RELS = new Set(['preload', 'modulepreload'])

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:prefetch-preload-tags',
  hooks: {
    'app:rendered': ({ ssrContext }) => {
      if (!ssrContext) { return }

      // resolveTags walks the entries unhead has collected so far. We hook on
      // `app:rendered`, which fires before the renderer pushes its own build-
      // generated module preload / payload preload / script entries, so what we
      // see here is the user-defined head only (appHead + useHead + nuxt/image
      // <NuxtImg preload>, etc.).
      const tags = resolveTags(ssrContext.head)

      const links: SerialisablePrefetchLink[] = []
      for (const tag of tags) {
        if (tag.tag !== 'link') { continue }
        const props = tag.props
        if (!props) { continue }
        const rel = props.rel
        const href = props.href
        if (typeof rel !== 'string' || typeof href !== 'string') { continue }
        if (!FORWARDED_RELS.has(rel)) { continue }
        const link: SerialisablePrefetchLink = { rel, href }
        for (const key in props) {
          if (key === 'rel' || key === 'href') { continue }
          const value = props[key]
          if (typeof value === 'string' || typeof value === 'boolean') {
            link[key] = value
          }
        }
        links.push(link)
      }

      if (links.length) {
        ssrContext.payload.prefetchLinks = links
      }
    },
  },
})

export default plugin
