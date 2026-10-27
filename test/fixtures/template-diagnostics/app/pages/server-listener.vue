<script setup lang="ts">
const count = ref(0)
</script>

<template>
  <div>
    <ServerCard
      title="Listener"
      @click="count++"
    />
    <p>Clicked {{ count }} times</p>
  </div>
</template>
