<script lang="ts">
export default defineNuxtComponent({
  name: 'DefineNuxtComponentTest',
  setup () {
    const state = useState('define-nuxt-component-counter', () => 0)
    const watcher = useState('define-nuxt-component-watcher', () => 0)
    const router = useRouter()

    // Should trigger once per page on state change
    watch(state, () => {
      watcher.value++
    })

    state.value++

    return {
      state,
      watcher,
      router,
    }
  },
})
</script>

<template>
  <div>
    <div
      data-testid="define-nuxt-component-state"
      @click="router.push('/define-nuxt-component')"
    >
      {{ watcher }}
    </div>
  </div>
</template>
