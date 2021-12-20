import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'
import { useNuxtApp } from '#app'

export const useRouter = () => {
  return useNuxtApp().$router as Router
}

export const useRoute = () => {
  return useNuxtApp()._route as RouteLocationNormalizedLoaded
}
