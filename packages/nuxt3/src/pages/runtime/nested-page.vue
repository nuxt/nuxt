<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" :key="key" />
  </RouterView>
</template>

<script lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useRoute } from 'vue-router'
import { computed } from 'vue'

export default {
  name: 'NuxtNestedPage',
  props: {
    childKey: {
      type: [Function, String] as unknown as () => string | ((route: RouteLocationNormalizedLoaded) => string),
      default: null
    }
  },
  setup (props) {
    const route = useRoute()
    const key = computed(() => {
      const source = props.childKey ?? route.meta.key
      return typeof source === 'function' ? source(route) : source
    })
    return {
      key
    }
  }
}
</script>
