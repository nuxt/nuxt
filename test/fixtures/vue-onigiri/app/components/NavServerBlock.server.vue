<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <div class="nav-server-block">
    <span class="nav-server-label">nav-island:{{ label }}</span>
    <Counter
      v-load-client
      :multiplier="2"
    />
  </div>
</template>

<style scoped>
.nav-server-label {
  color: rgb(0, 128, 0);
}
</style>
