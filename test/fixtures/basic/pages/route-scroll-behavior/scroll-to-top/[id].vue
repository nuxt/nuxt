<script setup lang="ts">
definePageMeta({
  scrollToTop (to) {
    return to.query.scrollToTop === 'true'
  },
})

const route = useRoute()
</script>

<template>
  <div>
    <h2>{{ route.params.id }}</h2>
  </div>
</template>
