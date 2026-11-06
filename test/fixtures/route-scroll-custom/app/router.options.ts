import type { RouterConfig } from 'nuxt/schema'

export default {
  scrollBehavior (_to, _from, savedPosition) {
    document.documentElement.dataset.scrollStart = String(window.scrollY)
    return savedPosition || { left: 0, top: 200 }
  },
} satisfies RouterConfig
