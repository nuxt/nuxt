<template>
  <div>
    {{ hello }}
  </div>
</template>

<script>
export default defineNuxtComponent({
  async asyncData () {
    return {
      hello: await $fetch('/api/hello')
    }
  }
})
</script>
