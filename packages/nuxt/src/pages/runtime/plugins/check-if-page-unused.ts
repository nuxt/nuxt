import { nextTick } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteRecordNormalized } from 'vue-router'
import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'
import { onNuxtReady } from '#app/composables/ready'
import { useError } from '#app/composables/error'
import { useRouter } from '#app/composables/router'
import { renderDiagnostics } from '../../../app/diagnostics/render'

export function findUnrenderedNestedPage (route: RouteLocationNormalizedLoaded): { parent: RouteRecordNormalized, child: RouteRecordNormalized } | undefined {
  let parent: RouteRecordNormalized | undefined
  for (const record of route.matched) {
    // vue-router renders the child directly at the parent's depth for records without a component
    if (!record.components?.default) { continue }
    if (!Object.values(record.instances ?? {}).some(Boolean)) {
      // an unrendered record without a rendered parent is covered by the E4011 check
      return parent ? { parent, child: record } : undefined
    }
    parent = record
  }
}

export const NESTED_PAGE_CONFIRMATION_DELAY = 1000

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:checkIfPageUnused',
  setup (nuxtApp) {
    const error = useError()

    function checkIfPageUnused () {
      if (!error.value && !nuxtApp._isNuxtPageUsed) {
        renderDiagnostics.NUXT_E4011()
      }
    }

    if (import.meta.server) {
      nuxtApp.hook('app:rendered', ({ renderResult }) => {
        if (renderResult?.html) {
          nextTick(checkIfPageUnused)
        }
      })
    } else {
      onNuxtReady(checkIfPageUnused)

      const router = useRouter()
      const warnedPaths = new Set<string>()
      nuxtApp.hook('page:finish', (vnode) => {
        const route = router.currentRoute.value
        // `page:finish` can fire for a superseded navigation (its hook chain is async), in which
        // case the finished component no longer belongs to the current route and the matched
        // records may not have registered instances yet
        if (vnode && !route.matched.some(record => record.components?.default === vnode.type)) { return }
        // `page:finish` fires when the incoming page's async deps resolve. When a page transition
        // is active, that precedes DOM insertion by the whole leave duration, so wait for the
        // transition, then for vue-router to register the mounted instances of matched records.
        // Deliberately not awaited: blocking the hook chain would delay `page:loading:end`.
        void Promise.resolve(nuxtApp['~transitionPromise']).then(() => nextTick()).then(() => {
          if (error.value || router.currentRoute.value !== route) { return }
          const candidate = findUnrenderedNestedPage(route)
          if (!candidate || warnedPaths.has(candidate.child.path)) { return }
          // Suspense keeps the previous tree mounted while the incoming one resolves, and swapping
          // subtrees (e.g. when a parent route param changes) briefly leaves matched records with
          // no registered instance. A missing `<NuxtPage />` is permanent, so only warn when the
          // record is still unrendered on the same route after a confirmation delay.
          setTimeout(() => {
            if (error.value || router.currentRoute.value !== route) { return }
            const confirmed = findUnrenderedNestedPage(route)
            if (!confirmed || confirmed.child !== candidate.child || warnedPaths.has(confirmed.child.path)) { return }
            warnedPaths.add(confirmed.child.path)
            renderDiagnostics.NUXT_E4016({ fullPath: route.fullPath, childPath: confirmed.child.path, parentPath: confirmed.parent.path })
          }, NESTED_PAGE_CONFIRMATION_DELAY)
        })
      })
    }
  },
  env: {
    islands: false,
  },
})

export default plugin
