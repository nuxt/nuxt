<script setup lang="ts">
const { data, refresh } = await useAsyncData('key', () => Promise.resolve('something'), {
  getCachedData: (_, triggeredBy) => {
    if(triggeredBy === 'refresh:manual') {
      return 1
    }
    return 0
  }
})
</script>

<template>
  <!-- Edit this file to play around with Nuxt but never commit changes! -->
  <div>
    {{ data }}
    <button @click="refresh()" />
  </div>
</template>

<style scoped></style>
