<script setup lang="ts">
const ready = ref('not yet hydrated')
onNuxtReady(() => {
  ready.value = 'fully hydrated and ready to go'
})
</script>

<template>
  <div>
    {{ ready }}
  </div>
</template>
