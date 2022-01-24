<template>
  <RouterView v-slot="{ Component, route }">
    <NuxtTransition :options="route.meta.layoutTransition ?? { name: 'layout', mode: 'out-in' }">
      <NuxtLayout v-if="Component" :name="layout || route.meta.layout">
        <NuxtTransition :options="route.meta.pageTransition ?? { name: 'page', mode: 'out-in' }">
          <Suspense @pending="() => onSuspensePending(Component)" @resolve="() => onSuspenseResolved(Component)">
            <component :is="Component" />
          </Suspense>
        </NuxtTransition>
      </NuxtLayout>
    </NuxtTransition>
    <!-- TODO: Handle 404 placeholder -->
  </RouterView>
</template>

<script lang="ts">
import { defineComponent, h, Transition } from 'vue'
import NuxtLayout from './layout'
import { useNuxtApp } from '#app'

const NuxtTransition = defineComponent({
  name: 'NuxtTransition',
  props: {
    options: [Object, Boolean]
  },
  setup (props, { slots }) {
    return () => props.options ? h(Transition, props.options, slots.default) : slots.default()
  }
})

export default defineComponent({
  name: 'NuxtPage',
  components: { NuxtLayout, NuxtTransition },
  props: {
    layout: {
      type: String,
      default: null
    }
  },
  setup () {
    const nuxtApp = useNuxtApp()

    function onSuspensePending (Component) {
      return nuxtApp.callHook('page:start', Component)
    }

    function onSuspenseResolved (Component) {
      return nuxtApp.callHook('page:finish', Component)
    }

    return {
      onSuspensePending,
      onSuspenseResolved
    }
  }
})
</script>
