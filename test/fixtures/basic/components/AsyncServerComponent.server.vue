<template>
  <div>
    This is a .server (1000ms) async component
    {{ data }}
    <div id="async-server-component-count">
      {{ count }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  count: number
}>()

const { data } = await useFetch('/api/very-long-request')
</script>
