<script setup lang="ts">
const format = (value: string) => value.toUpperCase()
</script>

<template>
  <div>
    <ServerCard
      title="Props"
      :format="format"
    />
    <NuxtIsland
      name="ServerCard"
      :props="{ title: 'Island', format }"
    />
  </div>
</template>
