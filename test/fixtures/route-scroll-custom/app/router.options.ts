import type { RouterConfig } from 'nuxt/schema'

export default {
  scrollBehavior (to, from, savedPosition) {
    document.documentElement.dataset.scrollFrom = from.fullPath
    document.documentElement.dataset.scrollStart = String(window.scrollY)
    document.documentElement.dataset.scrollCalls = String(Number(document.documentElement.dataset.scrollCalls || 0) + 1)
    if ('keepScroll' in to.query) { return false }
    return savedPosition || { left: 0, top: 200 }
  },
} satisfies RouterConfig
