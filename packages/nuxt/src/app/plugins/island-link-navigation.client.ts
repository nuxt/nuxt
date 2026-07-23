import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { useRouter } from '../composables/router'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:island-link-navigation',
  setup () {
    const router = useRouter()

    function onClick (e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) { return }

      const anchor = (e.target as Element | null)?.closest('a')
      if (!anchor || !anchor.hasAttribute('data-internal') || anchor.hasAttribute('download')) { return }

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) { return }

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) { return }

      let path = url.pathname
      const base = (router.options.history.base || '').replace(/\/$/, '')
      if (base) {
        if (path === base) {
          path = '/'
        } else if (path.startsWith(base + '/')) {
          path = path.slice(base.length)
        } else {
          return
        }
      }

      const route = router.resolve(path + url.search + url.hash)
      if (!route.matched.length) { return }

      e.preventDefault()
      if (anchor.getAttribute('data-internal') === 'replace') {
        router.replace(route.fullPath)
      } else {
        router.push(route.fullPath)
      }
    }

    document.addEventListener('click', onClick)
  },
})

export default plugin
