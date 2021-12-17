import { computed, reactive } from 'vue'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'
import { useNuxtApp } from '#app'

export const useRouter = () => {
  return useNuxtApp().$router as Router
}

export const useRoute = (): RouteLocationNormalizedLoaded => {
  const nuxtApp = useNuxtApp()
  if (nuxtApp._route) {
    return nuxtApp._route
  }

  const currentRoute = (nuxtApp.$router as Router).currentRoute

  // https://github.com/vuejs/vue-router-next/blob/master/src/router.ts#L1192-L1200
  nuxtApp._route = reactive(Object.fromEntries(
    Object.keys(currentRoute.value).map(key => [key, computed(() => currentRoute.value[key])])
  ) as any)

  return nuxtApp._route
}
