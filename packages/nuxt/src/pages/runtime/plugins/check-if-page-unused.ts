import { nextTick } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteRecordNormalized } from 'vue-router'
import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'
import { onNuxtReady } from '#app/composables/ready'
import { useError } from '#app/composables/error'
import { useRouter } from '#app/composables/router'
import { renderDiagnostics } from '../../../app/diagnostics/render.ts'

export function findUnrenderedNestedPage (route: RouteLocationNormalizedLoaded): { parent: RouteRecordNormalized, child: RouteRecordNormalized } | undefined {
  let parent: RouteRecordNormalized | undefined
  for (const record of route.matched) {
    // vue-router renders the child directly at the parent's depth for records without a component
    if (!record.components?.default) { continue }
    if (!Object.values(record.instances ?? {}).some(Boolean)) {
      // an unrendered record without a rendered parent is covered by the global check below
      return parent ? { parent, child: record } : undefined
    }
    parent = record
  }
}

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
      nuxtApp.hook('page:finish', () => {
        const route = router.currentRoute.value
        // wait for vue-router to register the mounted instances of matched records
        nextTick(() => {
          if (error.value || router.currentRoute.value !== route) { return }
          const unrendered = findUnrenderedNestedPage(route)
          if (!unrendered || warnedPaths.has(unrendered.child.path)) { return }
          warnedPaths.add(unrendered.child.path)
          renderDiagnostics.NUXT_E4016({ fullPath: route.fullPath, childPath: unrendered.child.path, parentPath: unrendered.parent.path })
        })
      })
    }
  },
  env: {
    islands: false,
  },
})

export default plugin
