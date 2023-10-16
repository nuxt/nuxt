<template>
  <div>
    you should not see me
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: [
    (to) => {
      return abortNavigation(to.query.error ? new Error(to.query.error.toString()) : undefined)
    }
  ]
})
</script>
