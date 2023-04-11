<template>
  <div>
    <div v-if="count > 2">
      count is above 2
    </div>
    <slot />
    {{ data }}
    <div id="long-async-component-count">
      {{ count }}
    </div>
    <slot name="test" :count="count" />
    <p>hello world !!!</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  count: number
}>()

const { data } = await useFetch('/api/very-long-request')
</script>
