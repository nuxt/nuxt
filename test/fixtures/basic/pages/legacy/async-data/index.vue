<template>
  <div>
    <div>{{ fooParent }}</div>
    <NuxtPage />
  </div>
</template>

<script>
export default defineNuxtComponent({
  asyncData () {
    return {
      fooParent: 'fooParent'
    }
  }
})
</script>
