<template>
  <div>
    <div>{{ hello }}</div>
    <NuxtPage />
  </div>
</template>

<script>
export default defineNuxtComponent({
  fetchKey: () => 'hello',
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
