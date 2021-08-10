<template>
  <div>
    Page visits: {{ data.count }}
  </div>
</template>

<script lang="ts">
export default defineNuxtComponent({
  setup () {
    const { data } = asyncData('time', () => $fetch('/api/count'))

    return {
      data
    }
  }
})
</script>
