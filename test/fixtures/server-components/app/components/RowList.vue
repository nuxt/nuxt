<script setup lang="ts">
defineProps<{
  rows: number
}>()
</script>

<template>
  <div>
    <span
      v-for="n in rows"
      :key="n"
      class="row-item"
    />
  </div>
</template>
