<template>
  <div>
    {{ hello }}
  </div>
</template>

<script>
export default defineNuxtComponent({
  async setup () {
    await nextTick()
    useRuntimeConfig()
  },
  async asyncData () {
    await nextTick()
    return {
      hello: await $fetch('/api/hello')
    }
  }
})
</script>
