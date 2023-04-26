<template>
  <div>
    don't look at this
  </div>
</template>

<script lang="ts">
export default defineNuxtComponent({
  asyncData () {
    throw new Error('OH NNNNNNOOOOOOOOOOO')
  }
})
</script>
