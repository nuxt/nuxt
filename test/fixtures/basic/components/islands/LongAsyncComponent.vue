<template>
  <div>
    {{ data }}
    <div id="long-async-component-count">
      {{ count }}
    </div>
    <p>hello world !!!</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  count: number
}>()

const { data } = await useFetch('/api/very-long-request')
</script>
