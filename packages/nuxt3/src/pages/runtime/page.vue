<template>
  <RouterView v-slot="{ Component }">
    <NuxtLayout v-if="Component" :name="layout || updatedComponentLayout || Component.type.layout">
      <transition name="page" mode="out-in">
        <!-- <keep-alive> -->
        <Suspense @pending="() => onSuspensePending(Component)" @resolve="() => onSuspenseResolved(Component)">
          <component :is="Component" :key="$route.path" />
        </Suspense>
        <!-- <keep-alive -->
      </transition>
    </NuxtLayout>
    <!-- TODO: Handle 404 placeholder -->
  </RouterView>
</template>

<script>
import { ref } from 'vue'

import NuxtLayout from './layout'
import { useNuxtApp } from '#app'

export default {
  name: 'NuxtPage',
  components: { NuxtLayout },
  props: {
    layout: {
      type: String,
      default: null
    }
  },
  setup () {
    // Disable HMR reactivity in production
    const updatedComponentLayout = process.dev ? ref(null) : null

    const nuxtApp = useNuxtApp()

    function onSuspensePending (Component) {
      if (process.dev) {
        updatedComponentLayout.value = Component.type.layout || null
      }
      return nuxtApp.callHook('page:start', Component)
    }

    function onSuspenseResolved (Component) {
      return nuxtApp.callHook('page:finish', Component)
    }

    return {
      updatedComponentLayout,
      onSuspensePending,
      onSuspenseResolved
    }
  }
}
</script>
